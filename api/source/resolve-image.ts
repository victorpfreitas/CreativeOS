import { resolveSourceCapture } from '../_lib/source-capture.js';
import { parsePublicHttpUrl } from '../_lib/http-validation.js';

const ALLOWED_SOURCE_TYPES = new Set(['manual', 'youtube', 'rss']);
const MAX_ID_LENGTH = 200;

function readSourceType(value: unknown): 'manual' | 'youtube' | 'rss' | undefined {
  return typeof value === 'string' && ALLOWED_SOURCE_TYPES.has(value)
    ? (value as 'manual' | 'youtube' | 'rss')
    : undefined;
}

// URLs invalidas/privadas sao descartadas (undefined) para o resolver seguir
// com os fallbacks, em vez de derrubar a requisicao.
function readUrl(value: unknown): string | undefined {
  return parsePublicHttpUrl(value)?.toString();
}

function readId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH ? value : undefined;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await resolveSourceCapture({
      sourceType: readSourceType(req.query?.sourceType),
      sourceUrl: readUrl(req.query?.sourceUrl),
      sourceImageUrl: readUrl(req.query?.sourceImageUrl),
      projectId: readId(req.query?.projectId),
      automationId: readId(req.query?.automationId),
      fallbackImageUrl: readUrl(req.query?.fallbackImageUrl),
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Nao consegui resolver a imagem da fonte.',
    });
  }
}
