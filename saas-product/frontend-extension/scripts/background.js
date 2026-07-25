/// <reference types="chrome"/>

// ── On extension install: open the Privacy & Transparency Website ──
chrome.runtime.onInstalled.addListener(function () {
  chrome.tabs.create({ url:     "https://linkedin-triage.vercel.app" });
});

// ── On extension icon click: open the AI Triage Dashboard ──
chrome.action.onClicked.addListener(function () {
  chrome.tabs.create({ url:     "https://linkedin-triage.vercel.app" });
});

// ── Message Router ──
// Receives messages from content-dashboard.js (the bridge script) and
// content-linkedin.js (the scraper), then routes them appropriately.
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  // ── Dashboard → LinkedIn scrape ──
  // content-dashboard.js sends this when the user triggers a scrape from the dashboard.
  if (request.type === 'EXTENSION_SCRAPE_REQUEST') {
    handleScrapeRequest().then(sendResponse);
    return true; // keep the message channel open for async response
  }

  // ── Dashboard → LinkedIn reply injection ──
  // content-dashboard.js sends this when the user approves a draft reply.
  if (request.type === 'SEND_REPLY') {
    handleSendReply(request.chatId, request.draftReply).then(sendResponse);
    return true;
  }
});

/**
 * Finds or opens a LinkedIn messaging tab, then sends an EXECUTE_SCRAPE
 * command to content-linkedin.js on that tab.
 */
async function handleScrapeRequest() {
  try {
    // 1. Find an existing LinkedIn tab, or open one to messaging
    var tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    var linkedInTabId;

    if (tabs.length > 0 && tabs[0].id) {
      linkedInTabId = tabs[0].id;
      // Bring it to the foreground so DOM scrapers work reliably
      await chrome.tabs.update(linkedInTabId, { active: true });
    } else {
      var tab = await chrome.tabs.create({ url: 'https://www.linkedin.com/messaging/' });
      linkedInTabId = tab.id;
      // Wait for the LinkedIn page to render
      await new Promise(function (resolve) { setTimeout(resolve, 5000); });
    }

    // 2. Send the scrape command to content-linkedin.js on the LinkedIn tab
    return new Promise(function (resolve) {
      chrome.tabs.sendMessage(linkedInTabId, { type: 'EXECUTE_SCRAPE' }, function (response) {
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

/**
 * Finds an active LinkedIn tab and sends a SEND_REPLY command to
 * content-linkedin.js so it can inject the drafted reply into the DOM.
 */
async function handleSendReply(chatId, draftReply) {
  try {
    var tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    var linkedInTabId;

    if (tabs.length > 0 && tabs[0].id) {
      linkedInTabId = tabs[0].id;
      await chrome.tabs.update(linkedInTabId, { active: true });
      await new Promise(function (resolve) { setTimeout(resolve, 2000); });
    } else {
      return { success: false, error: 'No LinkedIn tab open' };
    }

    return new Promise(function (resolve) {
      chrome.tabs.sendMessage(linkedInTabId, { type: 'SEND_REPLY', chatId: chatId, draftReply: draftReply }, function (response) {
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