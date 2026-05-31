// ============================================================
// Made by Human — AI Service
// ============================================================

import type {
  BrandDNA,
  ContentAnalysis,
  ContentBrief,
  ContentDraft,
  ContentPlanItem,
  ContentStrategy,
  Slide,
  XContentDraftResult,
} from '../lib/types';
import { getExpertContentPreset } from '../lib/contentPresets';
import { loadOpenRouterModels } from '../lib/aiSettings';

async function callAI(prompt: string, options?: {
  providerOrder?: 'default' | 'openrouter_first';
  maxOpenRouterModels?: number;
  openRouterTimeoutMs?: number;
  skipGemini?: boolean;
  clientTimeoutMs?: number;
}): Promise<string> {
  const controller = new AbortController();
  // Allow extra time: the server may cascade through several OpenRouter models.
  const timeout = window.setTimeout(() => controller.abort(), options?.clientTimeoutMs || 120000);

  // Pull the user-configured OpenRouter model list (empty => server default).
  const models = await loadOpenRouterModels().catch(() => [] as string[]);

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        models,
        providerOrder: options?.providerOrder,
        maxOpenRouterModels: options?.maxOpenRouterModels,
        openRouterTimeoutMs: options?.openRouterTimeoutMs,
        skipGemini: options?.skipGemini,
      }),
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
      throw new Error('A IA demorou demais para responder. Tente novamente com menos posts ou menos fontes neste lote.');
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

function limitText(value: string | undefined, max: number): string {
  const text = compactText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
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

// ---- Voice / Few-shot ----

// Regras compartilhadas para soar humano e nao-generico, injetadas nos prompts de X.
const ANTI_GENERIC_RULES = `Voice rules (critical for sounding human):
- Match the rhythm, sentence length, punctuation, and vocabulary of the REAL example posts above. They are the source of truth for voice.
- Do not use AI/marketing cliches: "no mundo de hoje", "vamos mergulhar", "game-changer", "desbloqueie", "o segredo que ninguem te conta", "isso muda tudo", "bora", rhetorical "Parece familiar?".
- No emojis and no hashtags unless they appear in the real example posts.
- No engagement bait ("comenta X", "marca alguem"), no fake urgency, no motivational filler, no hollow hype.
- Prefer concrete specifics, real stakes, and one sharp idea over vague generalities.
- Sound like a person typing fast with a strong point of view, not a brand account.`;

function renderVoiceSamples(samples: string[] | undefined, label: string, max: number): string {
  if (!samples?.length) return '';
  const cleaned = samples
    .map((sample) => compactText(sample))
    .filter(Boolean)
    .slice(0, max)
    .map((sample, index) => `[${index + 1}]\n${limitText(sample, 600)}`);
  return cleaned.length ? `${label}\n${cleaned.join('\n\n')}` : '';
}

// Monta o bloco de voz: Brand DNA + amostras reais (few-shot) + drafts aprovados + notas aprendidas.
export function buildVoiceContext(params: {
  brandDNA?: BrandDNA;
  knowledgeBase?: string;
  voiceSamples?: string[];
  approvedExamples?: string[];
  voiceLearningNotes?: string;
  maxSamples?: number;
}): string {
  const { brandDNA, knowledgeBase, voiceSamples, approvedExamples, voiceLearningNotes, maxSamples = 6 } = params;
  const brandContext = brandDNA ? compileBrandDNA(brandDNA) : knowledgeBase;
  const blocks = [
    brandContext ? `Expert Brand DNA:\n${brandContext}` : '',
    renderVoiceSamples(
      voiceSamples,
      'REAL posts written by this expert (mirror their voice, rhythm, sentence length, punctuation, vocabulary):',
      maxSamples
    ),
    renderVoiceSamples(
      approvedExamples,
      'Recently approved drafts (the expert accepted these — stay consistent with them):',
      4
    ),
    voiceLearningNotes ? `Learned voice notes from previous human edits:\n${voiceLearningNotes}` : '',
  ].filter(Boolean);
  return blocks.join('\n\n');
}

// Parser tolerante para respostas em array (objeto unico, array puro ou JSON cercado).
export function parseAIJsonArray<T>(text: string, label: string): T[] {
  const cleaned = cleanJsonText(text);
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as T[];
    if (parsed && typeof parsed === 'object') return [parsed as T];
    throw new Error('not array');
  } catch {
    // Fallback: tenta extrair o primeiro array do texto.
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        if (Array.isArray(parsed)) return parsed as T[];
      } catch {
        // continua para o erro abaixo
      }
    }
    throw new Error(`A IA retornou um formato inválido para ${label}. Tente gerar novamente.`);
  }
}

// Normaliza um resultado bruto de X (limites de caractere, fallbacks) — usado no single e no lote.
function normalizeXResult(
  result: Partial<XContentDraftResult>,
  format: ContentDraft['format'],
  topic: string,
  voiceLearningNotes?: string
): XContentDraftResult {
  const isThread = format === 'x_thread';
  const threadItems = Array.isArray(result.thread_items)
    ? result.thread_items.map((item) => limitText(item, 270)).filter(Boolean).slice(0, 7)
    : [];
  const body = isThread ? '' : limitText(result.body || result.hook, 270);
  const normalizedThreadItems = isThread
    ? (threadItems.length > 0 ? threadItems : [limitText(result.hook || result.body, 270)].filter(Boolean))
    : [];

  return {
    title: limitText(result.title || topic || result.hook || 'Draft para X', 90),
    hook: limitText(result.hook || body || normalizedThreadItems[0] || topic, 270),
    body,
    thread_items: normalizedThreadItems,
    objective: compactText(result.objective),
    variants: Array.isArray(result.variants) ? result.variants.map((item) => limitText(item, 270)).filter(Boolean).slice(0, 3) : [],
    voice_notes_used: compactText(result.voice_notes_used || voiceLearningNotes || ''),
    angle: compactText(result.angle),
  };
}

// ---- Generate X Content Draft ----

export async function generateXContentDraft(params: {
  format: ContentDraft['format'];
  topic: string;
  goal?: string;
  audience?: string;
  sourceNotes?: string;
  brandDNA?: BrandDNA;
  knowledgeBase?: string;
  voiceSamples?: string[];
  approvedExamples?: string[];
  voiceLearningNotes?: string;
  refinementInstruction?: string;
  currentDraft?: Pick<ContentDraft, 'body' | 'thread_items' | 'hook' | 'objective'>;
}): Promise<XContentDraftResult> {
  const {
    format,
    topic,
    goal,
    audience,
    sourceNotes,
    brandDNA,
    knowledgeBase,
    voiceSamples,
    approvedExamples,
    voiceLearningNotes,
    refinementInstruction,
    currentDraft,
  } = params;
  const voiceContext = buildVoiceContext({ brandDNA, knowledgeBase, voiceSamples, approvedExamples, voiceLearningNotes });
  const isThread = format === 'x_thread';
  const currentText = currentDraft
    ? [
        currentDraft.hook ? `Hook atual: ${currentDraft.hook}` : '',
        currentDraft.body ? `Post atual:\n${currentDraft.body}` : '',
        currentDraft.thread_items?.length ? `Thread atual:\n${currentDraft.thread_items.map((item, index) => `${index + 1}. ${item}`).join('\n\n')}` : '',
        currentDraft.objective ? `Objetivo atual: ${currentDraft.objective}` : '',
      ].filter(Boolean).join('\n\n')
    : '';

  const prompt = `You are an elite ghostwriter for X/Twitter, writing for high-trust experts who want authority, reach, and a recognizable voice.

Create one ${isThread ? 'X thread' : 'X post'} in pt-BR.

Topic:
${topic || 'Autoridade e posicionamento do expert'}

Goal:
${goal || 'Posicionar o expert como autoridade e gerar conversas qualificadas.'}

Audience:
${audience || 'Seguidores e potenciais clientes do expert.'}

Source notes:
${sourceNotes || 'Not provided'}

${voiceContext ? `${voiceContext}\n` : ''}
${currentText ? `Current draft to improve:\n${currentText}\n` : ''}
${refinementInstruction ? `Refinement instruction:\n${refinementInstruction}\n` : ''}

${ANTI_GENERIC_RULES}

Rules:
- Write with authority, specificity, and a strong point of view.
- For a single post, body must be at most 270 characters.
- For a thread, create 4 to 7 items; each item must be at most 270 characters.
- Do not number thread items inside the item text.
- Include 3 short alternative hooks/variations.
- voice_notes_used must summarize which voice rules you applied.

Return ONLY a valid JSON object with this exact structure:
{
  "title": "short internal title",
  "hook": "the strongest opening line",
  "body": "single post body, or empty string for thread",
  "thread_items": ["thread post 1", "thread post 2"],
  "objective": "why this draft should exist strategically",
  "variants": ["variation 1", "variation 2", "variation 3"],
  "voice_notes_used": "short description of voice signals used"
}`;

  const text = await callAI(prompt);
  const result = parseAIJson<XContentDraftResult>(text, 'post para X');
  return normalizeXResult(result, format, topic, voiceLearningNotes);
}

// ---- Generate X Content Batch ----

const BATCH_CHUNK_SIZE = 4;

export interface XBatchItem extends XContentDraftResult {
  angle: string;
  format: ContentDraft['format'];
  research_thesis?: string;
  research_context?: string;
  voice_review_score?: number;
  voice_review_verdict?: 'pass' | 'needs_review' | 'reject';
  voice_review_notes?: string;
}

export interface XBatchResult {
  items: XBatchItem[];
  requested: number;
  failedChunks: number;
}

export interface XResearchItem {
  angle: string;
  thesis: string;
  why_it_matters: string;
  conversation_trigger: string;
  content_job: 'contrarian' | 'framework' | 'mistake' | 'story' | 'proof' | 'tactical' | 'diagnosis';
  best_format: ContentDraft['format'];
  quality_score: number;
  risk_flags: string[];
  source_note: string;
}

export interface XResearchPlan {
  topic_diagnosis: string;
  audience_tensions: string[];
  beliefs_to_challenge: string[];
  items: XResearchItem[];
}

export interface XVoiceReview {
  score: number;
  verdict: 'pass' | 'needs_review' | 'reject';
  notes: string;
  rewrite_instruction: string;
}

export interface XBatchSource {
  type: 'manual' | 'x_post' | 'x_url' | 'youtube' | 'transcript' | 'notes';
  title?: string;
  url?: string;
  text?: string;
}

interface XBatchBaseParams {
  mode: 'pillars' | 'topic';
  topic?: string;
  count?: number;
  formatMix?: 'x_post' | 'x_thread' | 'mixed';
  styleGuidance?: string;
  brandDNA?: BrandDNA;
  knowledgeBase?: string;
  voiceSamples?: string[];
  approvedExamples?: string[];
  voiceLearningNotes?: string;
  sources?: XBatchSource[];
}

function buildBatchStyleGuide(styleGuidance?: string): string {
  const guide = compactText(styleGuidance);
  if (!guide) return '';
  return `Batch writing direction from the human operator. Treat this as higher priority than generic style rules:
${guide}`;
}

function buildBatchSourceContext(sources?: XBatchSource[]): string {
  const cleaned = (sources || [])
    .map((source, index) => {
      const text = limitText(source.text, 900);
      const parts = [
        `Fonte ${index + 1} (${source.type})`,
        source.title ? `Titulo: ${source.title}` : '',
        source.url ? `URL: ${source.url}` : '',
        text ? `Conteudo:\n${text}` : '',
      ].filter(Boolean);
      return parts.length > 1 ? parts.join('\n') : '';
    })
    .filter(Boolean)
    .slice(0, 4);

  if (!cleaned.length) return '';
  return `Source material provided by the operator. Use it to extract theses, tensions, examples, objections, and vocabulary. Do not merely summarize it:
${cleaned.join('\n\n')}`;
}

const FAST_BATCH_AI_OPTIONS = {
  providerOrder: 'openrouter_first' as const,
  maxOpenRouterModels: 2,
  openRouterTimeoutMs: 18000,
  skipGemini: true,
  clientTimeoutMs: 65000,
};

function pickBatchFormat(formatMix: 'x_post' | 'x_thread' | 'mixed', index: number): ContentDraft['format'] {
  if (formatMix === 'mixed') return index % 3 === 2 ? 'x_thread' : 'x_post';
  return formatMix;
}

function normalizeResearchItem(item: Partial<XResearchItem>, index: number, formatMix: 'x_post' | 'x_thread' | 'mixed'): XResearchItem {
  const score = Math.max(0, Math.min(100, Number(item.quality_score) || 70));
  const allowedJobs = ['contrarian', 'framework', 'mistake', 'story', 'proof', 'tactical', 'diagnosis'];
  const contentJob = allowedJobs.includes(item.content_job || '') ? item.content_job! : 'diagnosis';
  const bestFormat = item.best_format === 'x_thread' || item.best_format === 'x_post'
    ? item.best_format
    : pickBatchFormat(formatMix, index);

  return {
    angle: limitText(item.angle || item.thesis || `Angulo ${index + 1}`, 180),
    thesis: limitText(item.thesis || item.angle || '', 260),
    why_it_matters: limitText(item.why_it_matters, 320),
    conversation_trigger: limitText(item.conversation_trigger, 260),
    content_job: contentJob,
    best_format: bestFormat,
    quality_score: score,
    risk_flags: Array.isArray(item.risk_flags) ? item.risk_flags.map((flag) => limitText(flag, 90)).filter(Boolean).slice(0, 4) : [],
    source_note: limitText(item.source_note, 220),
  };
}

function dedupeAngles(angles: string[], count: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of angles) {
    const angle = compactText(raw);
    const key = angle.toLowerCase();
    if (!angle || seen.has(key)) continue;
    seen.add(key);
    result.push(angle);
    if (result.length >= count) break;
  }
  return result;
}

export async function generateXResearchPlan(params: XBatchBaseParams): Promise<XResearchPlan> {
  const {
    mode,
    topic,
    formatMix = 'mixed',
    styleGuidance,
    brandDNA,
    knowledgeBase,
    voiceSamples,
    approvedExamples,
    voiceLearningNotes,
    sources,
  } = params;
  const count = Math.max(1, Math.min(30, Math.round(params.count || 12)));
  const voiceContext = buildVoiceContext({ brandDNA, knowledgeBase, voiceSamples, approvedExamples, voiceLearningNotes });
  const styleGuide = buildBatchStyleGuide(styleGuidance);
  const sourceContext = buildBatchSourceContext(sources);

  const prompt = `You are the Researcher stage for CreativeOS.

Your job is not to write copy. Transform a raw topic or expert positioning into high-quality editorial angles for X/Twitter.

${mode === 'topic'
    ? `Topic to research:\n${topic || 'Autoridade e posicionamento do expert'}`
    : `Use the expert's pillars, beliefs, proof points, enemies, and recurring angles to build the research plan.`}

${voiceContext ? `${voiceContext}\n` : ''}
${styleGuide ? `${styleGuide}\n` : ''}
${sourceContext ? `${sourceContext}\n` : ''}

Quality filters:
- Thesis before hook: every angle must defend a clear point of view.
- Healthy friction: someone should be able to agree, disagree, reply, or add an example.
- Specificity: avoid vague "how to use X" or "future of X" angles.
- Distance: angles must do different editorial jobs, not cosmetic variations.
- Native to X: deliver value in the post/thread itself.
- Fit the expert's beliefs, common enemy, proof, and mechanism.
- If sources were provided, each angle must be derived from a source insight, quote, objection, or example.

Return ONLY valid JSON with this exact structure:
{
  "topic_diagnosis": "short diagnosis of the content opportunity",
  "audience_tensions": ["tension 1", "tension 2"],
  "beliefs_to_challenge": ["belief 1", "belief 2"],
  "items": [
    {
      "angle": "short editorial angle",
      "thesis": "clear point of view",
      "why_it_matters": "why this matters to the audience now",
      "conversation_trigger": "what this should make people think or reply",
      "content_job": "contrarian | framework | mistake | story | proof | tactical | diagnosis",
      "best_format": "x_post | x_thread",
      "quality_score": 0,
      "risk_flags": ["what could make this generic"],
      "source_note": "brand/source insight behind this angle"
    }
  ]
}

Generate ${count} items. Write in pt-BR.`;

  const text = await callAI(prompt, FAST_BATCH_AI_OPTIONS);
  const raw = parseAIJson<Partial<XResearchPlan>>(text, 'plano de pesquisa do lote');
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((item, index) => normalizeResearchItem(item, index, formatMix))
    .filter((item) => item.angle && item.thesis)
    .slice(0, count);

  if (items.length === 0) throw new Error('Nao consegui gerar ideias boas para o lote. Tente ajustar o tema.');

  return {
    topic_diagnosis: compactText(raw.topic_diagnosis),
    audience_tensions: Array.isArray(raw.audience_tensions) ? raw.audience_tensions.map((item) => limitText(item, 160)).filter(Boolean).slice(0, 5) : [],
    beliefs_to_challenge: Array.isArray(raw.beliefs_to_challenge) ? raw.beliefs_to_challenge.map((item) => limitText(item, 160)).filter(Boolean).slice(0, 5) : [],
    items,
  };
}

export async function reviewXDraftVoice(params: {
  item: XBatchItem;
  brandDNA?: BrandDNA;
  knowledgeBase?: string;
  voiceSamples?: string[];
  approvedExamples?: string[];
  voiceLearningNotes?: string;
  styleGuidance?: string;
}): Promise<XVoiceReview> {
  const { item, brandDNA, knowledgeBase, voiceSamples, approvedExamples, voiceLearningNotes, styleGuidance } = params;
  const voiceContext = buildVoiceContext({ brandDNA, knowledgeBase, voiceSamples, approvedExamples, voiceLearningNotes });
  const styleGuide = buildBatchStyleGuide(styleGuidance);
  const draftText = item.format === 'x_thread' ? item.thread_items.join('\n\n') : item.body;

  const prompt = `You are the Voice Reviewer stage for CreativeOS.

Evaluate if this X draft sounds like the expert and if it is specific enough to publish.

Draft:
${draftText}

Research thesis:
${item.research_thesis || item.angle}

${voiceContext ? `${voiceContext}\n` : ''}
${styleGuide ? `${styleGuide}\n` : ''}

Return ONLY valid JSON:
{
  "score": 0,
  "verdict": "pass | needs_review | reject",
  "notes": "short pt-BR explanation",
  "rewrite_instruction": "what to change if rewritten"
}`;

  try {
    const text = await callAI(prompt);
    const raw = parseAIJson<Partial<XVoiceReview>>(text, 'revisao de voz');
    const score = Math.max(0, Math.min(100, Number(raw.score) || 60));
    const verdict = raw.verdict === 'pass' || raw.verdict === 'needs_review' || raw.verdict === 'reject'
      ? raw.verdict
      : score >= 82 ? 'pass' : score >= 60 ? 'needs_review' : 'reject';
    return {
      score,
      verdict,
      notes: limitText(raw.notes, 320),
      rewrite_instruction: limitText(raw.rewrite_instruction, 260),
    };
  } catch {
    return {
      score: 0,
      verdict: 'needs_review',
      notes: 'Nao consegui revisar automaticamente a voz deste draft.',
      rewrite_instruction: 'Revise manualmente antes de salvar.',
    };
  }
}

export async function generateXDraftsFromResearch(params: XBatchBaseParams & {
  researchItems: XResearchItem[];
  onProgress?: (done: number, total: number, stage?: 'copywriter' | 'reviewer') => void;
}): Promise<XBatchResult> {
  const {
    researchItems,
    formatMix = 'mixed',
    styleGuidance,
    brandDNA,
    knowledgeBase,
    voiceSamples,
    approvedExamples,
    voiceLearningNotes,
    sources,
    onProgress,
  } = params;
  const count = researchItems.length;
  const voiceContext = buildVoiceContext({ brandDNA, knowledgeBase, voiceSamples, approvedExamples, voiceLearningNotes });
  const styleGuide = buildBatchStyleGuide(styleGuidance);
  const sourceContext = buildBatchSourceContext(sources);
  const chunks: XResearchItem[][] = [];
  for (let i = 0; i < researchItems.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(researchItems.slice(i, i + BATCH_CHUNK_SIZE));
  }

  const items: XBatchItem[] = [];
  let failedChunks = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    const chunkSpec = chunk.map((researchItem, indexInChunk) => {
      const globalIndex = chunkIndex * BATCH_CHUNK_SIZE + indexInChunk;
      const format = formatMix === 'mixed' ? researchItem.best_format || pickBatchFormat(formatMix, globalIndex) : formatMix;
      return { ...researchItem, format };
    });

    const expandPrompt = `You are the Copywriter stage for CreativeOS, writing X/Twitter drafts for a high-trust expert.

Write ${chunkSpec.length} separate X drafts in pt-BR, one for each approved research angle below.

Approved research angles:
${chunkSpec.map((spec, index) => `${index + 1}. [${spec.format === 'x_thread' ? 'THREAD' : 'SINGLE POST'}]
Angle: ${spec.angle}
Thesis: ${spec.thesis}
Why it matters: ${spec.why_it_matters}
Conversation trigger: ${spec.conversation_trigger}
Risk flags to avoid: ${spec.risk_flags.join(', ') || 'none'}`).join('\n\n')}

${voiceContext ? `${voiceContext}\n` : ''}
${styleGuide ? `${styleGuide}\n` : ''}
${sourceContext ? `${sourceContext}\n` : ''}

${ANTI_GENERIC_RULES}

Rules:
- Respect each item's format: SINGLE POST -> fill "body" (<=270 chars), empty "thread_items". THREAD -> 4 to 7 "thread_items" (each <=270 chars), empty "body".
- Do not number thread items inside the item text.
- Include 3 short alternative hooks in "variants".
- Write from the thesis, not from a generic hook formula.
- "angle" must echo the approved angle.
- Also act as the Voice Reviewer for each draft in the same response:
  - "voice_review_score" is 0-100 for fit with the expert's voice and specificity.
  - "voice_review_verdict" is "pass", "needs_review", or "reject".
  - "voice_review_notes" is a short pt-BR note explaining what worked or what still sounds generic.

Return ONLY a JSON array of ${chunkSpec.length} objects with this exact structure:
[
  {"angle":"the angle","title":"short internal title","hook":"strongest opening line","body":"single post body or empty for thread","thread_items":["t1","t2"],"objective":"strategic reason","variants":["v1","v2","v3"],"voice_notes_used":"voice signals used","voice_review_score":82,"voice_review_verdict":"pass","voice_review_notes":"short voice review"}
]`;

    try {
      const text = await callAI(expandPrompt, FAST_BATCH_AI_OPTIONS);
      const raw = parseAIJsonArray<Partial<XContentDraftResult & Pick<XBatchItem, 'voice_review_score' | 'voice_review_verdict' | 'voice_review_notes'>>>(text, 'copy do lote para X');
      raw.forEach((entry, indexInChunk) => {
        const spec = chunkSpec[indexInChunk] || chunkSpec[chunkSpec.length - 1];
        const normalized = normalizeXResult(entry, spec.format, entry.angle || spec.angle, voiceLearningNotes);
        const score = Math.max(0, Math.min(100, Number(entry.voice_review_score) || 60));
        const verdict = entry.voice_review_verdict === 'pass' || entry.voice_review_verdict === 'needs_review' || entry.voice_review_verdict === 'reject'
          ? entry.voice_review_verdict
          : score >= 82 ? 'pass' : score >= 60 ? 'needs_review' : 'reject';
        items.push({
          ...normalized,
          angle: normalized.angle || spec.angle,
          format: spec.format,
          research_thesis: spec.thesis,
          research_context: compactText([
            spec.why_it_matters ? `Por que importa: ${spec.why_it_matters}` : '',
            spec.conversation_trigger ? `Gatilho de conversa: ${spec.conversation_trigger}` : '',
            spec.source_note ? `Fonte/insight: ${spec.source_note}` : '',
          ].filter(Boolean).join('\n')),
          voice_review_score: score,
          voice_review_verdict: verdict,
          voice_review_notes: limitText(entry.voice_review_notes, 320),
        });
      });
    } catch {
      failedChunks += 1;
    }

    onProgress?.(Math.min(items.length, count), count, 'copywriter');
  }

  return { items: items.slice(0, count), requested: count, failedChunks };
}

// Gera muitos drafts de X de uma vez: 1 call de outline (angulos) + N calls de expansao em chunks.
export async function generateXContentBatch(params: {
  mode: 'pillars' | 'topic';
  topic?: string;
  count?: number;
  formatMix?: 'x_post' | 'x_thread' | 'mixed';
  styleGuidance?: string;
  brandDNA?: BrandDNA;
  knowledgeBase?: string;
  voiceSamples?: string[];
  approvedExamples?: string[];
  voiceLearningNotes?: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<XBatchResult> {
  const {
    mode,
    topic,
    formatMix = 'mixed',
    styleGuidance,
    brandDNA,
    knowledgeBase,
    voiceSamples,
    approvedExamples,
    voiceLearningNotes,
    onProgress,
  } = params;
  const count = Math.max(1, Math.min(30, Math.round(params.count || 12)));
  const voiceContext = buildVoiceContext({ brandDNA, knowledgeBase, voiceSamples, approvedExamples, voiceLearningNotes });
  const styleGuide = buildBatchStyleGuide(styleGuidance);

  // Etapa 1 — outline de angulos distintos.
  const outlinePrompt = `You are an elite X/Twitter content strategist for a high-trust expert.

${mode === 'topic'
    ? `Generate ${count} distinct, non-overlapping angles for X content all about this topic:\n${topic || 'Autoridade e posicionamento do expert'}`
    : `Generate ${count} distinct, non-overlapping content angles for this expert's X account, derived from their content pillars and recurring angles. Cover a wide spread (contrarian takes, frameworks, mistakes, stories, proof, tactical how-to).`}

${voiceContext ? `${voiceContext}\n` : ''}
${styleGuide ? `${styleGuide}\n` : ''}

Rules:
- Each angle is a short sentence describing the specific idea/hook of one post.
- Angles must be genuinely different from each other.
- Write in pt-BR.

Return ONLY a JSON array of ${count} strings.`;

  let angles: string[] = [];
  try {
    const outlineText = await callAI(outlinePrompt);
    angles = dedupeAngles(parseAIJsonArray<string>(outlineText, 'ângulos do lote'), count);
  } catch {
    angles = [];
  }
  if (angles.length === 0) {
    throw new Error('Não consegui gerar os ângulos do lote. Tente novamente.');
  }

  // Etapa 2 — expansao em chunks (respeita o limite de tokens por call).
  const chunks: string[][] = [];
  for (let i = 0; i < angles.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(angles.slice(i, i + BATCH_CHUNK_SIZE));
  }

  const items: XBatchItem[] = [];
  let failedChunks = 0;
  let produced = 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    const chunkSpec = chunk.map((angle, indexInChunk) => {
      const globalIndex = chunkIndex * BATCH_CHUNK_SIZE + indexInChunk;
      const format = pickBatchFormat(formatMix, globalIndex);
      return { angle, format };
    });

    const expandPrompt = `You are an elite ghostwriter for X/Twitter, writing for a high-trust expert.

Write ${chunkSpec.length} separate X drafts in pt-BR, one for each angle below. Keep each draft in the expert's voice.

Angles (write one draft per angle, in this exact order):
${chunkSpec.map((spec, index) => `${index + 1}. [${spec.format === 'x_thread' ? 'THREAD' : 'SINGLE POST'}] ${spec.angle}`).join('\n')}

${voiceContext ? `${voiceContext}\n` : ''}
${styleGuide ? `${styleGuide}\n` : ''}

${ANTI_GENERIC_RULES}

Rules:
- Respect each item's format: SINGLE POST → fill "body" (<=270 chars), empty "thread_items". THREAD → 4 to 7 "thread_items" (each <=270 chars), empty "body".
- Do not number thread items inside the item text.
- Include 3 short alternative hooks in "variants".
- "angle" must echo the angle this draft addresses.

Return ONLY a JSON array of ${chunkSpec.length} objects with this exact structure:
[
  {"angle":"the angle","title":"short internal title","hook":"strongest opening line","body":"single post body or empty for thread","thread_items":["t1","t2"],"objective":"strategic reason","variants":["v1","v2","v3"],"voice_notes_used":"voice signals used"}
]`;

    try {
      const text = await callAI(expandPrompt);
      const raw = parseAIJsonArray<Partial<XContentDraftResult>>(text, 'lote de posts para X');
      raw.forEach((entry, indexInChunk) => {
        const spec = chunkSpec[indexInChunk] || chunkSpec[chunkSpec.length - 1];
        const normalized = normalizeXResult(entry, spec.format, entry.angle || spec.angle, voiceLearningNotes);
        items.push({ ...normalized, angle: normalized.angle || spec.angle, format: spec.format });
      });
    } catch {
      failedChunks += 1;
    }

    produced += chunk.length;
    onProgress?.(Math.min(produced, count), count);
  }

  if (items.length < count) {
    const existingAngles = new Set(items.map((item) => item.angle.toLowerCase()));
    const missingAngles = angles.filter((angle) => !existingAngles.has(angle.toLowerCase())).slice(0, count - items.length);
    for (const angle of missingAngles) {
      const format = pickBatchFormat(formatMix, items.length);
      try {
        const draft = await generateXContentDraft({
          format,
          topic: angle,
          goal: 'Gerar um post de alta qualidade para o lote, sem soar generico.',
          sourceNotes: styleGuide,
          brandDNA,
          knowledgeBase,
          voiceSamples,
          approvedExamples,
          voiceLearningNotes,
          refinementInstruction: 'Fallback de lote: gere apenas um draft forte para completar a quantidade solicitada.',
        });
        items.push({ ...draft, angle: draft.angle || angle, format });
      } catch {
        failedChunks += 1;
      }
      onProgress?.(Math.min(items.length, count), count);
      if (items.length >= count) break;
    }
  }

  return { items: items.slice(0, count), requested: count, failedChunks };
}

export async function generateVoiceLearningNotes(params: {
  existingNotes?: string;
  eventType: 'approved' | 'edited' | 'regenerated' | 'scheduled';
  beforeText?: string;
  afterText?: string;
  instruction?: string;
}): Promise<string> {
  const { existingNotes, eventType, beforeText, afterText, instruction } = params;
  const prompt = `You maintain concise writing-style memory for a creator's Content Machine.

Update the voice learning notes based on this human action.

Existing notes:
${existingNotes || 'No notes yet.'}

Event type: ${eventType}
Instruction: ${instruction || 'None'}

Before:
${beforeText || 'Not provided'}

After:
${afterText || 'Not provided'}

Rules:
- Write in pt-BR.
- Keep it under 900 characters.
- Preserve durable voice/style preferences only.
- Focus on what future drafts should do more or avoid.
- Do not mention this event as a log; write reusable instructions.

Return ONLY the updated notes as plain text.`;

  const text = await callAI(prompt);
  return limitText(text, 900);
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
  sourceType?: ContentBrief['source_type'];
  sourceTitle?: string;
  sourceUrl?: string;
  sourceNotes?: string;
}): Promise<string[]> {
  const { niche, narrativePrompt, knowledgeBase, count = 10, sourceType, sourceTitle, sourceUrl, sourceNotes } = params;
  const sourceContext = compactText([
    sourceType ? `Source type: ${sourceType}` : '',
    sourceTitle ? `Source title: ${sourceTitle}` : '',
    sourceUrl ? `Source URL: ${sourceUrl}` : '',
    sourceNotes ? `Source notes/transcript:\n${sourceNotes}` : '',
  ].filter(Boolean).join('\n\n'));

  const prompt = `You are a TikTok/Instagram Reels content strategist.

Generate ${count} unique slideshow hook ideas for the niche "${niche}".

Narrative style: ${narrativePrompt}

${knowledgeBase ? `Brand knowledge base:\n${knowledgeBase}\n` : ''}
${sourceContext ? `Source context:\n${sourceContext}\n` : ''}

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
  sourceType?: ContentBrief['source_type'];
  sourceTitle?: string;
  sourceUrl?: string;
  sourceNotes?: string;
}): Promise<{ slides: GeneratedSlide[]; caption: string }> {
  const {
    hookText, niche, narrativePrompt, formatPrompt,
    softCta, knowledgeBase, slideCount = 5, sourceType, sourceTitle, sourceUrl, sourceNotes,
  } = params;
  const sourceContext = compactText([
    sourceType ? `Source type: ${sourceType}` : '',
    sourceTitle ? `Source title: ${sourceTitle}` : '',
    sourceUrl ? `Source URL: ${sourceUrl}` : '',
    sourceNotes ? `Source notes/transcript:\n${sourceNotes}` : '',
  ].filter(Boolean).join('\n\n'));

  const prompt = `You are a TikTok/Instagram slideshow content writer.

Create a ${slideCount}-slide carousel for the niche "${niche}".

The first slide (hook) text is: "${hookText}"

Narrative style: ${narrativePrompt}
Format rules: ${formatPrompt}
${softCta ? `Soft CTA for the last slide: ${softCta}` : ''}
${knowledgeBase ? `Brand knowledge base:\n${knowledgeBase}\n` : ''}
${sourceContext ? `Source context:\n${sourceContext}\n` : ''}

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
