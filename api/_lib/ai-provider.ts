function readEnvKey(...keys: string[]) {
  for (const key of keys) {
    const value = (process.env[key] || '').trim().replace(/^["']|["']$/g, '');
    if (value) return value;
  }
  return '';
}

import { DEFAULT_OPENROUTER_MODELS, sanitizeModels } from './openrouter-models.js';

const GEMINI_API_KEY = readEnvKey('GEMINI_API_KEY', 'VITE_GEMINI_API_KEY');
const OPENROUTER_API_KEY = readEnvKey('OPENROUTER_API_KEY', 'VITE_OPENROUTER_API_KEY');

// OPENROUTER_MODEL may be a single id or a comma-separated fallback list.
// Falls back to the curated DEFAULT_OPENROUTER_MODELS when unset.
const OPENROUTER_ENV_MODELS = sanitizeModels(
  readEnvKey('OPENROUTER_MODEL', 'VITE_OPENROUTER_MODEL').split(',').map((m) => m.trim()).filter(Boolean),
  DEFAULT_OPENROUTER_MODELS,
);

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const AI_TIMEOUT_MS = 45000;
const OPENROUTER_TIMEOUT_MS = Number(readEnvKey('OPENROUTER_TIMEOUT_MS')) || 30000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function providerError(provider: string, status?: number) {
  return status ? `${provider} returned ${status}` : `${provider} did not return usable content`;
}

async function providerStatusError(provider: string, response: Response) {
  const details = await response.text().catch(() => '');
  const normalizedDetails = details.replace(/\s+/g, ' ').trim().slice(0, 240);
  return normalizedDetails
    ? `${provider} returned ${response.status}: ${normalizedDetails}`
    : providerError(provider, response.status);
}

export function cleanJsonText(text: string) {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

export async function generateAiText(prompt: string, options?: {
  openRouterModels?: string[];
  providerOrder?: 'default' | 'openrouter_first';
  maxOpenRouterModels?: number;
  openRouterTimeoutMs?: number;
  skipGemini?: boolean;
}) {
  const providerErrors: string[] = [];
  const openRouterModels = sanitizeModels(options?.openRouterModels, OPENROUTER_ENV_MODELS)
    .slice(0, Math.max(1, Math.min(4, Math.round(options?.maxOpenRouterModels || 4))));
  const openRouterFirst = options?.providerOrder === 'openrouter_first';
  const openRouterTimeoutMs = Math.max(8000, Math.min(OPENROUTER_TIMEOUT_MS, Number(options?.openRouterTimeoutMs) || OPENROUTER_TIMEOUT_MS));

  async function tryOpenRouter() {
    if (!OPENROUTER_API_KEY) return null;

    // Try each OpenRouter model in order until one returns usable content.
    for (const model of openRouterModels) {
      try {
        const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{
              role: 'user',
              content: `${prompt}\n\nIMPORTANT: Return ONLY valid JSON when JSON is requested. Do not use markdown code blocks.`,
            }],
          }),
        }, openRouterTimeoutMs);

        if (!response.ok) {
          providerErrors.push(await providerStatusError(`OpenRouter[${model}]`, response));
          continue;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) {
          providerErrors.push(providerError(`OpenRouter[${model}]`));
          continue;
        }

        return { text: cleanJsonText(text), providerErrors };
      } catch (err: any) {
        providerErrors.push(err?.name === 'AbortError'
          ? `OpenRouter[${model}] timed out`
          : `OpenRouter[${model}] request failed`);
      }
    }

    return null;
  }

  async function tryGemini() {
    if (options?.skipGemini) {
      providerErrors.push('Gemini skipped for this request');
      return null;
    }
    if (!GEMINI_API_KEY) {
      providerErrors.push('Gemini key is not configured');
      return null;
    }

    try {
      const response = await fetchWithTimeout(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 4096,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text, providerErrors };
        providerErrors.push(providerError('Gemini'));
      } else {
        providerErrors.push(providerError('Gemini', response.status));
      }
    } catch (err: any) {
      providerErrors.push(err?.name === 'AbortError' ? 'Gemini timed out' : 'Gemini request failed');
    }

    return null;
  }

  if (openRouterFirst) {
    const openRouterResult = await tryOpenRouter();
    if (openRouterResult) return openRouterResult;
    const geminiResult = await tryGemini();
    if (geminiResult) return geminiResult;
    throw new Error(providerErrors.join(' | ') || 'Nenhum provedor de IA retornou conteudo.');
  } else {
    const geminiResult = await tryGemini();
    if (geminiResult) return geminiResult;
  }

  if (!OPENROUTER_API_KEY && !GEMINI_API_KEY) {
    throw new Error(`IA nao configurada neste ambiente. Configure GEMINI_API_KEY, VITE_GEMINI_API_KEY, OPENROUTER_API_KEY ou VITE_OPENROUTER_API_KEY para gerar conteudos. ${providerErrors.join(' | ')}`);
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error(providerErrors.join(' | ') || 'Nenhum provedor de IA retornou conteudo.');
  }

  const openRouterResult = await tryOpenRouter();
  if (openRouterResult) return openRouterResult;

  throw new Error(providerErrors.join(' | ') || 'Nenhum provedor de IA retornou conteudo.');
}
