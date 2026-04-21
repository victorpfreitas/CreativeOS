const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  console.log('[AI API] Attempting call. Gemini Key:', !!GEMINI_API_KEY, '| OpenRouter Key:', !!OPENROUTER_API_KEY);

  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return res.status(200).json({ text });
      }
    } catch {
      // fall through to OpenRouter
    }
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'No AI provider available. Set GEMINI_API_KEY or OPENROUTER_API_KEY.' });
  }

  try {
    const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.5:free',
        messages: [{
          role: 'user',
          content: prompt + '\n\nIMPORTANT: Return ONLY valid JSON, nothing else. DO NOT use markdown code blocks like ```json. Just raw json.',
        }],
      }),
    });

    if (!orResponse.ok) {
      throw new Error(`OpenRouter error: ${orResponse.status}`);
    }

    const orData = await orResponse.json();
    let text = orData.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty OpenRouter response');

    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return res.status(200).json({ text });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'All AI providers failed' });
  }
}
