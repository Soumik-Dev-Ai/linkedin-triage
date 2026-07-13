/**
 * AI Triage Bridge — Content Script for LinkedIn.
 *
 * Injected into LinkedIn messaging pages.
 * - Scrapes incoming messages with context (last 3 messages) for the AI pipeline.
 * - Injects drafted replies back into the LinkedIn message composer when approved.
 */

console.log('[AI Triage LinkedIn] Content script injected into LinkedIn.');

// ────────────────────────────────────────────────────────────────────
// 1. SCRAPE CONVERSATIONS
//    Scans the LinkedIn messaging DOM for conversations with readable
//    names and message snippets. Returns a list of chatId, senderName,
//    preview text, and a basic message array.
// ────────────────────────────────────────────────────────────────────
function scanConversations() {
  var messages = [];

  var conversationNodes = document.querySelectorAll(
    '.msg-conversation-listitem, [data-test-conversation-list-item]'
  );

  conversationNodes.forEach(function (convNode, convIndex) {
    try {
      var nameEl = convNode.querySelector(
        '.msg-conversation-listitem__participant-names, [data-test-conversation-name]'
      );
      var snippetEl = convNode.querySelector(
        '.msg-conversation-card__message--text, .msg-conversation-listitem__message-snippet'
      );

      var senderName = (nameEl && nameEl.textContent && nameEl.textContent.trim()) || 'Unknown';
      var snippet = (snippetEl && snippetEl.textContent && snippetEl.textContent.trim()) || '';
      if (!snippet) return;

      // Attempt to extract a stable chat ID from the thread link URL
      var convLink = convNode.querySelector('a[href*="/messaging/thread/"]');
      var href = convLink && convLink.getAttribute('href');
      var hrefMatch = href && href.match(/thread\/([^/?]+)/);
      var chatId = hrefMatch ? hrefMatch[1] : 'conv-' + convIndex;

      messages.push({
        chatId: chatId,
        senderName: senderName,
        text: senderName + ': ' + snippet,
        messages: [{ isMe: false, text: snippet }]
      });
    } catch (_) { /* skip malformed DOM nodes */ }
  });

  return { success: true, messages: messages };
}

// ────────────────────────────────────────────────────────────────────
// 2. MESSAGE HANDLER
//    Listens for commands dispatched by the background script.
//    - EXECUTE_SCRAPE  → runs scanConversations() and returns the result
//    - SEND_REPLY      → types the draft into LinkedIn's message form
//                         and clicks the send button
// ────────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  if (request.type === 'EXECUTE_SCRAPE') {
    var result = scanConversations();
    sendResponse(result);
    return true;
  }

  if (request.type === 'SEND_REPLY') {
    // ── Find the message input field (try multiple LinkedIn selectors) ──
    var inputSelectors = [
      '.msg-form__contenteditable',
      '[data-test-message-composer] [contenteditable]',
      '.msg-form__textarea',
      'div[role="textbox"][aria-label*="message"]',
      'div[contenteditable="true"][aria-label*="message"]'
    ];

    var inputField = null;
    for (var i = 0; i < inputSelectors.length; i++) {
      inputField = document.querySelector(inputSelectors[i]);
      if (inputField) break;
    }

    // ── Find the send button ──
    var sendBtnSelectors = [
      '.msg-form__send-button',
      '[data-test-message-composer-send-button]',
      'button[aria-label*="Send"]',
      'button.msg-form__send-button'
    ];

    var sendBtn = null;
    for (var j = 0; j < sendBtnSelectors.length; j++) {
      sendBtn = document.querySelector(sendBtnSelectors[j]);
      if (sendBtn) break;
    }

    if (inputField && sendBtn) {
      inputField.textContent = request.draftReply;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));

      // Brief delay to let LinkedIn's React reconciler process the change
      setTimeout(function () {
        sendBtn.click();
      }, 500);

      sendResponse({ success: true });
    } else {
      sendResponse({
        success: false,
        error: 'Could not find the message input field or send button. LinkedIn DOM may have changed.'
      });
    }
  }
});