// ============================================================
// Made by Human — Gemini AI Service
// ============================================================

import type { BrandDNA, ContentAnalysis, ContentPlanItem } from '../lib/types';

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

// ---- Brand DNA Compiler ----

export function compileBrandDNA(dna: BrandDNA): string {
  const parts: string[] = [];
  if (dna.bio) parts.push(`Bio do perfil: ${dna.bio}`);
  if (dna.bio_link) parts.push(`Link da bio: ${dna.bio_link}`);
  if (dna.market) parts.push(`Mercado / Nicho: ${dna.market}`);
  if (dna.content_pillars) parts.push(`Pilares de conteúdo: ${dna.content_pillars}`);
  if (dna.target_audience) parts.push(`Audiência-alvo: ${dna.target_audience}`);
  if (dna.tone_of_voice) parts.push(`Tom de voz: ${dna.tone_of_voice}`);
  if (dna.key_messages) parts.push(`Mensagens-chave: ${dna.key_messages}`);
  if (dna.brand_colors) parts.push(`Cores da marca: ${dna.brand_colors}`);
  if (dna.visual_references) parts.push(`Referências visuais: ${dna.visual_references}`);
  if (dna.competitors) parts.push(`Concorrentes (para se diferenciar): ${dna.competitors}`);
  return parts.join('\n');
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

// ---- Regenerate Single Slide ----

export async function regenerateSlide(params: {
  slideIndex: number;
  currentText: string;
  hookText: string;
  niche: string;
  narrativePrompt: string;
  knowledgeBase?: string;
}): Promise<string> {
  const { slideIndex, currentText, hookText, niche, narrativePrompt, knowledgeBase } = params;

  const prompt = `You are a TikTok/Instagram content writer.

Rewrite slide ${slideIndex + 1} of a carousel about the niche "${niche}".

The carousel hook (slide 1) is: "${hookText}"
Current text of slide ${slideIndex + 1}: "${currentText}"

Narrative style: ${narrativePrompt}
${knowledgeBase ? `Brand knowledge base:\n${knowledgeBase}\n` : ''}

Write a better version of this slide. Keep it concise (max 3 short lines), punchy, and consistent with the hook and narrative style.

Return ONLY the new slide text, no JSON, no quotes, no explanation.`;

  const text = await callAI(prompt);
  return text.trim();
}

// ---- Analyze Content ----

export async function analyzeContent(params: {
  rawData: string;
  knowledgeBase?: string;
  language?: string;
}): Promise<ContentAnalysis['insights']> {
  const { rawData, knowledgeBase, language = 'pt-BR' } = params;

  const prompt = `You are a social media content strategist.

Analyze the following content performance data from a creator's profile and generate strategic insights.

${knowledgeBase ? `Brand DNA:\n${knowledgeBase}\n\n` : ''}

Content data (may be CSV, JSON, or free text with post metrics):
---
${rawData}
---

Based on this data, generate a comprehensive analysis in ${language}.

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentences summarizing overall content performance and main finding",
  "best_performers": [
    "Description of top performing content and WHY it worked (pattern, format, topic, hook style)",
    "..."
  ],
  "worst_performers": [
    "Description of underperforming content and WHY it failed",
    "..."
  ],
  "patterns": [
    "Specific pattern identified (e.g. posts about X get 3x more saves than posts about Y)",
    "..."
  ],
  "recommendations": [
    "Concrete recommendation based on data (e.g. Double down on topic X, avoid format Y)",
    "..."
  ],
  "content_ideas": [
    "Specific content idea inspired by what worked",
    "..."
  ]
}

Include at least 3 items in each array. Be specific and actionable.
Return ONLY the JSON object.`;

  const text = await callAI(prompt);
  try {
    const result = JSON.parse(text);
    return result;
  } catch {
    throw new Error('AI returned invalid JSON for analysis. Please try again.');
  }
}

// ---- Generate Weekly Plan ----

export async function generateWeeklyPlan(params: {
  projectName: string;
  knowledgeBase?: string;
  automations: Array<{ id: string; name: string; niche: string }>;
  insights?: string;
  weekDays?: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>;
}): Promise<ContentPlanItem[]> {
  const { projectName, knowledgeBase, automations, insights, weekDays = ['mon', 'wed', 'fri'] } = params;

  const dayLabels: Record<string, string> = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
    thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  };

  const automationList = automations.map((a) => `- id: ${a.id} | name: ${a.name} | niche: ${a.niche}`).join('\n');

  const prompt = `You are a social media content strategist.

Create a weekly content plan for "${projectName}" for ${weekDays.length} posting days.

${knowledgeBase ? `Brand DNA:\n${knowledgeBase}\n` : ''}
${insights ? `Content performance insights:\n${insights}\n` : ''}

Available automations (content systems):
${automationList}

Posting days: ${weekDays.map((d) => dayLabels[d]).join(', ')}

For each day, suggest a content topic and a hook idea, and assign the most relevant automation.

Return a JSON array with this exact structure:
[
  {
    "day": "mon",
    "topic": "Clear topic for this day's post",
    "hook_suggestion": "An attention-grabbing hook for the first slide",
    "automation_id": "the automation id that best fits this topic",
    "status": "planned"
  }
]

Return ONLY the JSON array. Include exactly ${weekDays.length} items, one per posting day.`;

  const text = await callAI(prompt);
  try {
    const result: ContentPlanItem[] = JSON.parse(text);
    return result;
  } catch {
    throw new Error('AI returned invalid JSON for weekly plan. Please try again.');
  }
}
// ---- Generate Brand DNA ----

export async function generateBrandDNA(params: {
  rawData: string;
  language?: string;
}): Promise<BrandDNA> {
  const { rawData, language = 'pt-BR' } = params;

  const prompt = `You are a branding and marketing strategist.

Analyze the following raw information about a brand/creator and extract a structured Brand DNA.

Raw information:
---
${rawData}
---

Generate a comprehensive Brand DNA in ${language}.

Return a JSON object with this exact structure:
{
  "bio": "A concise, professional bio for social media (max 160 chars)",
  "bio_link": "A likely URL if found, or empty string",
  "market": "The primary niche and target market",
  "content_pillars": "3-5 key content topics, comma-separated",
  "target_audience": "Detailed description of the ideal follower/customer",
  "tone_of_voice": "Description of how the brand communicates (adjectives and style)",
  "key_messages": "Core messages the brand always communicates",
  "brand_colors": "Suggested or identified brand colors",
  "visual_references": "Identified or suggested visual styles/references",
  "competitors": "Potential competitors or reference creators in the niche"
}

Be specific, strategic, and professional.
Return ONLY the JSON object.`;

  const text = await callAI(prompt);
  try {
    const result: BrandDNA = JSON.parse(text);
    return result;
  } catch {
    throw new Error('AI returned invalid JSON for Brand DNA. Please try again.');
  }
}
