/// <reference types="chrome"/>

chrome.action.onClicked.addListener(() => {
  // Redirect to the deployed Next.js Dashboard
  chrome.tabs.create({ url: 'https://linkedin-triage.vercel.app' });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROCESS_MESSAGE') {
    handleProcessMessage(request.data).then(sendResponse);
    return true; // Keep the message channel open for async response
  }

  if (request.type === 'TRIGGER_LINKEDIN_SCRAPE') {
    handleLinkedInScrape().then(sendResponse);
    return true;
  }
});

async function handleLinkedInScrape() {
  try {
    // 1. Find the active LinkedIn tab, or open one if it doesn't exist
    const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
    
    let linkedInTabId: number;
    if (tabs.length > 0 && tabs[0].id) {
      linkedInTabId = tabs[0].id;
      // Make it active so DOM scrapers work reliably
      await chrome.tabs.update(linkedInTabId, { active: true });
    } else {
      const newTab = await chrome.tabs.create({ url: 'https://www.linkedin.com/messaging/' });
      linkedInTabId = newTab.id!;
      // Wait for tab to load
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 2. Request the content script on that tab to execute scrape
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(linkedInTabId, { type: 'EXECUTE_SCRAPE' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function handleProcessMessage(messages: any[]) {
  try {
    // Send to the robust Next.js / Node Backend that holds the API keys and the Multi-LLM Cascade
    const response = await fetch('https://linkedin-triage.onrender.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) throw new Error('Backend API request failed');

    const data = await response.json();
    return data; // { success: true, classifications: [...] }
  } catch (err) {
    console.error('Extension Network Error:', err);
    return { 
      success: false, 
      error: 'Failed to connect to backend',
      fallback: { category: 'IRRELEVANT', draftReply: 'Error connecting to server.' }
    };
  }
}
