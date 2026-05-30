// Validacao de URLs para os endpoints que fazem fetch de destinos informados
// pelo usuario. Objetivo: aceitar somente http/https publicos e bloquear hosts
// internos/privados (defesa basica contra SSRF).
//
// Observacao: checagem por hostname nao cobre DNS rebinding. Para hardening
// completo, resolver o IP e revalidar antes do fetch (follow-up).

const DEFAULT_MAX_URL_LENGTH = 2048;

function isPrivateIPv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value > 255)) return true; // invalido → trate como bloqueado
  const [a, b] = octets;
  if (a === 0 || a === 127) return true; // 0.0.0.0/8, loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  // IPv6 loopback / unspecified / unique-local / link-local
  if (host === '::1' || host === '::') return true;
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
  if (isPrivateIPv4(host)) return true;
  return false;
}

type ParseOptions = { maxLength?: number };

/**
 * Retorna a URL normalizada se for http/https publica e dentro do tamanho;
 * caso contrario retorna null.
 */
export function parsePublicHttpUrl(value: unknown, options: ParseOptions = {}): URL | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const maxLength = options.maxLength ?? DEFAULT_MAX_URL_LENGTH;
  if (!trimmed || trimmed.length > maxLength) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (isBlockedHostname(url.hostname)) return null;
  return url;
}

export function isPublicHttpUrl(value: unknown, options: ParseOptions = {}): boolean {
  return parsePublicHttpUrl(value, options) !== null;
}
