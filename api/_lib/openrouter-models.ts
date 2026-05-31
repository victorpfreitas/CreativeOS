// ============================================================
// Made by Human — OpenRouter model catalog & sanitization
// ============================================================
//
// Curated list of free OpenRouter models used as:
//  - the default fallback cascade for server-side AI calls, and
//  - the preset suggestions shown in the in-app Settings page.
//
// These IDs are suggestions only. Free models on OpenRouter change
// often, so the Settings page lets users add/remove IDs freely.

export const DEFAULT_OPENROUTER_MODELS = [
  'openrouter/free',
  'openai/gpt-oss-120b:free',
  'z-ai/glm-4.5-air:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'google/gemma-4-31b-it:free',
  'openrouter/owl-alpha',
];

// Max models tried in a single cascade — keeps the worst-case latency
// bounded so it fits within serverless execution limits.
export const MAX_MODELS = 4;

// Permissive but safe pattern for OpenRouter model IDs (e.g. "vendor/name:free").
export const MODEL_ID_PATTERN = /^[A-Za-z0-9._/-]+(:free)?$/;

/**
 * Validate and normalize a requested list of model IDs.
 * Trims, filters by MODEL_ID_PATTERN, dedupes and caps at MAX_MODELS.
 * Returns `fallback` when nothing usable is provided.
 */
export function sanitizeModels(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) return fallback;

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!id || !MODEL_ID_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_MODELS) break;
  }

  return result.length ? result : fallback;
}
