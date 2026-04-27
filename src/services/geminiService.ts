// ============================================================
// Made by Human — AI Service
// ============================================================

import type { BrandDNA, ContentAnalysis, ContentBrief, ContentPlanItem, ContentStrategy, Slide } from '../lib/types';
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

function normalizeSlideText(text: string, index: number): string {
  return (text || '')
    .replace(/^\s*(passo|slide|etapa)\s*\d+\s*[:.)-]\s*/i, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || (index === 0 ? 'Uma ideia forte começa aqui' : 'Escreva este slide');
}

function compactText(value?: string): string {
  return (value || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function composeSlideText(slide: Pick<Slide, 'tagline' | 'title' | 'body' | 'cta' | 'text'>) {
  return [slide.tagline, slide.title, slide.body, slide.cta].filter(Boolean).join('\n\n') || slide.text || '';
}

function normalizeStructuredSlide(slide: Partial<Slide>, index: number, fallbackCta: string): Slide {
  const title = compactText(slide.title) || normalizeSlideText(slide.text || '', index);
  const body = compactText(slide.body);
  const tagline = compactText(slide.tagline);
  const cta = index === 4 ? compactText(slide.cta) || fallbackCta : compactText(slide.cta);
  const accentText = compactText(slide.accent_text);
  const next: Slide = {
    type: index === 0 ? 'hook' : 'body',
    text: '',
    image_url: slide.image_url || '',
    tagline,
    title,
    body,
    cta,
    accent_text: accentText,
  };
  return { ...next, text: composeSlideText(next) };
}

function normalizeRegeneratedSlide(slide: Partial<Slide>, currentSlide: Slide, slideIndex: number, totalSlides: number): Partial<Slide> {
  const isCTA = slideIndex === totalSlides - 1 && slideIndex !== 0;
  const title = compactText(slide.title) || normalizeSlideText(slide.text || currentSlide.title || currentSlide.text || '', slideIndex);
  const body = compactText(slide.body);
  const tagline = compactText(slide.tagline);
  const cta = isCTA ? compactText(slide.cta) || compactText(currentSlide.cta) : compactText(slide.cta);
  const rawAccent = compactText(slide.accent_text);
  const accentText = rawAccent && title.toLocaleLowerCase().includes(rawAccent.toLocaleLowerCase()) ? rawAccent : '';
  const next: Partial<Slide> = {
    tagline,
    title,
    body,
    cta,
    accent_text: accentText,
  };
  return { ...next, text: composeSlideText({ ...currentSlide, ...next }) };
}

function describeCarousel(slides: Slide[]) {
  return slides.map((slide, index) => {
    const role = index === 0 || slide.type === 'hook' ? 'hook' : index === slides.length - 1 ? 'cta' : 'body';
    return `${index + 1}. ${role}: ${composeSlideText(slide)}`;
  }).join('\n\n');
}

function normalizeRegeneratedSlides(slides: Array<Partial<Slide>>, currentSlides: Slide[], fallbackCta?: string): Slide[] {
  return currentSlides.map((currentSlide, index) => {
    const patch = normalizeRegeneratedSlide(slides[index] || {}, currentSlide, index, currentSlides.length);
    const isCTA = index === currentSlides.length - 1 && index !== 0;
    const next = {
      ...currentSlide,
      ...patch,
      cta: isCTA ? patch.cta || currentSlide.cta || fallbackCta || '' : patch.cta || '',
      image_url: currentSlide.image_url,
      type: index === 0 ? 'hook' : currentSlide.type,
    };
    return { ...next, text: composeSlideText(next) };
  });
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
  const finalCta = brief.cta || preset.defaultCta;

  const prompt = `You are a senior content strategist and editorial carousel writer for high-ticket experts and infoproduct creators.

Create one premium Instagram carousel in a black/off-white manifesto style. Think editorial poster, not corporate slide deck.

Content preset: ${preset.label}
Preset goal: ${preset.goal}
Preset narrative style: ${preset.narrativePrompt}

Brief:
- Topic: ${brief.topic}
- Goal: ${brief.goal}
- Audience: ${brief.audience}
- CTA: ${finalCta}
- Source notes: ${brief.source_notes || 'Not provided'}

${brandContext ? `Expert Brand DNA:\n${brandContext}\n` : ''}

Rules:
- Write in pt-BR.
- Create exactly 5 slides: 1 hook, 3 body slides, 1 CTA slide.
- Each slide must be structured for a premium editorial design.
- Never put labels like "Passo 1" inside title/body; the layout already has slide numbers.
- title is the visual headline. It must be short, sharp, and readable.
- body is optional support text. Use it only when it adds clarity.
- tagline is a tiny label, max 32 characters.
- accent_text must be an exact word or short phrase that exists inside title. Pick the most interesting word/phrase to color. If nothing deserves emphasis, return an empty string.
- Cover title: max 90 characters. Cover body: max 135 characters.
- Body title: max 70 characters. Body body: max 170 characters.
- CTA title: max 80 characters. CTA body: max 140 characters. CTA field: max 38 characters.
- Avoid generic motivational language.
- Make it feel like a sharp point of view from a real expert.
- Include a readiness_score from 0 to 100.

Return ONLY a valid JSON object with this exact structure:
{
  "promise": "The main promise of this carousel",
  "angle": "The strategic angle or point of view",
  "audience": "Who this is for",
  "cta": "The final call to action",
  "slide_outline": ["Slide 1 role", "Slide 2 role", "Slide 3 role", "Slide 4 role", "Slide 5 role"],
  "readiness_score": 82,
  "improvement_notes": ["One short note about what to improve before publishing"],
  "slides": [
    {"type":"hook","tagline":"@expert","title":"Slide 1 title","body":"Optional support text","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"","title":"Slide 2 title","body":"Slide 2 body","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"","title":"Slide 3 title","body":"Slide 3 body","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"","title":"Slide 4 title","body":"Slide 4 body","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"próximo passo","title":"Slide 5 CTA title","body":"CTA body","cta":"${finalCta}","accent_text":"exact title phrase"}
  ],
  "caption": "A concise caption with a natural CTA and 3-5 relevant hashtags"
}`;

  const text = await callAI(prompt);
  const result = parseAIJson<Omit<ContentStrategy, 'slides'> & { slides: Array<Partial<Slide>> }>(text, 'estratégia de conteúdo');
  const slides = (result.slides || []).slice(0, 5).map((slide, index) => normalizeStructuredSlide(slide, index, finalCta));

  return {
    ...result,
    readiness_score: Math.max(0, Math.min(100, Number(result.readiness_score) || 0)),
    improvement_notes: Array.isArray(result.improvement_notes) ? result.improvement_notes : [],
    slide_outline: Array.isArray(result.slide_outline) ? result.slide_outline.slice(0, 5) : [],
    slides,
  };
}

export async function generateSourceCarouselStrategy(params: {
  brief: ContentBrief;
  brandDNA?: BrandDNA;
  knowledgeBase?: string;
}): Promise<ContentStrategy> {
  const { brief, brandDNA, knowledgeBase } = params;
  const preset = getExpertContentPreset(brief.preset_id);
  const brandContext = brandDNA ? compileBrandDNA(brandDNA) : knowledgeBase;
  const finalCta = brief.cta || preset.defaultCta;
  const sourceLabel = brief.source_type === 'youtube' ? 'video do YouTube' : brief.source_type === 'rss' ? 'portal/RSS' : 'fonte externa';
  const sourceText = compactText([
    brief.source_title ? `Titulo da fonte: ${brief.source_title}` : '',
    brief.source_url ? `URL: ${brief.source_url}` : '',
    brief.source_excerpt ? `Resumo/trecho capturado: ${brief.source_excerpt}` : '',
    brief.source_notes ? `Transcricao, notas ou texto completo:\n${brief.source_notes}` : '',
  ].filter(Boolean).join('\n\n'));

  const prompt = `You are a senior editorial strategist turning source material into premium Instagram carousels for high-ticket experts.

Create one carousel from this ${sourceLabel}. Do not merely summarize the source: extract a strong thesis, a useful point of view, and a publishable narrative.

Content preset: ${preset.label}
Preset goal: ${preset.goal}
Preset narrative style: ${preset.narrativePrompt}

Brief:
- Topic: ${brief.topic || brief.source_title || 'Source-based carousel'}
- Goal: ${brief.goal}
- Audience: ${brief.audience}
- CTA: ${finalCta}

Source material:
---
${sourceText || 'Not provided'}
---

${brandContext ? `Expert Brand DNA:\n${brandContext}\n` : ''}

Rules:
- Write in pt-BR.
- Create exactly 5 slides: 1 hook, 3 body slides, 1 CTA slide.
- Preserve the source's core idea, but translate it into sharp expert content.
- If the source contains news, avoid pretending certainty beyond what the source says.
- Never put labels like "Passo 1", "Slide" or numbering inside title/body.
- title is the visual headline. It must be short, sharp, and readable.
- body is optional support text. Use it only when it adds clarity.
- tagline is a tiny label, max 32 characters.
- accent_text must be an exact word or short phrase that exists inside title. If nothing deserves emphasis, return an empty string.
- Cover title: max 90 characters. Cover body: max 135 characters.
- Body title: max 70 characters. Body body: max 170 characters.
- CTA title: max 80 characters. CTA body: max 140 characters. CTA field: max 38 characters.
- Avoid generic motivational language.
- Include a readiness_score from 0 to 100.

Return ONLY a valid JSON object with this exact structure:
{
  "promise": "The main promise of this carousel",
  "angle": "The strategic angle or point of view",
  "audience": "Who this is for",
  "cta": "The final call to action",
  "slide_outline": ["Slide 1 role", "Slide 2 role", "Slide 3 role", "Slide 4 role", "Slide 5 role"],
  "readiness_score": 82,
  "improvement_notes": ["One short note about what to improve before publishing"],
  "slides": [
    {"type":"hook","tagline":"fonte","title":"Slide 1 title","body":"Optional support text","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"","title":"Slide 2 title","body":"Slide 2 body","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"","title":"Slide 3 title","body":"Slide 3 body","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"","title":"Slide 4 title","body":"Slide 4 body","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"proximo passo","title":"Slide 5 CTA title","body":"CTA body","cta":"${finalCta}","accent_text":"exact title phrase"}
  ],
  "caption": "A concise caption with a natural CTA and 3-5 relevant hashtags"
}`;

  const text = await callAI(prompt);
  const result = parseAIJson<Omit<ContentStrategy, 'slides'> & { slides: Array<Partial<Slide>> }>(text, 'estrategia a partir da fonte');
  const slides = (result.slides || []).slice(0, 5).map((slide, index) => ({
    ...normalizeStructuredSlide(slide, index, finalCta),
    image_url: slide.image_url || brief.source_image_url || '',
  }));

  return {
    ...result,
    readiness_score: Math.max(0, Math.min(100, Number(result.readiness_score) || 0)),
    improvement_notes: Array.isArray(result.improvement_notes) ? result.improvement_notes : [],
    slide_outline: Array.isArray(result.slide_outline) ? result.slide_outline.slice(0, 5) : [],
    slides,
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
  currentSlide: Slide;
  slides: Slide[];
  carouselTitle?: string;
  niche: string;
  narrativePrompt: string;
  formatPrompt?: string;
  softCta?: string;
  knowledgeBase?: string;
  brandDNA?: BrandDNA;
  watermark?: string;
}): Promise<Partial<Slide>> {
  const {
    slideIndex,
    currentSlide,
    slides,
    carouselTitle,
    niche,
    narrativePrompt,
    formatPrompt,
    softCta,
    knowledgeBase,
    brandDNA,
    watermark,
  } = params;
  const brandContext = brandDNA ? compileBrandDNA(brandDNA) : knowledgeBase;
  const isCover = slideIndex === 0 || currentSlide.type === 'hook';
  const isCTA = slideIndex === slides.length - 1 && !isCover;
  const currentText = composeSlideText(currentSlide);
  const carouselMap = describeCarousel(slides);

  const prompt = `You are an editorial Instagram carousel writer and ghostwriter for high-ticket experts.

Rewrite slide ${slideIndex + 1} of a carousel about the niche "${niche}".

Carousel title/topic: ${carouselTitle || 'Not provided'}

Full carousel context:
${carouselMap}

Current slide ${slideIndex + 1}:
${currentText}

Narrative style: ${narrativePrompt}
${formatPrompt ? `Format rules: ${formatPrompt}\n` : ''}
${softCta ? `Preferred CTA: ${softCta}\n` : ''}
${brandContext ? `Expert Brand DNA / voice source:\n${brandContext}\n` : ''}

Ghostwriting rules:
- Write in pt-BR.
- Preserve the expert's voice, beliefs, vocabulary, market position, promises, enemies, proof points, and recurring angles.
- If the Brand DNA and the generic narrative style conflict, prioritize the Brand DNA.
- Make it sound like the expert wrote it, not like generic marketing copy.
- Keep the same strategic role of this slide inside the carousel.
- Improve clarity, specificity, rhythm, and slide readability.
- Do not repeat what another slide already says.
- Do not use labels like "Passo", "Slide", "Etapa", "Dica 1" or numbering inside title/body.
- Avoid generic motivational language, hype, and filler.

Manifesto Papel formatting rules:
- Return structured content for the visual slots.
- tagline is a tiny editorial label, max 32 characters. For cover, use "${watermark || '@expert'}" when it fits.
- title is the main visual headline. It must be short, sharp, and easy to read.
- body supports the title with concrete explanation. Use line breaks only when they improve rhythm.
- accent_text must be an exact word or short phrase that exists inside title.
- ${isCover ? 'Cover title max 90 characters. Cover body max 135 characters.' : isCTA ? 'CTA title max 80 characters. CTA body max 140 characters. CTA field max 38 characters.' : 'Body title max 70 characters. Body body max 170 characters.'}
- Prefer one strong idea per slide.

Return ONLY valid JSON with this exact structure:
{
  "tagline": "tiny label",
  "title": "visual headline",
  "body": "support text",
  "cta": "${isCTA ? 'visual CTA text' : ''}",
  "accent_text": "exact title phrase"
}`;

  const text = await callAI(prompt);
  const result = parseAIJson<Partial<Slide>>(text, 'reescrita do slide');
  return normalizeRegeneratedSlide(result, currentSlide, slideIndex, slides.length);
}

export async function regenerateCarousel(params: {
  slides: Slide[];
  carouselTitle?: string;
  niche: string;
  narrativePrompt: string;
  formatPrompt?: string;
  softCta?: string;
  knowledgeBase?: string;
  brandDNA?: BrandDNA;
  watermark?: string;
  caption?: string;
}): Promise<{ slides: Slide[]; caption?: string }> {
  const {
    slides,
    carouselTitle,
    niche,
    narrativePrompt,
    formatPrompt,
    softCta,
    knowledgeBase,
    brandDNA,
    watermark,
    caption,
  } = params;
  const brandContext = brandDNA ? compileBrandDNA(brandDNA) : knowledgeBase;
  const carouselMap = describeCarousel(slides);

  const prompt = `You are an editorial Instagram carousel writer and ghostwriter for high-ticket experts.

Rewrite the entire carousel about the niche "${niche}".

Carousel title/topic: ${carouselTitle || 'Not provided'}

Current carousel:
${carouselMap}

Current caption:
${caption || 'Not provided'}

Narrative style: ${narrativePrompt}
${formatPrompt ? `Format rules: ${formatPrompt}\n` : ''}
${softCta ? `Preferred CTA: ${softCta}\n` : ''}
${brandContext ? `Expert Brand DNA / voice source:\n${brandContext}\n` : ''}

Ghostwriting rules:
- Write in pt-BR.
- Preserve the expert's voice, beliefs, vocabulary, market position, promises, enemies, proof points, and recurring angles.
- If the Brand DNA and the generic narrative style conflict, prioritize the Brand DNA.
- Make it sound like the expert wrote it, not like generic marketing copy.
- Deliver a complete carousel with a clear hook, progressive body slides, and a final CTA.
- Keep the same number of slides: exactly ${slides.length}.
- Do not repeat the same idea across slides.
- Do not use labels like "Passo", "Slide", "Etapa", "Dica 1" or numbering inside title/body.
- Avoid generic motivational language, hype, and filler.

Manifesto Papel formatting rules:
- Every slide must return structured content for tagline, title, body, cta, and accent_text.
- tagline is a tiny editorial label, max 32 characters. Cover tagline should use "${watermark || '@expert'}" when it fits.
- title is the main visual headline. It must be short, sharp, and easy to read.
- body supports the title with concrete explanation. Use line breaks only when they improve rhythm.
- accent_text is mandatory when a strong highlight exists. It must be an exact word or short phrase that exists inside title. Choose the word/phrase most worth coloring visually.
- Cover title max 90 characters. Cover body max 135 characters.
- Body title max 70 characters. Body body max 170 characters.
- CTA title max 80 characters. CTA body max 140 characters. CTA field max 38 characters.
- Prefer one strong idea per slide.

Return ONLY valid JSON with this exact structure:
{
  "slides": [
    {"type":"hook","tagline":"@expert","title":"visual headline","body":"support text","cta":"","accent_text":"exact title phrase"},
    {"type":"body","tagline":"","title":"visual headline","body":"support text","cta":"","accent_text":"exact title phrase"}
  ],
  "caption": "caption in the same expert voice, with a natural CTA and 3-5 relevant hashtags"
}`;

  const text = await callAI(prompt);
  const result = parseAIJson<{ slides: Array<Partial<Slide>>; caption?: string }>(text, 'reescrita do carrossel');
  return {
    slides: normalizeRegeneratedSlides(Array.isArray(result.slides) ? result.slides : [], slides, softCta),
    caption: compactText(result.caption),
  };
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
