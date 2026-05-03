import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import type { Automation, ContentBrief } from '../../src/lib/types';
import { serverDb } from './firebase-server';

type SourceCaptureType = NonNullable<ContentBrief['source_capture_type']>;
type SourceCaptureStatus = NonNullable<ContentBrief['source_capture_status']>;

export type ResolvedSourceCapture = {
  sourceCaptureType?: SourceCaptureType;
  sourceCaptureUrl?: string;
  sourceCaptureStatus: SourceCaptureStatus;
  sourceCaptureNote: string;
};

type ResolveSourceCaptureInput = {
  sourceType?: ContentBrief['source_type'];
  sourceUrl?: string;
  sourceImageUrl?: string;
  projectId?: string;
  automationId?: string;
  fallbackImageUrl?: string;
};

const PROBE_TIMEOUT_MS = 8000;

function normalizeUrl(value?: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).toString();
  } catch {
    return '';
  }
}

function getYouTubeVideoId(url: string) {
  const cleanUrl = url.trim();
  if (!cleanUrl) return '';

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.searchParams.get('v')) return parsed.searchParams.get('v') || '';
    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?#]+)/);
    if (shortsMatch) return shortsMatch[1];
    const embedMatch = parsed.pathname.match(/\/embed\/([^/?#]+)/);
    if (embedMatch) return embedMatch[1];
  } catch {
    const looseMatch = cleanUrl.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{6,})/);
    return looseMatch?.[1] || '';
  }

  return '';
}

function getYouTubeThumbnail(url: string) {
  const id = getYouTubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : '';
}

function getYouTubeThumbnailCandidates(url: string) {
  const id = getYouTubeVideoId(url);
  if (!id) return [] as string[];
  return [
    `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${id}/sddefault.jpg`,
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/default.jpg`,
  ];
}

function buildScreenshotUrl(url: string) {
  return url ? `https://image.thum.io/get/width/1400/crop/980/noanimate/${url}` : '';
}

async function probeImageUrl(url: string) {
  const target = normalizeUrl(url);
  if (!target) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(target, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'CreativeOS/1.0 source capture',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('image/');
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function getCollectionImages(collectionId?: string | null) {
  if (!collectionId) return [] as string[];
  const snap = await getDocs(query(collection(serverDb, 'collection_images'), where('collection_id', '==', collectionId)));
  return snap.docs
    .map((item) => String(item.data().url || '').trim())
    .filter(Boolean);
}

async function getProjectFallbackImage(projectId?: string, automationId?: string) {
  const directFallbackAutomation = automationId
    ? await getDoc(doc(serverDb, 'automations', automationId))
    : null;

  if (directFallbackAutomation?.exists()) {
    const automation = { id: directFallbackAutomation.id, ...directFallbackAutomation.data() } as Automation;
    const images = [
      ...(await getCollectionImages(automation.hook_collection_id)),
      ...(await getCollectionImages(automation.body_collection_id)),
    ];
    if (images[0]) return images[0];
  }

  if (!projectId) return '';

  const automationsSnap = await getDocs(query(collection(serverDb, 'automations'), where('project_id', '==', projectId)));
  const automations = automationsSnap.docs.map((item) => ({ id: item.id, ...item.data() } as Automation));
  for (const automation of automations) {
    const images = [
      ...(await getCollectionImages(automation.hook_collection_id)),
      ...(await getCollectionImages(automation.body_collection_id)),
    ];
    if (images[0]) return images[0];
  }

  return '';
}

export async function resolveSourceCapture(input: ResolveSourceCaptureInput): Promise<ResolvedSourceCapture> {
  const sourceType = input.sourceType;
  const sourceUrl = normalizeUrl(input.sourceUrl);
  const sourceImageUrl = normalizeUrl(input.sourceImageUrl);

  if (sourceType === 'youtube') {
    const thumbnailCandidates = [
      ...(sourceImageUrl ? [sourceImageUrl] : []),
      ...getYouTubeThumbnailCandidates(sourceUrl),
    ].filter((value, index, arr) => value && arr.indexOf(value) === index);

    for (const thumbnailUrl of thumbnailCandidates) {
      if (await probeImageUrl(thumbnailUrl)) {
        return {
          sourceCaptureType: 'youtube_thumbnail',
          sourceCaptureUrl: thumbnailUrl,
          sourceCaptureStatus: 'ready',
          sourceCaptureNote: 'Usando thumbnail oficial do YouTube para abrir o draft.',
        };
      }
    }
  }

  if (sourceImageUrl && await probeImageUrl(sourceImageUrl)) {
    return {
      sourceCaptureType: 'source_image',
      sourceCaptureUrl: sourceImageUrl,
      sourceCaptureStatus: 'ready',
      sourceCaptureNote: 'Usando imagem nativa da fonte como ativo principal do draft.',
    };
  }

  if (sourceUrl && sourceType !== 'youtube') {
    const screenshotUrl = buildScreenshotUrl(sourceUrl);
    if (screenshotUrl && await probeImageUrl(screenshotUrl)) {
      return {
        sourceCaptureType: 'page_screenshot',
        sourceCaptureUrl: screenshotUrl,
        sourceCaptureStatus: 'fallback_used',
        sourceCaptureNote: 'A fonte nao tinha imagem forte; usamos um print editorial da pagina.',
      };
    }
  }

  let projectFallback = normalizeUrl(input.fallbackImageUrl);
  if (!projectFallback) {
    try {
      projectFallback = await getProjectFallbackImage(input.projectId, input.automationId);
    } catch {
      projectFallback = '';
    }
  }
  if (projectFallback && await probeImageUrl(projectFallback)) {
    return {
      sourceCaptureType: 'project_fallback',
      sourceCaptureUrl: projectFallback,
      sourceCaptureStatus: 'fallback_used',
      sourceCaptureNote: 'Sem imagem forte da fonte; usamos o fallback visual ja ligado ao projeto.',
    };
  }

  return {
    sourceCaptureStatus: 'failed',
    sourceCaptureNote: sourceType === 'youtube'
      ? 'Nao encontramos uma thumbnail confiavel para este video agora.'
      : 'Nao conseguimos resolver uma imagem confiavel para este draft automaticamente.',
  };
}
