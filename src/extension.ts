// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as cp from 'child_process';
import * as vscode from 'vscode';

export type Callback = (content: string) => void;
export class FreeCodingChannel {
	private _questionsListener: Callback | null;
	private _answerListener: Callback | null;
	private _buffer: string[] = [];

	constructor() {
		this._questionsListener = null;
		this._answerListener = null;
	}

	ask(content: string) {
		if (this._questionsListener) {
			this._questionsListener(content);
		} else {
			this._buffer.push(content);
		}
	}

	answer(content: string) {
		if (this._answerListener) {
			this._answerListener(content);
		} else {
			throw new Error("Invalid state!!! Answer Listener not found!");
		}
	}

	listenAnswers(listener: Callback) {
		this._answerListener = listener;
	}

	listenQuestions(listener: Callback) {
		this._questionsListener = listener;
		// Process any buffered messages
		if (this._buffer.length > 0) {
			for (const bufferedContent of this._buffer) {
				this._questionsListener(bufferedContent);
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
		const webView = this._view.webview;
		this._channel.listenAnswers(answer => webView.postMessage({
			type: 'addMessage',
			value: {
				text: answer,
				isUser: false,
				timestamp: new Date().toLocaleTimeString()
			}
		}));
		this._channel.ask(message);
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

	channel.listenQuestions((content) => {
		console.log("[Free Coding] Sending question to backend...", content);
		javaProcess.stdin.write("FREECODING START\n");
		javaProcess.stdin.write(content);
		javaProcess.stdin.write("\nFREECODING END\n");
	});

	let buffer = '';
	let isCapturing = false;

	// Handle process output
	javaProcess.stdout?.on('data', (data) => {
		var enc = new TextDecoder("utf-8");
		var content = enc.decode(data);
		console.log("[Free Coding] Raw answer received from backend...", content);

		buffer += content;	

		// Process the buffer to find answers
		while (true) {
			if (!isCapturing) {
				const startIdx = buffer.indexOf('FREECODING_ANSWER START');
				if (startIdx === -1) {
					// No start marker found, discard everything
					buffer = '';
					break;
				}

				// Found start marker, begin capturing
				isCapturing = true;
				buffer = buffer.slice(startIdx + 'FREECODING_ANSWER START'.length);
			} else {
				const endIdx = buffer.indexOf('FREECODING_ANSWER END');
				if (endIdx === -1) {
					// No end marker yet, wait for more data
					break;
				}

				// Found end marker, extract answer and send it
				const answer = buffer.slice(0, endIdx).trim();
				console.log("[Free Coding] Filtered answer received from backend...", answer);
				channel.answer(answer);

				// Reset state and process remaining buffer
				isCapturing = false;
				buffer = buffer.slice(endIdx + 'FREECODING_ANSWER END'.length);
			}
		}
	});

	javaProcess.stderr?.on('data', (data) => {
		console.error(`Java stderr: ${data}`);
		vscode.window.showErrorMessage(`Java error: ${data}`);
	});

	// Handle process exit
	javaProcess.on('close', (code) => {
		console.log(`Java process exited with code ${code}`);
		vscode.window.showErrorMessage(`Backend server died with code: ${code}`);
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
	console.log("[Free Coding] Starting Free Coding...");
	const channel = new FreeCodingChannel();
	const provider = new FreeCodingChatViewProvider(context.extensionUri, channel);

	context.subscriptions.push(vscode.window.registerWebviewViewProvider(FreeCodingChatViewProvider.viewType, provider));
	startJBangServer(context, channel);
}

// This method is called when your extension is deactivated
export function deactivate() { }
