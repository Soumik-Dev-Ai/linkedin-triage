/// <reference types="chrome"/>

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'http://localhost:3000' });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTENSION_SCRAPE_REQUEST') {
    handleScrapeRequest().then(sendResponse);
    return true;
  }

  if (request.type === 'SEND_REPLY') {
    handleSendReply(request.chatId, request.draftReply, sender.tab?.id).then(sendResponse);
    return true;
  }
});

async function handleScrapeRequest() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    let linkedInTabId: number;
    if (tabs.length > 0 && tabs[0].id) {
      linkedInTabId = tabs[0].id;
      await chrome.tabs.update(linkedInTabId, { active: true });
    } else {
      const tab = await chrome.tabs.create({ url: 'https://www.linkedin.com/messaging/' });
      linkedInTabId = tab.id!;
      await new Promise(r => setTimeout(r, 5000));
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(linkedInTabId, { type: 'EXECUTE_SCRAPE' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message, messages: [] });
        } else {
          resolve(response);
        }
      });
    });
  } catch (err) {
    return { success: false, error: String(err), messages: [] };
  }
}

async function handleSendReply(chatId: string, draftReply: string, _sourceTabId?: number) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    let linkedInTabId: number;
    if (tabs.length > 0 && tabs[0].id) {
      linkedInTabId = tabs[0].id;
      await chrome.tabs.update(linkedInTabId, { active: true });
      await new Promise(r => setTimeout(r, 2000));
    } else {
      return { success: false, error: 'No LinkedIn tab open' };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(linkedInTabId, { type: 'SEND_REPLY', chatId, draftReply }, (response) => {
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
