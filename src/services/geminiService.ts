// ============================================================
// Made by Human — Gemini AI Service
// ============================================================

async function callAI(prompt: string): Promise<string> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.text;
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
  try {
    const hooks: string[] = JSON.parse(text);
    return hooks;
  } catch {
    throw new Error('AI returned invalid JSON for hooks. Please try again.');
  }
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
  try {
    const result = JSON.parse(text);
    return result;
  } catch {
    throw new Error('AI returned invalid JSON for slideshow. Please try again.');
  }
}
