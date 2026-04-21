// ============================================================
// Made by Human — Gemini AI Service
// ============================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

async function callAI(prompt: string): Promise<string> {
  // First try Gemini
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

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    
    return text;
  } catch (err: any) {
    console.warn('Gemini failed, trying OpenRouter fallback...', err.message);
    
    // Fallback to OpenRouter
    if (!OPENROUTER_API_KEY) {
      throw new Error('Gemini failed and no OpenRouter API key found.');
    }

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-2-9b-it:free', // Using a reliable free model
        messages: [{ role: 'user', content: prompt + '\n\nIMPORTANT: Return ONLY valid JSON, nothing else.' }]
      })
    });

    if (!openRouterResponse.ok) {
      const orErr = await openRouterResponse.text();
      throw new Error(`OpenRouter API error: ${openRouterResponse.status} - ${orErr}`);
    }

    const orData = await openRouterResponse.json();
    let orText = orData.choices?.[0]?.message?.content;
    
    if (!orText) throw new Error('Empty response from OpenRouter');

    // Clean up markdown code blocks if the model wrapped the JSON
    orText = orText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return orText;
  }
}

// ---- Generate Hooks ----

export async function generateHooks(params: {
  niche: string;
  narrativePrompt: string;
  knowledgeBase?: string;
  count?: number;
}): Promise<string[]> {
  const { niche, narrativePrompt, knowledgeBase, count = 10 } = params;

  const prompt = `You are a TikTok/Instagram Reels content strategist.

Generate ${count} unique slideshow hook ideas for the niche "${niche}".

Narrative style: ${narrativePrompt}

${knowledgeBase ? `Brand knowledge base:\n${knowledgeBase}\n` : ''}

Each hook should be a short, attention-grabbing first-slide text that would make someone swipe to see more.
Think of hooks that provoke curiosity, reveal a surprising fact, or promise a transformation.

Return a JSON array of strings. Example:
["Hook 1 text", "Hook 2 text", ...]

Return ONLY the JSON array, no other text.`;

  const text = await callAI(prompt);
  const hooks: string[] = JSON.parse(text);
  return hooks;
}

// ---- Generate Slideshow ----

export interface GeneratedSlide {
  type: 'hook' | 'body';
  text: string;
}

export async function generateSlideshow(params: {
  hookText: string;
  niche: string;
  narrativePrompt: string;
  formatPrompt: string;
  softCta?: string;
  knowledgeBase?: string;
  slideCount?: number;
}): Promise<{ slides: GeneratedSlide[]; caption: string }> {
  const {
    hookText, niche, narrativePrompt, formatPrompt,
    softCta, knowledgeBase, slideCount = 5,
  } = params;

  const prompt = `You are a TikTok/Instagram slideshow content writer.

Create a ${slideCount}-slide carousel for the niche "${niche}".

The first slide (hook) text is: "${hookText}"

Narrative style: ${narrativePrompt}
Format rules: ${formatPrompt}
${softCta ? `Soft CTA for the last slide: ${softCta}` : ''}
${knowledgeBase ? `Brand knowledge base:\n${knowledgeBase}\n` : ''}

Rules:
- Slide 1 is always the hook (already provided)
- Slides 2 to ${slideCount - 1} are body slides that deliver value
- The last slide should have a soft call-to-action
- Each slide text should be concise (max 3 short lines)
- Use the narrative style consistently
- Make it feel native to TikTok/Instagram

Return a JSON object with this exact structure:
{
  "slides": [
    {"type": "hook", "text": "${hookText}"},
    {"type": "body", "text": "Slide 2 text..."},
    {"type": "body", "text": "Slide 3 text..."},
    {"type": "body", "text": "Slide 4 text..."},
    {"type": "body", "text": "Slide 5 text with CTA..."}
  ],
  "caption": "A short engaging TikTok caption with relevant hashtags"
}

Return ONLY the JSON object.`;

  const text = await callAI(prompt);
  const result = JSON.parse(text);
  return result;
}
