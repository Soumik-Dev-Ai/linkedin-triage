console.log('[AI Triage Bridge] Injected into Dashboard.');

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.origin === 'http://localhost' || url.origin.startsWith('http://localhost:')) return true;
    if (url.hostname.endsWith('.vercel.app')) return true;
  } catch { }
  return false;
}

window.addEventListener('EXTENSION_SCRAPE_REQUEST', (event: Event) => {
  if (!isOriginAllowed((event as CustomEvent).detail?.origin || window.location.origin)) {
    console.warn('[Bridge] Ignoring request from untrusted origin');
    return;
  }

  chrome.runtime.sendMessage({ type: 'EXTENSION_SCRAPE_REQUEST' }, (response) => {
    if (chrome.runtime.lastError) {
      window.dispatchEvent(new CustomEvent('EXTENSION_SCRAPE_RESULT', {
        detail: { success: false, error: chrome.runtime.lastError.message, messages: [] }
      }));
      return;
    }
    window.dispatchEvent(new CustomEvent('EXTENSION_SCRAPE_RESULT', { detail: response }));
  });
});

window.addEventListener('SEND_REPLY', (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (!detail || !detail.chatId || !detail.draftReply) return;
  if (!isOriginAllowed(detail.origin || window.location.origin)) return;

  chrome.runtime.sendMessage({ type: 'SEND_REPLY', chatId: detail.chatId, draftReply: detail.draftReply }, (response) => {
    window.dispatchEvent(new CustomEvent('SEND_REPLY_RESULT', { detail: response }));
  });
});

window.dispatchEvent(new CustomEvent('EXTENSION_BRIDGE_READY', { detail: { ready: true } }));
