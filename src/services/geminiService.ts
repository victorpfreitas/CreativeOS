// ============================================================
// Made by Human — AI Service
// ============================================================

import type { BrandDNA, ContentAnalysis, ContentBrief, ContentPlanItem, ContentStrategy } from '../lib/types';
import { getExpertContentPreset } from '../lib/contentPresets';

async function callAI(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Falha ao chamar a IA.' }));
      throw new Error(err.error || `AI API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.text || typeof data.text !== 'string') {
      throw new Error('A IA respondeu sem conteúdo. Tente novamente.');
    }
    return data.text;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('A IA demorou demais para responder. Tente novamente com um brief mais curto.');
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

function cleanJsonText(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

function parseAIJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(cleanJsonText(text)) as T;
  } catch {
    throw new Error(`A IA retornou um formato inválido para ${label}. Tente gerar novamente.`);
  }
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
  if (dna.core_promise) parts.push(`Promessa central: ${dna.core_promise}`);
  if (dna.unique_mechanism) parts.push(`Mecanismo único: ${dna.unique_mechanism}`);
  if (dna.beliefs) parts.push(`Crenças fortes: ${dna.beliefs}`);
  if (dna.common_enemy) parts.push(`Inimigo comum / problema combatido: ${dna.common_enemy}`);
  if (dna.offer) parts.push(`Oferta principal: ${dna.offer}`);
  if (dna.proof_points) parts.push(`Provas e credenciais: ${dna.proof_points}`);
  if (dna.content_angles) parts.push(`Ângulos recorrentes: ${dna.content_angles}`);
  return parts.join('\n');
}

// ---- Generate Expert Content Strategy ----

export async function generateContentStrategy(params: {
  brief: ContentBrief;
  brandDNA?: BrandDNA;
  knowledgeBase?: string;
}): Promise<ContentStrategy> {
  const { brief, brandDNA, knowledgeBase } = params;
  const preset = getExpertContentPreset(brief.preset_id);
  const brandContext = brandDNA ? compileBrandDNA(brandDNA) : knowledgeBase;

  const prompt = `You are a senior content strategist and carousel writer for high-ticket experts and infoproduct creators.

Create a premium, ready-to-review Instagram carousel strategy and draft.

Content preset: ${preset.label}
Preset goal: ${preset.goal}
Preset narrative style: ${preset.narrativePrompt}

Brief:
- Topic: ${brief.topic}
- Goal: ${brief.goal}
- Audience: ${brief.audience}
- CTA: ${brief.cta || preset.defaultCta}
- Source notes: ${brief.source_notes || 'Not provided'}

${brandContext ? `Expert Brand DNA:\n${brandContext}\n` : ''}

Rules:
- Write in pt-BR.
- Make the hook specific, opinionated, and valuable.
- Avoid generic motivational content.
- The carousel must feel like it came from a real expert with a point of view.
- Create 6 slides: 1 hook, 4 body slides, 1 CTA slide.
- Each slide must be concise and visually readable.
- Include a readiness_score from 0 to 100 based on specificity, brand fit, clarity, and publish readiness.

Return ONLY a valid JSON object with this exact structure:
{
  "promise": "The main promise of this carousel",
  "angle": "The strategic angle or point of view",
  "audience": "Who this is for",
  "cta": "The final call to action",
  "slide_outline": ["Slide 1 role", "Slide 2 role", "Slide 3 role", "Slide 4 role", "Slide 5 role", "Slide 6 role"],
  "readiness_score": 82,
  "improvement_notes": ["One short note about what to improve before publishing"],
  "slides": [
    {"type":"hook","text":"Slide 1 text"},
    {"type":"body","text":"Slide 2 text"},
    {"type":"body","text":"Slide 3 text"},
    {"type":"body","text":"Slide 4 text"},
    {"type":"body","text":"Slide 5 text"},
    {"type":"body","text":"Slide 6 CTA text"}
  ],
  "caption": "A concise caption with a natural CTA and 3-5 relevant hashtags"
}`;

  const text = await callAI(prompt);
  const result = parseAIJson<Omit<ContentStrategy, 'slides'> & { slides: Array<{ type: 'hook' | 'body'; text: string }> }>(text, 'estratégia de conteúdo');

  return {
    ...result,
    readiness_score: Math.max(0, Math.min(100, Number(result.readiness_score) || 0)),
    improvement_notes: Array.isArray(result.improvement_notes) ? result.improvement_notes : [],
    slide_outline: Array.isArray(result.slide_outline) ? result.slide_outline : [],
    slides: (result.slides || []).map((slide, index) => ({
      type: index === 0 ? 'hook' : 'body',
      text: slide.text || '',
      image_url: '',
    })),
  };
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
  return parseAIJson<string[]>(text, 'hooks');
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
  return parseAIJson<{ slides: GeneratedSlide[]; caption: string }>(text, 'carrossel');
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
  return cleanJsonText(text).replace(/^"|"$/g, '').trim();
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
  "best_performers": ["Description of top performing content and WHY it worked"],
  "worst_performers": ["Description of underperforming content and WHY it failed"],
  "patterns": ["Specific pattern identified"],
  "recommendations": ["Concrete recommendation based on data"],
  "content_ideas": ["Specific content idea inspired by what worked"]
}

Include at least 3 items in each array. Be specific and actionable.
Return ONLY the JSON object.`;

  const text = await callAI(prompt);
  return parseAIJson<ContentAnalysis['insights']>(text, 'análise');
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
  return parseAIJson<ContentPlanItem[]>(text, 'planejamento semanal');
}

// ---- Generate Brand DNA ----

export async function generateBrandDNA(params: {
  rawData: string;
  language?: string;
}): Promise<BrandDNA> {
  const { rawData, language = 'pt-BR' } = params;

  const prompt = `You are a branding and marketing strategist for experts and infoproduct creators.

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
  "tone_of_voice": "Description of how the brand communicates",
  "key_messages": "Core messages the brand always communicates",
  "brand_colors": "Suggested or identified brand colors",
  "visual_references": "Identified or suggested visual styles/references",
  "competitors": "Potential competitors or reference creators in the niche",
  "core_promise": "The central transformation this expert promises",
  "unique_mechanism": "The named or implied method/mechanism behind the transformation",
  "beliefs": "Strong beliefs or contrarian points of view",
  "common_enemy": "The problem, myth, habit, or market enemy the expert fights against",
  "offer": "Primary offer, product, service, or next step",
  "proof_points": "Credentials, results, cases, numbers, or trust signals",
  "content_angles": "Recurring content angles that would fit this expert"
}

Be specific, strategic, and professional.
Return ONLY the JSON object.`;

  const text = await callAI(prompt);
  return parseAIJson<BrandDNA>(text, 'Brand DNA');
}
