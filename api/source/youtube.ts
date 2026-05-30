import { resolveSourceCapture } from '../_lib/source-capture.js';
import { fetchYouTubeTranscriptSource, getRequestOrigin } from '../_lib/youtube-transcript-client.js';
import { parsePublicHttpUrl } from '../_lib/http-validation.js';

// Codigo de idioma curto: "pt", "en", "pt-BR" etc.
const LANG_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawUrl = String(req.query?.url || '').trim();
  const rawLang = String(req.query?.lang || '').trim();

  if (!rawUrl) {
    return res.status(400).json({ error: 'Informe a URL do video.' });
  }

  const parsedUrl = parsePublicHttpUrl(rawUrl);
  if (!parsedUrl) {
    return res.status(400).json({ error: 'URL invalida.' });
  }
  const url = parsedUrl.toString();
  const lang = LANG_PATTERN.test(rawLang) ? rawLang : '';

  try {
    const source = await fetchYouTubeTranscriptSource(getRequestOrigin(req), url, lang || undefined);
    const sourceCapture = await resolveSourceCapture({
      sourceType: 'youtube',
      sourceUrl: url,
      sourceImageUrl: source.thumbnailUrl,
    });

    return res.status(200).json({
      title: source.title,
      url,
      imageUrl: sourceCapture.sourceCaptureUrl || source.thumbnailUrl || '',
      transcript: source.transcriptText,
      transcriptSource: source.transcriptSource,
      language: source.transcriptLanguage,
      note: source.note || sourceCapture.sourceCaptureNote,
      sourceCaptureType: sourceCapture.sourceCaptureType,
      sourceCaptureUrl: sourceCapture.sourceCaptureUrl || source.thumbnailUrl || '',
      sourceCaptureStatus: sourceCapture.sourceCaptureStatus,
      sourceCaptureNote: sourceCapture.sourceCaptureNote,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Nao consegui carregar este video do YouTube agora.',
    });
  }
}
