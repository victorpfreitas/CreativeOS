import { generateAiText } from './_lib/ai-provider';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const { text } = await generateAiText(prompt);
    return res.status(200).json({ text });
  } catch (err: any) {
    const status = err?.message?.includes('IA nao configurada') ? 503 : 502;
    return res.status(status).json({ error: err instanceof Error ? err.message : 'Falha ao chamar a IA.' });
  }
}
