/**
 * AI Triage Bridge — Content Script for the Dashboard.
 *
 * Injected into the Next.js Dashboard website (localhost or Vercel deployment).
 * Acts as a secure bridge between the React application's window.postMessage
 * events and the Chrome Extension's chrome.runtime.sendMessage API.
 */

console.log('[AI Triage Bridge] Content script injected into Dashboard.');

/**
 * Validates that the message origin is from an allowed domain.
 * Only accepts messages dispatched from:
 * - localhost (any port)       — development
 * - *.vercel.app                — production deployment
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  try {
    var url = new URL(origin);
    if (url.origin === 'http://localhost' || url.origin.startsWith('http://localhost:')) return true;
    if (url.hostname.endsWith('.vercel.app')) return true;
  } catch (_) { /* malformed URL — reject */ }
  return false;
}

// ────────────────────────────────────────────────────────────────────
// 1. SCRAPE BRIDGE
//    Dashboard React dispatches EXTENSION_SCRAPE_REQUEST custom event →
//    Bridge forwards via chrome.runtime.sendMessage                     →
//    Background sends EXECUTE_SCRAPE to LinkedIn content script        →
//    LinkedIn content scrapes and returns payload                     →
//    Background returns payload                                      →
//    Bridge dispatches EXTENSION_SCRAPE_RESULT back to the React app.
// ────────────────────────────────────────────────────────────────────
window.addEventListener('EXTENSION_SCRAPE_REQUEST', function (event) {
  var detail = (event && event.detail) || {};
  var origin = detail.origin || window.location.origin;

  if (!isOriginAllowed(origin)) {
    console.warn('[Bridge] Ignoring EXTENSION_SCRAPE_REQUEST from untrusted origin:', origin);
    return;
  }

  chrome.runtime.sendMessage({ type: 'EXTENSION_SCRAPE_REQUEST' }, function (response) {
    if (chrome.runtime.lastError) {
      window.dispatchEvent(new CustomEvent('EXTENSION_SCRAPE_RESULT', {
        detail: { success: false, error: chrome.runtime.lastError.message, messages: [] }
      }));
      return;
    }
    window.dispatchEvent(new CustomEvent('EXTENSION_SCRAPE_RESULT', { detail: response }));
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. SEND REPLY BRIDGE
//    Dashboard React dispatches SEND_REPLY custom event               →
//    Bridge forwards to background via chrome.runtime.sendMessage     →
//    Background sends SEND_REPLY to LinkedIn content script           →
//    LinkedIn content injects the reply into the DOM                  →
//    Background returns result                                       →
//    Bridge dispatches SEND_REPLY_RESULT back to the React app.
// ────────────────────────────────────────────────────────────────────
window.addEventListener('SEND_REPLY', function (event) {
  var detail = (event && event.detail) || {};
  if (!detail || !detail.chatId || !detail.draftReply) return;

  var origin = detail.origin || window.location.origin;
  if (!isOriginAllowed(origin)) {
    console.warn('[Bridge] Ignoring SEND_REPLY from untrusted origin:', origin);
    return;
  }

  chrome.runtime.sendMessage({ type: 'SEND_REPLY', chatId: detail.chatId, draftReply: detail.draftReply }, function (response) {
    if (chrome.runtime.lastError) {
      window.dispatchEvent(new CustomEvent('SEND_REPLY_RESULT', {
        detail: { success: false, error: chrome.runtime.lastError.message }
      }));
      return;
    }
    window.dispatchEvent(new CustomEvent('SEND_REPLY_RESULT', { detail: response }));
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. READY SIGNAL — Two-Way Handshake
//    Fire immediately for fast loads, AND listen for a PING from the
//    React app so we can re-fire if the app loaded after this script.
// ────────────────────────────────────────────────────────────────────
window.dispatchEvent(new CustomEvent('EXTENSION_BRIDGE_READY', { detail: { ready: true } }));

window.addEventListener('EXTENSION_BRIDGE_PING', function () {
  console.log('[AI Triage Bridge] Received PING from dashboard — responding with READY.');
  window.dispatchEvent(new CustomEvent('EXTENSION_BRIDGE_READY', { detail: { ready: true } }));
});