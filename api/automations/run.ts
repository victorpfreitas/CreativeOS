import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { serverDb } from '../_lib/firebase-server';
import { generateAiText } from '../_lib/ai-provider';
import type { Automation, BrandDNA, Hook, Project, Slide, Slideshow } from '../../src/lib/types';
import { assessQueueState, getAutomationHealthStatus, getAutomationIssues } from '../../src/lib/queueUtils';
import { resolveSourceCapture } from '../_lib/source-capture';

function compactText(value?: string) {
  return (value || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compileBrandDNA(dna?: BrandDNA) {
  if (!dna) return '';
  const parts: string[] = [];
  if (dna.bio) parts.push(`Bio do perfil: ${dna.bio}`);
  if (dna.market) parts.push(`Mercado / Nicho: ${dna.market}`);
  if (dna.target_audience) parts.push(`Audiência-alvo: ${dna.target_audience}`);
  if (dna.tone_of_voice) parts.push(`Tom de voz: ${dna.tone_of_voice}`);
  if (dna.key_messages) parts.push(`Mensagens-chave: ${dna.key_messages}`);
  if (dna.core_promise) parts.push(`Promessa central: ${dna.core_promise}`);
  if (dna.unique_mechanism) parts.push(`Mecanismo único: ${dna.unique_mechanism}`);
  if (dna.proof_points) parts.push(`Provas e credenciais: ${dna.proof_points}`);
  if (dna.content_angles) parts.push(`Ângulos recorrentes: ${dna.content_angles}`);
  return parts.join('\n');
}

function cleanJsonText(text: string) {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

function parseAIJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(cleanJsonText(text)) as T;
  } catch {
    throw new Error(`A IA retornou um formato inválido para ${label}.`);
  }
}

function formatInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: Number(read('hour') || 0),
    minute: Number(read('minute') || 0),
    weekday: (read('weekday') || '').toLowerCase(),
  };
}

function weekdayToPlanKey(weekday: string) {
  const map: Record<string, string> = {
    mon: 'mon',
    tue: 'tue',
    wed: 'wed',
    thu: 'thu',
    fri: 'fri',
    sat: 'sat',
    sun: 'sun',
  };
  return map[weekday.slice(0, 3)] || '';
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function getGenerationWindowKey(automation: Automation, now = new Date()) {
  const zone = automation.schedule_timezone || 'UTC';
  const local = formatInTimeZone(now, zone);
  const dayKey = weekdayToPlanKey(local.weekday);
  const scheduleTime = automation.schedule_time || '10:00';
  const [scheduledHour, scheduledMinute] = scheduleTime.split(':').map((value) => Number(value || 0));
  const currentMinutes = local.hour * 60 + local.minute;
  const scheduledMinutes = scheduledHour * 60 + scheduledMinute;
  const delta = currentMinutes - scheduledMinutes;

  if (!automation.schedule_days?.includes(dayKey)) return { eligible: false, reason: 'wrong_day', windowKey: '' };
  if (delta < 0 || delta >= 15) return { eligible: false, reason: 'outside_window', windowKey: '' };

  return {
    eligible: true,
    reason: 'ready',
    windowKey: `${local.year}-${local.month}-${local.day}:${dayKey}:${pad(scheduledHour)}:${pad(scheduledMinute)}`,
  };
}

function getNextRunAt(automation: Automation, now = new Date()) {
  const zone = automation.schedule_timezone || 'UTC';
  const [scheduledHour, scheduledMinute] = (automation.schedule_time || '10:00').split(':').map((value) => Number(value || 0));
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const local = formatInTimeZone(candidate, zone);
    const dayKey = weekdayToPlanKey(local.weekday);
    if (!automation.schedule_days?.includes(dayKey)) continue;
    return `${local.year}-${local.month}-${local.day} ${pad(scheduledHour)}:${pad(scheduledMinute)} (${zone})`;
  }
  return null;
}

function composeSlideText(slide: Pick<Slide, 'tagline' | 'title' | 'body' | 'cta' | 'text'>) {
  return [slide.tagline, slide.title, slide.body, slide.cta].filter(Boolean).join('\n\n') || slide.text || '';
}

function normalizeSlideText(text: string, index: number) {
  return (text || '')
    .replace(/^\s*(passo|slide|etapa)\s*\d+\s*[:.)-]\s*/i, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || (index === 0 ? 'Uma ideia forte começa aqui' : 'Escreva este slide');
}

function normalizeGeneratedSlide(slide: Partial<Slide>, index: number, fallbackCta: string): Slide {
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

async function getAutomationsWithProjects() {
  const snap = await getDocs(query(collection(serverDb, 'automations')));
  const automations = snap.docs.map((item) => ({ id: item.id, ...item.data() } as Automation));
  const projectIds = Array.from(new Set(automations.map((automation) => automation.project_id).filter(Boolean)));
  const projectEntries = await Promise.all(projectIds.map(async (projectId) => {
    const projectSnap = await getDoc(doc(serverDb, 'projects', projectId));
    return projectSnap.exists() ? ({ id: projectSnap.id, ...projectSnap.data() } as Project) : null;
  }));
  const projectMap = new Map<string, Project>(
    projectEntries.filter((item): item is Project => !!item).map((project) => [project.id, project])
  );
  return automations.map((automation) => ({
    ...automation,
    project: projectMap.get(automation.project_id),
  }));
}

async function getUnusedHook(automationId: string) {
  const snap = await getDocs(query(collection(serverDb, 'hooks'), where('automation_id', '==', automationId), where('used', '==', false)));
  const hooks = snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as Hook))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  return hooks[0] || null;
}

async function createHooksForAutomation(automation: Automation) {
  const brandContext = automation.project?.brand_dna ? compileBrandDNA(automation.project.brand_dna) : automation.project?.knowledge_base || '';
  const prompt = `You are a TikTok/Instagram Reels content strategist.

Generate 10 unique slideshow hook ideas for the niche "${automation.niche}".

Narrative style: ${automation.narrative_prompt}

${brandContext ? `Brand knowledge base:\n${brandContext}\n` : ''}

Each hook should be a short, attention-grabbing first-slide text that would make someone swipe to see more.

Return a JSON array of strings.
Return ONLY the JSON array.`;

  const { text } = await generateAiText(prompt);
  const hooks = parseAIJson<string[]>(text, 'hooks');
  const now = Timestamp.now().toDate().toISOString();
  const created = await Promise.all(
    hooks.map(async (hookText) => {
      const data = { automation_id: automation.id, text: hookText, used: false, created_at: now };
      const ref = await addDoc(collection(serverDb, 'hooks'), data);
      return { id: ref.id, ...data } as Hook;
    })
  );
  return created[0] || null;
}

async function getCollectionImages(collectionId?: string | null) {
  if (!collectionId) return [] as string[];
  const snap = await getDocs(query(collection(serverDb, 'collection_images'), where('collection_id', '==', collectionId)));
  return snap.docs.map((item) => String(item.data().url || '')).filter(Boolean);
}

function getRandomImage(images: string[]) {
  return images.length > 0 ? images[Math.floor(Math.random() * images.length)] : '';
}

function getCoverImage(slides: Slide[]) {
  return slides.find((slide) => slide.image_url)?.image_url || '';
}

async function generateSlidesForAutomation(automation: Automation, hookText: string) {
  const brandContext = automation.project?.brand_dna ? compileBrandDNA(automation.project.brand_dna) : automation.project?.knowledge_base || '';
  const finalCta = automation.soft_cta || 'Salve este post e use quando for criar o próximo carrossel.';

  const prompt = `You are a senior editorial strategist and carousel writer for high-ticket experts.

Create one premium Instagram carousel in pt-BR.

Niche: ${automation.niche}
Hook: ${hookText}
Narrative style: ${automation.narrative_prompt}
Format rules: ${automation.format_prompt || 'Manifesto editorial com 5 slides.'}
Soft CTA: ${finalCta}

${brandContext ? `Expert Brand DNA:\n${brandContext}\n` : ''}

Rules:
- Create exactly 5 slides: 1 hook, 3 body slides, 1 CTA slide.
- title is the main headline. body is optional support text.
- tagline is a tiny label, max 32 characters.
- accent_text must be an exact word or short phrase that exists inside title.
- Avoid generic motivational language.
- Include readiness_score from 0 to 100.

Return ONLY valid JSON:
{
  "promise":"main promise",
  "angle":"strategic angle",
  "readiness_score":82,
  "caption":"caption with natural CTA and hashtags",
  "slides":[
    {"type":"hook","tagline":"@expert","title":"headline","body":"support text","cta":"","accent_text":"exact phrase"},
    {"type":"body","tagline":"","title":"headline","body":"support text","cta":"","accent_text":"exact phrase"},
    {"type":"body","tagline":"","title":"headline","body":"support text","cta":"","accent_text":"exact phrase"},
    {"type":"body","tagline":"","title":"headline","body":"support text","cta":"","accent_text":"exact phrase"},
    {"type":"body","tagline":"próximo passo","title":"headline","body":"support text","cta":"${finalCta}","accent_text":"exact phrase"}
  ]
}`;

  const { text } = await generateAiText(prompt);
  const result = parseAIJson<{
    promise?: string;
    angle?: string;
    readiness_score?: number;
    caption?: string;
    slides: Array<Partial<Slide>>;
  }>(text, 'carrossel automático');

  const [hookImages, bodyImages] = await Promise.all([
    getCollectionImages(automation.hook_collection_id),
    getCollectionImages(automation.body_collection_id),
  ]);

  const slides = (result.slides || []).slice(0, 5).map((slide, index) => ({
    ...normalizeGeneratedSlide(slide, index, finalCta),
    image_url: index === 0 ? getRandomImage(hookImages) : getRandomImage(bodyImages),
  }));

  return {
    slides,
    caption: compactText(result.caption),
    contentAngle: compactText(result.angle) || compactText(result.promise),
    readinessScore: Math.max(0, Math.min(100, Number(result.readiness_score) || 0)),
  };
}

async function hasDraftForWindow(automationId: string, windowKey: string) {
  const snap = await getDocs(query(collection(serverDb, 'slideshows'), where('automation_id', '==', automationId)));
  return snap.docs.some((item) => {
    const data = item.data() as Slideshow;
    return data.source_context?.trigger_label === windowKey;
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers?.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized cron invocation.' });
  }

  try {
    const automations = await getAutomationsWithProjects();
    const summary = {
      checked: automations.length,
      generated: 0,
      skipped: 0,
      skippedAutomations: [] as Array<{ automationId: string; reason: string }>,
    };

    for (const automation of automations) {
      const health = getAutomationHealthStatus(automation, automation.project);
      const issues = getAutomationIssues(automation, automation.project);
      const nextRunAt = getNextRunAt(automation);

      if (automation.status === 'paused' || health !== 'healthy') {
        summary.skipped += 1;
        summary.skippedAutomations.push({
          automationId: automation.id,
          reason: automation.status === 'paused' ? 'paused' : issues.join(', ') || 'missing_inputs',
        });
        await updateDoc(doc(serverDb, 'automations', automation.id), {
          health_status: health,
          next_run_at: nextRunAt,
        });
        continue;
      }

      const window = getGenerationWindowKey(automation);
      if (!window.eligible) {
        await updateDoc(doc(serverDb, 'automations', automation.id), {
          health_status: health,
          next_run_at: nextRunAt,
        });
        continue;
      }

      if (await hasDraftForWindow(automation.id, window.windowKey)) {
        await updateDoc(doc(serverDb, 'automations', automation.id), {
          health_status: 'needs_review_capacity',
          next_run_at: nextRunAt,
        });
        continue;
      }

      let hook = await getUnusedHook(automation.id);
      if (!hook) {
        hook = await createHooksForAutomation(automation);
      }
      if (!hook) {
        summary.skipped += 1;
        summary.skippedAutomations.push({ automationId: automation.id, reason: 'no_hook_available' });
        continue;
      }

      const generated = await generateSlidesForAutomation(automation, hook.text);
      const queue = assessQueueState({
        slides: generated.slides,
        caption: generated.caption,
        sourceTitle: automation.name,
        sourceNotes: automation.narrative_prompt,
        readinessScore: generated.readinessScore,
      });
      const sourceCapture = await resolveSourceCapture({
        projectId: automation.project_id,
        automationId: automation.id,
        fallbackImageUrl: getCoverImage(generated.slides),
      });

      const slideshowSlides = sourceCapture.sourceCaptureUrl
        ? generated.slides.map((slide, index) => ({
            ...slide,
            image_url: slide.image_url || (index === 0 ? sourceCapture.sourceCaptureUrl || '' : slide.image_url),
          }))
        : generated.slides;

      const slideshowData = {
        automation_id: automation.id,
        hook_id: hook.id,
        slides: slideshowSlides,
        caption: generated.caption,
        status: 'reviewing',
        content_angle: generated.contentAngle,
        readiness_score: generated.readinessScore,
        generated_by: 'automation' as const,
        review_state: 'queued' as const,
        queue_label: queue.queueLabel,
        queue_note: queue.queueNote,
        source_context: {
          automation_id: automation.id,
          trigger_label: window.windowKey,
          hook_text: hook.text,
        },
        source_capture_type: sourceCapture.sourceCaptureType,
        source_capture_url: sourceCapture.sourceCaptureUrl || '',
        source_capture_status: sourceCapture.sourceCaptureStatus,
        source_capture_note: sourceCapture.sourceCaptureNote,
        created_at: Timestamp.now().toDate().toISOString(),
      };

      await addDoc(collection(serverDb, 'slideshows'), slideshowData);
      await updateDoc(doc(serverDb, 'hooks', hook.id), { used: true });
      await updateDoc(doc(serverDb, 'automations', automation.id), {
        health_status: 'healthy',
        last_generated_at: Timestamp.now().toDate().toISOString(),
        next_run_at: nextRunAt,
      });
      summary.generated += 1;
    }

    return res.status(200).json({ ok: true, summary });
  } catch (error) {
    console.error('Automation cron failed', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Automation cron failed.',
    });
  }
}
