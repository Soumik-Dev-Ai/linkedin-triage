console.log('LinkedIn Triage Content Script injected.');

let processedMessageIds = new Set<string>();

// Basic DOM scraper to find unread messages on LinkedIn
function scanForNewMessages() {
  // This is a simplified selector for demonstration purposes.
  // Real LinkedIn DOM is highly obfuscated and changes frequently.
  const messageNodes = document.querySelectorAll('.msg-s-message-list__event');
  
  if (messageNodes.length === 0) return;

  const newMessages: any[] = [];
  
  messageNodes.forEach((node, index) => {
    const textNode = node.querySelector('.msg-s-event-listitem__body');
    const senderNode = node.querySelector('.msg-s-message-group__name');
    
    if (textNode && senderNode) {
      const text = textNode.textContent?.trim();
      const sender = senderNode.textContent?.trim();
      
      // Use a simple hash of text+sender as an ID since DOM nodes don't always have stable IDs
      const msgId = sender + '-' + (text ? text.substring(0, 20) : '');
      
      if (!processedMessageIds.has(msgId) && text && sender) {
        processedMessageIds.add(msgId);
        newMessages.push({
          index,
          senderName: sender,
          text
        });
      }
    }
  });

  if (newMessages.length > 0) {
    console.log('Found new messages:', newMessages);
    return { success: true, messages: newMessages };
  }
  return { success: true, messages: [] };
}

// Listen for commands from the extension background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXECUTE_SCRAPE') {
    const result = scanForNewMessages();
    sendResponse(result);
    return true;
  }

// Listen for commands from the popup to inject text
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SEND_REPLY') {
    const inputField = document.querySelector('.msg-form__contenteditable') as HTMLElement;
    const sendBtn = document.querySelector('.msg-form__send-button') as HTMLButtonElement;
    
    if (inputField && sendBtn) {
      inputField.textContent = request.draftReply;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      // Optional: actually click send
      // sendBtn.click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Could not find chat box' });
    }
  }
});
