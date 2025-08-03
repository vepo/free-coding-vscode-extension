
(function() {
    console.log("Starting chat....")
  const vscode = acquireVsCodeApi();
  const messagesContainer = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');

  function addMessage(text, isUser, timestamp) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = text;
    
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
        value: message
      });
      messageInput.value = '';
    }
  });

  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendButton.click();
    }
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