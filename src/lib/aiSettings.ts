// ============================================================
// Made by Human — AI settings cache (OpenRouter model selection)
// ============================================================
//
// Reads the global AI settings (Firestore `app_settings/ai`) once and
// caches the result so every callAI() doesn't hit Firestore. Returns an
// empty list when nothing is configured, meaning "use the server default".

const STORAGE_KEY = 'ai.openRouterModels';

let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

function readLocal(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(models: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
  } catch {
    // ignore quota / unavailable storage
  }
}

export async function loadOpenRouterModels(): Promise<string[]> {
  if (cache) return cache;

  // Fast first paint from localStorage while Firestore resolves.
  const local = readLocal();
  if (local) cache = local;

  if (!inflight) {
    // Lazy import keeps Firebase out of the module-load path (e.g. unit tests).
    inflight = import('./database')
      .then(({ getAiSettings }) => getAiSettings())
      .then((settings) => {
        cache = settings.openRouterModels;
        writeLocal(cache);
        return cache;
      })
      .catch(() => cache ?? [])
      .finally(() => {
        inflight = null;
      });
  }

  // If we already have a local snapshot, return it immediately; otherwise wait.
  return cache ?? inflight;
}

export function invalidateAiSettings(models?: string[]): void {
  cache = models ?? null;
  if (models) writeLocal(models);
  else {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
