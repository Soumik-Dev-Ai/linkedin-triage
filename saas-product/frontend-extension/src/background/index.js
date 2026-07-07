/// <reference types="chrome"/>
import { CATEGORY_REPLIES } from '../lib/types';
const CLASSIFICATION_PROMPT = `You are a LinkedIn message classifier and AI assistant. Your job is to categorize incoming LinkedIn messages into exactly one of four categories and generate a helpful, context-aware draft reply.

CATEGORIES:
1. IMPORTANT — The sender is discussing educational purposes, asking student questions, making a suggestion, or responding to a like, share, or comment on your post.
2. CANDIDATE — The sender is applying for a job, sharing their resume, asking about open positions, or following up on an application.
3. SALES — The sender is pitching a product or service, representing an agency, offering lead generation, or any B2B sales outreach.
4. IRRELEVANT — Generic small talk, congratulations, birthday wishes, connection acceptance, or anything else.

RULES:
- The messages provided are a transcript of a chat.
- You must generate a professional, context-aware 'draftReply' ON BEHALF OF "Me".
- You MUST return valid JSON and nothing else.
- You MUST classify each message into exactly one category.
- If unsure, default to IRRELEVANT.

RESPONSE FORMAT (strict JSON):
{
  "classifications": [
    {
      "index": 0,
      "category": "IMPORTANT" | "CANDIDATE" | "SALES" | "IRRELEVANT",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation",
      "draftReply": "The generated reply text here..."
    }
  ]
}`;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'PROCESS_MESSAGE') {
        handleProcessMessage(request.data).then(sendResponse);
        return true; // Keep the message channel open for async response
    }
});
async function handleProcessMessage(messages) {
    try {
        // In a real extension, we would get the API key from chrome.storage.local
        // For this prototype, the user will need to configure it in the extension options
        const result = await chrome.storage.local.get(['geminiApiKey']);
        const apiKey = result.geminiApiKey;
        if (!apiKey) {
            return {
                success: false,
                error: 'API key not configured in extension settings',
                fallback: { category: 'IRRELEVANT', draftReply: CATEGORY_REPLIES.IRRELEVANT }
            };
        }
        const userPrompt = `Classify the following LinkedIn messages:\n\n${messages
            .map((m, i) => `[Message ${i}] From: ${m.senderName}\nContent: "${m.text}"`)
            .join('\n\n')}`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: CLASSIFICATION_PROMPT + '\n\n' + userPrompt }] }],
                generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
            }),
        });
        if (!response.ok)
            throw new Error('API request failed');
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = JSON.parse(content);
        return { success: true, classifications: parsed.classifications };
    }
    catch (err) {
        console.error('LLM Error:', err);
        return {
            success: false,
            error: 'Failed to classify',
            fallback: { category: 'IRRELEVANT', draftReply: CATEGORY_REPLIES.IRRELEVANT }
        };
    }
}
