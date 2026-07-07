"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
/* ─── LLM API Keys ─── */
const LLM_KEYS = {
    gemini: process.env.GEMINI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    cerebras: process.env.CEREBRAS_API_KEY || '',
    mistral: process.env.MISTRAL_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
};
function getAvailableModels() {
    const models = [];
    if (LLM_KEYS.gemini) {
        models.push({ name: 'Gemini 2.0 Flash', provider: 'gemini', model: 'gemini-2.0-flash', tier: 'best', endpoint: 'https://generativelanguage.googleapis.com/v1beta' });
    }
    if (LLM_KEYS.groq) {
        models.push({ name: 'Llama 3.3 70B (Groq)', provider: 'groq', model: 'llama-3.3-70b-versatile', tier: 'best', endpoint: 'https://api.groq.com/openai/v1/chat/completions' });
    }
    if (LLM_KEYS.cerebras) {
        models.push({ name: 'Llama 3.3 70B (Cerebras)', provider: 'cerebras', model: 'llama-3.3-70b', tier: 'best', endpoint: 'https://api.cerebras.ai/v1/chat/completions' });
    }
    if (LLM_KEYS.mistral) {
        models.push({ name: 'Mistral Small', provider: 'mistral', model: 'mistral-small-latest', tier: 'medium', endpoint: 'https://api.mistral.ai/v1/chat/completions' });
    }
    if (LLM_KEYS.deepseek) {
        models.push({ name: 'DeepSeek Chat', provider: 'deepseek', model: 'deepseek-chat', tier: 'medium', endpoint: 'https://api.deepseek.com/chat/completions' });
    }
    if (LLM_KEYS.gemini) {
        models.push({ name: 'Gemini 2.0 Flash Lite', provider: 'gemini', model: 'gemini-2.0-flash-lite', tier: 'medium', endpoint: 'https://generativelanguage.googleapis.com/v1beta' });
    }
    if (LLM_KEYS.groq) {
        models.push({ name: 'Llama 3.1 8B (Groq)', provider: 'groq', model: 'llama-3.1-8b-instant', tier: 'fallback', endpoint: 'https://api.groq.com/openai/v1/chat/completions' });
    }
    if (LLM_KEYS.cerebras) {
        models.push({ name: 'Llama 3.1 8B (Cerebras)', provider: 'cerebras', model: 'llama3.1-8b', tier: 'fallback', endpoint: 'https://api.cerebras.ai/v1/chat/completions' });
    }
    if (LLM_KEYS.openai) {
        models.push({ name: 'GPT-4o Mini', provider: 'openai', model: 'gpt-4o-mini', tier: 'best', endpoint: 'https://api.openai.com/v1/chat/completions' });
    }
    return models;
}
const CLASSIFICATION_PROMPT = `You are a LinkedIn message classifier and AI assistant. Your job is to categorize incoming LinkedIn messages into exactly one of four categories and generate a helpful, context-aware draft reply.

CATEGORIES:
1. IMPORTANT — The sender is discussing educational purposes, asking student questions, making a suggestion, or responding to a like, share, or comment on your post.
2. CANDIDATE — The sender is applying for a job, sharing their resume, asking about open positions, or following up on an application.
3. SALES — The sender is pitching a product or service, representing an agency, offering lead generation, or any B2B sales outreach.
4. IRRELEVANT — Generic small talk, congratulations, birthday wishes, connection acceptance, or anything else.

RULES:
- You must generate a professional, context-aware 'draftReply' ON BEHALF OF "Me".
- You MUST return valid JSON and nothing else.
- You MUST classify each message into exactly one category.

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
app.post('/api/classify', async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || messages.length === 0)
            return res.json({ success: true, classifications: [] });
        // Read the In-Context Learning File
        let fewShotExamples = '';
        const trainingPath = path_1.default.join(process.cwd(), 'data', 'training.jsonl');
        if (fs_1.default.existsSync(trainingPath)) {
            const jsonlData = fs_1.default.readFileSync(trainingPath, 'utf-8');
            const lines = jsonlData.split('\\n').filter(Boolean);
            if (lines.length > 0) {
                fewShotExamples = '\\n\\nHERE ARE SOME PAST EXAMPLES TO LEARN FROM:\\n';
                lines.forEach((line, idx) => {
                    try {
                        const parsed = JSON.parse(line);
                        const userMsg = parsed.messages.find((m) => m.role === 'user')?.content;
                        const assistantMsg = parsed.messages.find((m) => m.role === 'assistant')?.content;
                        if (userMsg && assistantMsg) {
                            fewShotExamples += `\\nExample ${idx + 1}:\\n${userMsg}\\nCategory: ${assistantMsg}\\n`;
                        }
                    }
                    catch (e) { }
                });
            }
        }
        const basePrompt = CLASSIFICATION_PROMPT + fewShotExamples;
        const userPrompt = `Classify the following LinkedIn messages:\n\n${messages
            .map((m, i) => `[Message ${i}] From: ${m.senderName}\nContent: "${m.text}"`)
            .join('\n\n')}`;
        const availableModels = getAvailableModels();
        if (availableModels.length === 0) {
            return res.json({ success: true, classifications: messages.map(() => ({ category: 'IRRELEVANT', draftReply: 'Thanks!' })) });
        }
        for (const modelConfig of availableModels) {
            try {
                console.log(`[LLM] Trying ${modelConfig.name}...`);
                const result = await callModel(modelConfig, basePrompt, userPrompt, messages.length);
                console.log(`[LLM] ✓ ${modelConfig.name} succeeded`);
                return res.json({ success: true, classifications: result });
            }
            catch (error) {
                console.warn(`[LLM] ✗ ${modelConfig.name} failed: ${error}`);
                continue;
            }
        }
        res.json({ success: true, classifications: messages.map(() => ({ category: 'IRRELEVANT', draftReply: 'Default fallback reply.' })) });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to classify messages' });
    }
});
app.post('/api/dev-login', (req, res) => {
    const { email, password } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'soumikdey666@gmail.com';
    if (email === adminEmail) { // Simple auth for prototype
        res.json({ success: true });
    }
    else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});
app.post('/api/save-training', (req, res) => {
    try {
        const { jsonlContent } = req.body;
        if (!jsonlContent)
            return res.status(400).json({ error: 'Invalid content' });
        const dataDir = path_1.default.join(process.cwd(), 'data');
        if (!fs_1.default.existsSync(dataDir))
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        const trainingPath = path_1.default.join(dataDir, 'training.jsonl');
        fs_1.default.appendFileSync(trainingPath, jsonlContent + '\\n');
        res.json({ success: true, message: 'Appended examples for auto-training.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save training data' });
    }
});
async function callModel(config, basePrompt, userPrompt, expectedCount) {
    if (config.provider === 'gemini') {
        const response = await fetch(`${config.endpoint}/models/${config.model}:generateContent?key=${LLM_KEYS.gemini}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: basePrompt + '\\n\\n' + userPrompt }] }],
                generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
            }),
        });
        if (!response.ok)
            throw new Error(await response.text());
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = JSON.parse(content);
        return parsed.classifications;
    }
    else {
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEYS[config.provider]}` },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: basePrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' },
            }),
        });
        if (!response.ok)
            throw new Error(await response.text());
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const parsed = JSON.parse(content);
        return parsed.classifications;
    }
}
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend SaaS Server running on http://localhost:${PORT}`);
});
