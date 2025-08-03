
(function () {
  console.log("Starting chat....")
  const vscode = acquireVsCodeApi();
  const messagesContainer = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const languageSelector = document.getElementById('languageSelector');

  function addMessage(text, isUser, timestamp) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    text.split('\n')
      .map(line => {
        let lineSpan = document.createElement('span');
        lineSpan.textContent = line;
        return lineSpan;
      })
      .forEach((element, index) => {
        if (index) {
          messageContent.appendChild(document.createElement('br'));
        }
        messageContent.appendChild(element);
      });
    // messageContent.textContent = text;

    const messageMeta = document.createElement('div');
    messageMeta.className = 'message-meta';
    messageMeta.textContent = `${isUser ? 'You' : 'Bot'} • ${timestamp}`;

    messageElement.appendChild(messageContent);
    messageElement.appendChild(messageMeta);
    messagesContainer.appendChild(messageElement);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
      addMessage(message, true, new Date().toLocaleTimeString());
      vscode.postMessage({
        type: 'sendMessage',
        value: JSON.stringify({
          type: 'sendMessage',
          data: message
        })
      });
      messageInput.value = '';
    }
  });

  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendButton.click();
    }
  });

  languageSelector.addEventListener('change', event => {
    console.log("[Free Coding] Language selector changed!", event);
    vscode.postMessage({
      type: 'sendMessage',
      value: JSON.stringify({
        type: 'changeLanguage',
        data: languageSelector.value
      })
    });
  });

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'addMessage':
        addMessage(message.value.text, message.value.isUser, message.value.timestamp);
        break;
    }
  });
})();