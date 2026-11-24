import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type {
  ActivityEntry,
  ProcessLoopResponse,
  ScrapedChat,
  LLMClassification,
} from '@/lib/types';

/* ─── Safe JSON Parser (strips markdown fences LLMs sometimes wrap responses in) ─── */
function safeJsonParse(text: string): any {
  try {
    // Strip markdown code fences if present (e.g. ```json ... ```)
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const result = JSON.parse(cleaned);
    return result && typeof result === 'object' ? result : null;
  } catch {
    return null;
  }
}

function checkApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('x-api-key');
  const expected = process.env.API_SECRET;
  if (!expected) return null;
  if (apiKey !== expected) {
    return NextResponse.json({ success: false, entries: [], processedCount: 0, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/* ─── LLM API Keys ─── */
const LLM_KEYS = {
  gemini:   process.env.GEMINI_API_KEY || '',
  groq:     process.env.GROQ_API_KEY || '',
  cerebras: process.env.CEREBRAS_API_KEY || '',
  mistral:  process.env.MISTRAL_API_KEY || '',
  deepseek: process.env.DEEPSEEK_API_KEY || '',
  openai:   process.env.OPENAI_API_KEY || '',
};

/* ─── Model Cascade (5 companies, ordered best → fallback) ─── */
type ModelProvider = 'gemini' | 'groq' | 'cerebras' | 'mistral' | 'deepseek' | 'openai';
interface ModelConfig {
  name: string;
  provider: ModelProvider;
  model: string;
  tier: 'best' | 'medium' | 'fallback';
  endpoint: string;
}

/**
 * Returns the cascade of available models based on which API keys are configured.
 * Order: Best quality first → medium → fallback
 * Diversity: Alternates between providers so a single provider outage doesn't block all top models.
 */
function getAvailableModels(): ModelConfig[] {
  const models: ModelConfig[] = [];

  // ── Tier 1: Best Quality (70B+ class models) ──
  if (LLM_KEYS.gemini) {
    models.push({
      name: 'Gemini 2.0 Flash', provider: 'gemini', model: 'gemini-2.0-flash', tier: 'best',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    });
  }
  if (LLM_KEYS.groq) {
    models.push({
      name: 'Llama 3.3 70B (Groq)', provider: 'groq', model: 'llama-3.3-70b-versatile', tier: 'best',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    });
  }
  if (LLM_KEYS.cerebras) {
    models.push({
      name: 'Llama 3.3 70B (Cerebras)', provider: 'cerebras', model: 'llama-3.3-70b', tier: 'best',
      endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    });
  }

  // ── Tier 2: Medium (high quality, reliable alternatives) ──
  if (LLM_KEYS.mistral) {
    models.push({
      name: 'Mistral Small', provider: 'mistral', model: 'mistral-small-latest', tier: 'medium',
      endpoint: 'https://api.mistral.ai/v1/chat/completions',
    });
  }
  if (LLM_KEYS.deepseek) {
    models.push({
      name: 'DeepSeek Chat', provider: 'deepseek', model: 'deepseek-chat', tier: 'medium',
      endpoint: 'https://api.deepseek.com/chat/completions',
    });
  }
  if (LLM_KEYS.gemini) {
    models.push({
      name: 'Gemini 2.0 Flash Lite', provider: 'gemini', model: 'gemini-2.0-flash-lite', tier: 'medium',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    });
  }

  // ── Tier 3: Fallback (fast, lightweight models) ──
  if (LLM_KEYS.groq) {
    models.push({
      name: 'Llama 3.1 8B (Groq)', provider: 'groq', model: 'llama-3.1-8b-instant', tier: 'fallback',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    });
  }
  if (LLM_KEYS.cerebras) {
    models.push({
      name: 'Llama 3.1 8B (Cerebras)', provider: 'cerebras', model: 'llama3.1-8b', tier: 'fallback',
      endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    });
  }

  // ── Bonus: OpenAI (paid, if configured) ──
  if (LLM_KEYS.openai) {
    models.push({
      name: 'GPT-4o Mini', provider: 'openai', model: 'gpt-4o-mini', tier: 'best',
      endpoint: 'https://api.openai.com/v1/chat/completions',
    });
  }

  return models;
}

/* ─── LLM System Prompt ─── */
const CLASSIFICATION_PROMPT = `You are a LinkedIn message classifier and AI assistant. Your job is to categorize incoming LinkedIn messages into exactly one of four categories and generate a helpful, context-aware draft reply.

CATEGORIES:
1. IMPORTANT — The sender is discussing educational purposes, asking student questions, making a suggestion, or responding to a like, share, or comment on your post.
2. CANDIDATE — The sender is applying for a job, sharing their resume, asking about open positions, or following up on an application.
3. SALES — The sender is pitching a product or service, representing an agency, offering lead generation, or any B2B sales outreach.
4. IRRELEVANT — Generic small talk, congratulations, birthday wishes, connection acceptance, or anything else.

RULES:
- The messages provided are a transcript of a chat. Lines starting with "Me:" are messages sent by the user (you). Lines starting with the sender's name are messages received by the user.
- You must generate a professional, context-aware 'draftReply' ON BEHALF OF "Me", addressing the latest message received from the sender.
- You MUST return valid JSON and nothing else.
- You MUST classify each message into exactly one category.
- If unsure, default to IRRELEVANT.
- Do not include any explanation outside the JSON structure.
- You MUST generate a professional 'draftReply' based on the context. If the category is IRRELEVANT, you can provide a short, polite closing message.

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

/* ─── Helper: Classify messages via LLM (multi-provider cascade with graceful fallback) ─── */
async function classifyMessages(
  messages: Array<{ index: number; senderName: string; text: string }>
): Promise<LLMClassification[]> {
  if (messages.length === 0) return [];

  // IN-CONTEXT LEARNING: Load saved training data if it exists
  let fewShotExamples = '';
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'training.jsonl');
    const jsonlData = await fs.readFile(filePath, 'utf-8');
    
    // Parse the JSONL to extract the User prompt and Assistant response
    const lines = jsonlData.split('\n').filter(Boolean);
    if (lines.length > 0) {
      fewShotExamples = '\n\nHERE ARE SOME PAST EXAMPLES TO LEARN FROM:\n';
      lines.forEach((line, idx) => {
        try {
          const parsed = JSON.parse(line);
          const userMsg = parsed.messages.find((m: { role: string }) => m.role === 'user')?.content;
          const assistantMsg = parsed.messages.find((m: { role: string }) => m.role === 'assistant')?.content;
          if (userMsg && assistantMsg) {
            fewShotExamples += `\nExample ${idx + 1}:\n${userMsg}\nCategory: ${assistantMsg}\n`;
          }
        } catch {
          // ignore bad JSONL line
        }
      });
      console.log(`[LLM] Injected ${lines.length} few-shot examples for auto-training.`);
    }
  } catch {
    // No training data exists yet, ignore
  }

  const basePrompt = CLASSIFICATION_PROMPT + fewShotExamples;

  const userPrompt = `Classify the following LinkedIn messages:\n\n${messages
    .map(
      (m, i) =>
        `[Message ${i}] From: ${m.senderName}\nContent: "${m.text}"`
    )
    .join('\n\n')}`;

  const availableModels = getAvailableModels();

  if (availableModels.length === 0) {
    console.warn('[LLM] No API keys configured — defaulting all to IRRELEVANT');
    return messages.map(() => ({
      category: 'IRRELEVANT',
      confidence: 1.0,
      reasoning: 'No LLM API keys configured',
      draftReply: 'Thanks for connecting! We appreciate your message. As this thread doesn\'t require further discussion, we\'ll be closing it for now. Feel free to reach out if you have specific opportunities or inquiries.',
    }));
  }

  console.log(`[LLM] ${availableModels.length} models available in cascade`);

  // Try each model in cascade order
  for (const modelConfig of availableModels) {
    try {
      console.log(`[LLM] Trying ${modelConfig.name} (${modelConfig.tier})...`);
      const result = await callModel(modelConfig, basePrompt, userPrompt, messages.length);
      console.log(`[LLM] ✓ ${modelConfig.name} succeeded`);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[LLM] ✗ ${modelConfig.name} failed: ${msg.substring(0, 150)}`);
      continue; // Always try next model regardless of error type
    }
  }

  // All models exhausted — fall back to default
  console.warn('[LLM] All models exhausted — using default classification');
  return defaultClassifications(messages.length);
}

function defaultClassifications(count: number): LLMClassification[] {
  return Array.from({ length: count }, () => ({
    category: 'IRRELEVANT' as const,
    confidence: 0,
    reasoning: 'LLM unavailable — default classification',
    draftReply: 'Thanks for connecting! We appreciate your message. As this thread doesn\'t require further discussion, we\'ll be closing it for now. Feel free to reach out if you have specific opportunities or inquiries.',
  }));
}

/* ─── Unified Model Caller ─── */
async function callModel(
  config: ModelConfig,
  basePrompt: string,
  userPrompt: string,
  expectedCount: number
): Promise<LLMClassification[]> {
  if (config.provider === 'gemini') {
    return callGeminiAPI(config, basePrompt, userPrompt, expectedCount);
  }
  // All other providers use OpenAI-compatible API format
  return callOpenAICompatibleAPI(config, basePrompt, userPrompt, expectedCount);
}

/* ─── Google Gemini API (unique format) ─── */
async function callGeminiAPI(
  config: ModelConfig,
  basePrompt: string,
  userPrompt: string,
  expectedCount: number
): Promise<LLMClassification[]> {
  const response = await fetch(
    `${config.endpoint}/models/${config.model}:generateContent?key=${LLM_KEYS.gemini}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${basePrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.name} (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error(`${config.name}: empty response`);

  const parsed = safeJsonParse(content);
  return normalizeClassifications(parsed?.classifications, expectedCount);
}

/* ─── OpenAI-Compatible API (Groq, Cerebras, Mistral, DeepSeek, OpenAI) ─── */
async function callOpenAICompatibleAPI(
  config: ModelConfig,
  basePrompt: string,
  userPrompt: string,
  expectedCount: number
): Promise<LLMClassification[]> {
  const apiKey = LLM_KEYS[config.provider];

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: basePrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.name} (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${config.name}: empty response`);

  const parsed = safeJsonParse(content);
  return normalizeClassifications(parsed?.classifications, expectedCount);
}

function normalizeClassifications(
  classifications: any,
  expectedCount: number
): LLMClassification[] {
  const validCategories = ['IMPORTANT', 'CANDIDATE', 'SALES', 'IRRELEVANT'];
  const result: LLMClassification[] = [];
  const list = Array.isArray(classifications) ? classifications : [];

  for (let i = 0; i < expectedCount; i++) {
    const cls = list[i];
    const rawCategory = (typeof cls?.category === 'string') ? cls.category.toUpperCase() : '';

    result.push({
      category: (validCategories.includes(rawCategory) ? rawCategory : 'IRRELEVANT') as LLMClassification['category'],
      confidence: typeof cls?.confidence === 'number' ? cls.confidence : 0.5,
      reasoning: cls?.reasoning || 'Classification result',
      draftReply: cls?.draftReply || "Thanks for your message. We'll be in touch.",
    });
  }

  return result;
}

/* ─── Main POST Handler ─── */
export async function POST(request: NextRequest): Promise<NextResponse<ProcessLoopResponse>> {
  const authCheck = checkApiKey(request);
  if (authCheck) return authCheck as NextResponse<ProcessLoopResponse>;

  try {
    const body = await request.json();
    const { messages } = body as { messages: ScrapedChat[]; safeMode?: boolean };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({
        success: true,
        entries: [],
        processedCount: 0,
      });
    }

    // -- Analytics Tracking (Zero-Retention) --
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true }).catch(() => {});
      const usagePath = path.join(dataDir, 'usage_analytics.jsonl');
      const logEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'CLASSIFICATION_RUN',
        modelsUsed: getAvailableModels().length
      }) + '\n';
      await fs.appendFile(usagePath, logEntry);
    } catch (e) {
      console.warn('[Analytics] Failed to write usage log:', e);
    }
    // -----------------------------------------

    // Build messages to classify from scraped chats
    const messagesToClassify = messages.map((chat, i) => {
      // Build context text from chat messages (guard against missing array)
      const chatMessages = Array.isArray(chat.messages) ? chat.messages : [];
      const chatHistoryText = chatMessages.map(m =>
        `${m.isMe ? 'Me' : chat.senderName}: ${m.text || ''}`
      ).join('\n');

      return {
        index: i,
        senderName: chat.senderName,
        text: chatHistoryText || chat.text || '',
        chatId: chat.chatId || `unknown-${i}`,
        rawHistory: chatMessages,
      };
    });

    // Filter out chats where the last message is from "Me"
    const filteredMessages = messagesToClassify.filter(msg => {
      if (!msg.rawHistory || msg.rawHistory.length === 0) return true;
      const lastMsg = msg.rawHistory[msg.rawHistory.length - 1];
      if (lastMsg?.isMe) {
        console.log(`[ProcessLoop] Skipping chat ${msg.chatId} because the last message was sent by the user.`);
        return false;
      }
      return true;
    });

    // 3. Classify via LLM (graceful — never crashes the loop)
    const classifications = await classifyMessages(filteredMessages);

    // 4. Build activity log with draft replies (no auto-send)
    const entries: ActivityEntry[] = filteredMessages.map((msg, i) => {
      const classification = classifications[i] || {
        category: 'IRRELEVANT',
        confidence: 0,
        reasoning: 'No classification returned',
        draftReply: 'Thanks for your message. We\'ll be in touch.',
      };
      const replyText = classification.draftReply;

      return {
        id: `${msg.chatId}-${Date.now()}-${i}`,
        senderName: msg.senderName,
        category: classification.category,
        action: `DRAFT: ${replyText}`,
        messagePreview: (msg.text || '').substring(0, 100).replace(/\n/g, ' '),
        timestamp: new Date().toISOString(),
        chatId: msg.chatId,
        chatHistory: msg.rawHistory,
        draftReply: replyText,
        sent: false,
      };
    });

    return NextResponse.json({
      success: true,
      entries,
      processedCount: entries.length,
    });
  } catch (error) {
    console.error('[ProcessLoop] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        entries: [],
        processedCount: 0,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
