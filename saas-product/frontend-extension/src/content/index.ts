console.log('[AI Triage LinkedIn] Injected into LinkedIn.');

function scanConversations(): { success: boolean; messages: any[]; error?: string } {
  const messages: any[] = [];

  const selectors = [
    '.msg-s-message-list__event',
    '.msg-conversation-card__message--text',
    '[data-test-message-list-event]',
    '.message-list-item'
  ];

  let nodes: NodeListOf<Element> | null = null;
  for (const sel of selectors) {
    const found = document.querySelectorAll(sel);
    if (found.length > 0) { nodes = found; break; }
  }

  if (!nodes || nodes.length === 0) {
    return { success: true, messages: [] };
  }

  const conversationNodes = document.querySelectorAll('.msg-conversation-listitem, [data-test-conversation-list-item]');
  
  conversationNodes.forEach((convNode, convIndex) => {
    try {
      const nameEl = convNode.querySelector('.msg-conversation-listitem__participant-names, [data-test-conversation-name]');
      const snippetEl = convNode.querySelector('.msg-conversation-card__message--text, .msg-conversation-listitem__message-snippet');
      
      const senderName = nameEl?.textContent?.trim() || 'Unknown';
      const snippet = snippetEl?.textContent?.trim() || '';

      if (!snippet) return;

      const convLink = convNode.querySelector('a[href*="/messaging/thread/"]');
      const hrefMatch = convLink?.getAttribute('href')?.match(/thread\/([^/?]+)/);
      const chatId = hrefMatch ? hrefMatch[1] : `conv-${convIndex}`;

      const msgText = `${senderName}: ${snippet}`;
      messages.push({
        chatId,
        senderName,
        text: msgText,
        messages: [
          { isMe: false, text: snippet }
        ]
      });
    } catch { }
  });

  return { success: true, messages };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXECUTE_SCRAPE') {
    const result = scanConversations();
    sendResponse(result);
    return true;
  }

  if (request.type === 'SEND_REPLY') {
    const inputSelectors = [
      '.msg-form__contenteditable',
      '[data-test-message-composer] [contenteditable]',
      '.msg-form__textarea',
      'div[role="textbox"][aria-label*="message"]'
    ];
    
    let inputField: HTMLElement | null = null;
    for (const sel of inputSelectors) {
      inputField = document.querySelector(sel);
      if (inputField) break;
    }

    const sendBtnSelectors = [
      '.msg-form__send-button',
      '[data-test-message-composer-send-button]',
      'button[aria-label*="Send"]'
    ];
    
    let sendBtn: HTMLElement | null = null;
    for (const sel of sendBtnSelectors) {
      sendBtn = document.querySelector(sel);
      if (sendBtn) break;
    }

    if (inputField && sendBtn) {
      inputField.textContent = request.draftReply;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => { (sendBtn as HTMLButtonElement).click(); }, 500);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Could not find reply form elements' });
    }
  }
});
