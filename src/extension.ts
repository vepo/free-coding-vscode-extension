// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { channel } from 'diagnostics_channel';

export type Callback = (content: string) => void;
export class FreeCodingChannel {
	private _listener: Callback | null;
	private _buffer: string[] = [];

	constructor() {
		this._listener = null;
	}
	ask(content: string) {
		if (this._listener) {
			this._listener(content);
		} else {
			this._buffer.push(content);
		}
	}
	listen(listener: Callback) {
		this._listener = listener;
		// Process any buffered messages
		if (this._buffer.length > 0) {
			for (const bufferedContent of this._buffer) {
				this._listener(bufferedContent);
			}
			this._buffer = []; // Clear the buffer
		}

	}
}

export class FreeCodingChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'freeCoding.chat';

	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri,
		private readonly _channel: FreeCodingChannel
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		console.log("[Free Coding] Resolving web view")
		this._view = webviewView;

		webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'sendMessage':
					this._handleMessage(data.value);
					return;
			}
		});
	}

	private _handleMessage(message: string) {
		if (!this._view) {
			return;
		}

		this._channel.ask(message);

		// // Echo the message back for demonstration
		// this._view.webview.postMessage({
		// 	type: 'addMessage',
		// 	value: {
		// 		text: message,
		// 		isUser: false,
		// 		timestamp: new Date().toLocaleTimeString()
		// 	}
		// });
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'media', 'main.js'));

		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'media', 'styles.css'));

		return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleUri}" rel="stylesheet">
          <title>Chat</title>
      </head>
      <body>
          <div class="chat-container">
              <div id="messages" class="messages"></div>
              <div class="input-container">
                  <input id="messageInput" type="text" placeholder="Type a message...">
                  <button id="sendButton">Send</button>
              </div>
          </div>
          <script src="${scriptUri}"></script>
      </body>
      </html>`;
	}
}

function startJBangServer(context: vscode.ExtensionContext, channel: FreeCodingChannel) {
	const javaExecutable = 'jbang';

	// Path to your JAR file
	const jarPath = context.asAbsolutePath('src/java/server');

	// Arguments for your Java application
	const args = [jarPath];

	// Spawn the Java process
	const javaProcess = cp.spawn(javaExecutable, args, {
		cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath, // Optional: set working directory
		stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
	});

	channel.listen((content) => {
		javaProcess.stdin.write("FREECODING START\n");
		javaProcess.stdin.write(content);
		javaProcess.stdin.write("\nFREECODING END\n");
	});

	// Handle process output
	javaProcess.stdout?.on('data', (data) => {
		console.log(`Java stdout: ${data}`);
		vscode.window.showInformationMessage(`Java: ${data}`);
	});

	javaProcess.stderr?.on('data', (data) => {
		console.error(`Java stderr: ${data}`);
		vscode.window.showErrorMessage(`Java error: ${data}`);
	});

	// Handle process exit
	javaProcess.on('close', (code) => {
		console.log(`Java process exited with code ${code}`);
	});

	// Store the process reference for later management
	context.subscriptions.push({
		dispose: () => {
			if (!javaProcess.killed) {
				javaProcess.kill();
			}
		}
	});
}

export function activate(context: vscode.ExtensionContext) {
	console.log("[Free Coding] Starting Free Coding...")
	const channel = new FreeCodingChannel();
	const provider = new FreeCodingChatViewProvider(context.extensionUri, channel);

	context.subscriptions.push(vscode.window.registerWebviewViewProvider(FreeCodingChatViewProvider.viewType, provider));
	startJBangServer(context, channel);
}

// This method is called when your extension is deactivated
export function deactivate() { }
