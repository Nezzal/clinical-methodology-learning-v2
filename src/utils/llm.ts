// src/utils/llm.ts

export type LLMProvider = "glm-5" | "qwen-max" | "qwen-plus" | "qwen-flash";

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  provider?: LLMProvider;
  timeoutMs?: number;
}

const MODEL_IDS: Record<LLMProvider, string> = {
  "glm-5":      "z-ai/glm-5.2",
  "qwen-max":   "qwen/qwen3.7-max",
  "qwen-plus":  "qwen/qwen3.7-plus",
  "qwen-flash": "qwen/qwen3.6-flash",
};

const DEFAULT_TIMEOUT = 120_000; // 2 minutes

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  options: LLMOptions = {}
): Promise<string> {
  const {
    provider = "qwen-max",
    temperature = 0.7,
    maxTokens = 8192,
    jsonMode = false,
    timeoutMs = DEFAULT_TIMEOUT,
  } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY n'est pas défini dans .env.local");
  }

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const body: Record<string, unknown> = {
    model: MODEL_IDS[provider],
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002",
        "X-Title": "RECIF-MethodoClinique",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[LLM Error] ${response.status}: ${errorBody}`);
      throw new Error(`Erreur API LLM (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Réponse vide du modèle LLM");
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callLLMChat(
  systemPrompt: string,
  conversationHistory: LLMMessage[],
  options: LLMOptions = {}
): Promise<string> {
  const {
    provider = "qwen-max",
    temperature = 0.7,
    maxTokens = 4096,
    timeoutMs = DEFAULT_TIMEOUT,
  } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY n'est pas défini dans .env.local");
  }

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002",
        "X-Title": "RECIF-MethodoClinique",
      },
      body: JSON.stringify({
        model: MODEL_IDS[provider],
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[LLM Chat Error] ${response.status}: ${errorBody}`);
      throw new Error(`Erreur API LLM Chat (${response.status})`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function streamLLM(
  systemPrompt: string,
  conversationHistory: LLMMessage[],
  options: LLMOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const {
    provider = "qwen-max",
    temperature = 0.7,
    maxTokens = 4096,
  } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY n'est pas défini dans .env.local");
  }

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002",
      "X-Title": "RECIF-MethodoClinique",
    },
    body: JSON.stringify({
      model: MODEL_IDS[provider],
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text();
    throw new Error(`Erreur stream LLM (${response.status}): ${errorBody}`);
  }

  return response.body;
}
