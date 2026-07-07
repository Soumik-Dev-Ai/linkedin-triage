/// <reference types="chrome"/>

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROCESS_MESSAGE') {
    handleProcessMessage(request.data).then(sendResponse);
    return true; // Keep the message channel open for async response
  }
});

async function handleProcessMessage(messages: any[]) {
  try {
    // Send to the robust Next.js / Node Backend that holds the API keys and the Multi-LLM Cascade
    const response = await fetch('http://localhost:3001/api/classify', {
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
