import { generateAiText } from './_lib/ai-provider.js';
import { DEFAULT_OPENROUTER_MODELS } from './_lib/openrouter-models.js';

const MAX_PROMPT_LENGTH = 100_000;

export default async function handler(req: any, res: any) {
  // Expose the preset catalog so the Settings page can offer quick-add suggestions.
  if (req.method === 'GET') {
    return res.status(200).json({ models: DEFAULT_OPENROUTER_MODELS });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, models, providerOrder, maxOpenRouterModels, openRouterTimeoutMs, skipGemini } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(413).json({ error: 'Prompt muito longo.' });
  }

  try {
    const { text } = await generateAiText(prompt, {
      openRouterModels: models,
      providerOrder: providerOrder === 'openrouter_first' ? 'openrouter_first' : 'default',
      maxOpenRouterModels: Number(maxOpenRouterModels) || undefined,
      openRouterTimeoutMs: Number(openRouterTimeoutMs) || undefined,
      skipGemini: Boolean(skipGemini),
    });
    return res.status(200).json({ text });
  } catch (err: any) {
    const status = err?.message?.includes('IA nao configurada') ? 503 : 502;
    return res.status(status).json({ error: err instanceof Error ? err.message : 'Falha ao chamar a IA.' });
  }
}
