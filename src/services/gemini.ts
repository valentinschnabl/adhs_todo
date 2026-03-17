import { getGeminiApiKey } from './env';
import { useUserStore } from '../store/useUserStore';
import {
  buildClarityUserPrompt,
  buildMicrotaskUserPrompt,
  CLARITY_SCHEMA,
  CLARITY_SYSTEM_PROMPT,
  MICROTASK_SCHEMA,
  MICROTASK_SYSTEM_PROMPT,
} from './geminiPrompts';

export interface ClarityResponse {
  result: 'CLEAR' | 'VAGUE';
  question: string | null;
  options: string[] | null;
}

const GEMINI_MODEL = 'gemini-1.5-flash';

interface GeminiCallOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  schema: object;
  timeoutMs: number;
  label: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
  }>;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (timedOut) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function geminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

function buildGeminiRequest(systemPrompt: string, userPrompt: string, schema: object) {
  return {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 200,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };
}

function extractGeminiText(data: GeminiGenerateContentResponse): unknown | null {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

function parseGeminiPayload<T>(content: unknown): T {
  if (typeof content === 'string') {
    return JSON.parse(content) as T;
  }

  if (content && typeof content === 'object') {
    return content as T;
  }

  throw new Error('Unexpected Gemini response payload type');
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('timed out')
    || message.includes('abort')
    || message.includes('network')
    || message.includes('failed to fetch')
  );
}

async function callGemini<T>({
  apiKey,
  systemPrompt,
  userPrompt,
  schema,
  timeoutMs,
  label,
}: GeminiCallOptions): Promise<T> {
  const maxRetries = 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${label} Request started`, { userPrompt });
      const response = await fetchWithTimeout(
        geminiUrl(apiKey),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildGeminiRequest(systemPrompt, userPrompt, schema)),
        },
        timeoutMs
      );

      if (!response.ok) {
        const apiError = new Error(`API error ${response.status}: ${response.statusText}`);
        lastError = apiError;
        if (response.status >= 500 && attempt < maxRetries) {
          continue;
        }
        throw apiError;
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const content = extractGeminiText(data);
      if (!content) {
        throw new Error('No content in response');
      }

      return parseGeminiPayload<T>(content);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isRetryableError(error)) {
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini call failed');
}

export async function checkClarity(taskTitle: string): Promise<ClarityResponse> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  const userPrompt = buildClarityUserPrompt(taskTitle);

  try {
    const parsed = await callGemini<ClarityResponse>({
      apiKey,
      systemPrompt: CLARITY_SYSTEM_PROMPT,
      userPrompt,
      schema: CLARITY_SCHEMA,
      timeoutMs: 5000,
      label: '[AI][Clarity]',
    });
    useUserStore.getState().incrementAIClarity();
    console.log('[AI][Clarity] Parsed response', parsed);
    return parsed;
  } catch (error) {
    console.error('[AI][Clarity] Failed', error);
    throw error;
  }
}

export async function generateMicrotasks(taskTitle: string): Promise<string[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  const userPrompt = buildMicrotaskUserPrompt(taskTitle);

  try {
    const parsed = await callGemini<{ steps: string[] }>({
      apiKey,
      systemPrompt: MICROTASK_SYSTEM_PROMPT,
      userPrompt,
      schema: MICROTASK_SCHEMA,
      timeoutMs: 5000,
      label: '[AI][Microtasks]',
    });
    useUserStore.getState().incrementAIMicrotask();
    console.log('[AI][Microtasks] Parsed response', parsed.steps);
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('Empty steps array in response');
    }
    return parsed.steps;
  } catch (error) {
    console.error('[AI][Microtasks] Failed', error);
    throw error;
  }
}