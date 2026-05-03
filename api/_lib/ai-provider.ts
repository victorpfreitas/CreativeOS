const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const AI_TIMEOUT_MS = 45000;

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

export function cleanJsonText(text: string) {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

export async function generateAiText(prompt: string) {
  const providerErrors: string[] = [];

  if (GEMINI_API_KEY) {
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
  } else {
    providerErrors.push('Gemini key is not configured');
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error(`IA nao configurada neste ambiente. Configure GEMINI_API_KEY, VITE_GEMINI_API_KEY, OPENROUTER_API_KEY ou VITE_OPENROUTER_API_KEY para gerar carrosseis. ${providerErrors.join(' | ')}`);
  }

  try {
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.5:free',
        messages: [{
          role: 'user',
          content: `${prompt}\n\nIMPORTANT: Return ONLY valid JSON when JSON is requested. Do not use markdown code blocks.`,
        }],
      }),
    });

    if (!response.ok) {
      providerErrors.push(providerError('OpenRouter', response.status));
      throw new Error(providerErrors.join(' | '));
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      providerErrors.push(providerError('OpenRouter'));
      throw new Error(providerErrors.join(' | '));
    }

    return { text: cleanJsonText(text), providerErrors };
  } catch (err: any) {
    if (err instanceof Error && err.message) throw err;
    providerErrors.push(err?.name === 'AbortError' ? 'OpenRouter timed out' : 'OpenRouter request failed');
    throw new Error(providerErrors.join(' | '));
  }
}
