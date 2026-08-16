type ClarityResult =
  | { status: 'CLEAR' }
  | { status: 'VAGUE'; question: string; options: string[] };

type MicrotaskResult = {
  microtasks: string[];
};

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const TEMPERATURE = 0.2;
const MAX_TOKENS = 200;

const claritySystem =
  'You evaluate if a task description is clear or vague. ' +
  'Respond with JSON only. If vague, provide a clarification question and 3 options.';

const microtaskSystem =
  'You create up to 5 microtasks that are physical actions only. ' +
  'No invented tools and no assumptions. Respond with JSON only.';

async function callGemini(prompt: string, system: string) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
  }

  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${system}\n\n${prompt}` }],
        },
      ],
      generationConfig: {
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_TOKENS,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Gemini empty response');
  return content as string;
}

function safeJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function evaluateClarity(title: string): Promise<ClarityResult> {
  const user = `Task: "${title}". Return JSON like {"status":"CLEAR"} or {"status":"VAGUE","question":"...","options":["A","B","C"]}.`;
  const raw = await callGemini(user, claritySystem);
  const parsed = safeJson<ClarityResult>(raw);
  if (!parsed) throw new Error('Clarity parse failed');
  if (parsed.status === 'VAGUE') {
    const options = parsed.options?.filter(Boolean).slice(0, 3) ?? [];
    return {
      status: 'VAGUE',
      question: parsed.question ?? 'What exactly needs to happen?',
      options: options.length ? options : ['Do the thing', 'Plan the thing', 'Ask about the thing'],
    };
  }
  return { status: 'CLEAR' };
}

export async function generateMicrotasks(title: string): Promise<MicrotaskResult> {
  const user =
    `Task: "${title}". Return JSON like {"microtasks":["Step 1","Step 2"]}. ` +
    'Max 5 items.';
  const raw = await callGemini(user, microtaskSystem);
  const parsed = safeJson<MicrotaskResult>(raw);
  if (!parsed || !Array.isArray(parsed.microtasks)) throw new Error('Microtask parse failed');
  return {
    microtasks: parsed.microtasks.map((t) => t.trim()).filter(Boolean).slice(0, 5),
  };
}
