import { resolveSourceCapture } from '../_lib/source-capture';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await resolveSourceCapture({
      sourceType: typeof req.query?.sourceType === 'string' ? req.query.sourceType : undefined,
      sourceUrl: typeof req.query?.sourceUrl === 'string' ? req.query.sourceUrl : undefined,
      sourceImageUrl: typeof req.query?.sourceImageUrl === 'string' ? req.query.sourceImageUrl : undefined,
      projectId: typeof req.query?.projectId === 'string' ? req.query.projectId : undefined,
      automationId: typeof req.query?.automationId === 'string' ? req.query.automationId : undefined,
      fallbackImageUrl: typeof req.query?.fallbackImageUrl === 'string' ? req.query.fallbackImageUrl : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Nao consegui resolver a imagem da fonte.',
    });
  }
}
