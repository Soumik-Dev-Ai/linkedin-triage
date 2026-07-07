// This script is injected into the Next.js Dashboard website (localhost or Vercel).
// It acts as a bridge between the website's DOM and the Chrome Extension's background script.

console.log('LinkedIn Triage Bridge Script injected.');

// 1. Listen for the Website dispatching the START_SCRAPE command
window.addEventListener('START_SCRAPE', () => {
  console.log('[Bridge] Received START_SCRAPE from Website. Forwarding to Extension Background...');
  
  chrome.runtime.sendMessage({ type: 'TRIGGER_LINKEDIN_SCRAPE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Bridge] Extension Error:', chrome.runtime.lastError);
      window.dispatchEvent(new CustomEvent('SCRAPE_RESULTS', { 
        detail: { success: false, error: chrome.runtime.lastError.message } 
      }));
      return;
    }

    if (response) {
      console.log('[Bridge] Received response from Background. Sending back to Website...');
      // 2. Dispatch the result back to the Website's React state
      window.dispatchEvent(new CustomEvent('SCRAPE_RESULTS', { detail: response }));
    }
  });
});
