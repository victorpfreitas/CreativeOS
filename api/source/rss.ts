const SOURCE_TIMEOUT_MS = 12000;

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripHtml(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return '';
}

function extractAttr(source: string, pattern: RegExp) {
  const match = source.match(pattern);
  return match?.[1] ? decodeEntities(match[1]) : '';
}

function absoluteUrl(value: string, baseUrl: string) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function pickFeedItem(xml: string) {
  const itemMatch = xml.match(/<item\b[\s\S]*?<\/item>/i) || xml.match(/<entry\b[\s\S]*?<\/entry>/i);
  return itemMatch?.[0] || xml;
}

function parseSource(raw: string, requestedUrl: string) {
  const feedItem = pickFeedItem(raw);
  const isFeed = /<(rss|feed|item|entry)\b/i.test(raw);
  const source = isFeed ? feedItem : raw;
  const title = stripHtml(firstMatch(source, [
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
  ]));
  const linkFromTag = firstMatch(source, [
    /<link[^>]*>([\s\S]*?)<\/link>/i,
    /<id[^>]*>([\s\S]*?)<\/id>/i,
  ]);
  const linkFromAttr = extractAttr(source, /<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  const url = absoluteUrl(linkFromTag || linkFromAttr || requestedUrl, requestedUrl);
  const image = absoluteUrl(
    extractAttr(source, /<media:content[^>]+url=["']([^"']+)["'][^>]*>/i) ||
      extractAttr(source, /<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i) ||
      extractAttr(source, /<enclosure[^>]+url=["']([^"']+)["'][^>]*(?:type=["']image\/[^"']+["'])?[^>]*>/i) ||
      extractAttr(raw, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      extractAttr(raw, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i),
    requestedUrl
  );
  const description = stripHtml(firstMatch(source, [
    /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i,
    /<summary[^>]*>([\s\S]*?)<\/summary>/i,
    /<description[^>]*>([\s\S]*?)<\/description>/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ]));
  const bodyText = stripHtml(firstMatch(raw, [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<body[^>]*>([\s\S]*?)<\/body>/i,
  ]));
  const text = (description || bodyText).slice(0, 7000);

  return {
    title: title || 'Fonte sem titulo',
    url,
    imageUrl: image,
    excerpt: (description || bodyText).slice(0, 700),
    text,
  };
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CreativeOS/1.0 source preview',
        'Accept': 'application/rss+xml, application/atom+xml, text/xml, text/html;q=0.9, */*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = String(req.query?.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Informe uma URL de RSS ou artigo.' });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid protocol');
  } catch {
    return res.status(400).json({ error: 'URL invalida.' });
  }

  try {
    const response = await fetchWithTimeout(parsedUrl.toString());
    if (!response.ok) {
      return res.status(502).json({ error: `A fonte respondeu com erro ${response.status}.` });
    }

    const raw = await response.text();
    const source = parseSource(raw, parsedUrl.toString());
    return res.status(200).json(source);
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'A fonte demorou demais para responder.' : 'Nao consegui ler essa fonte.';
    return res.status(502).json({ error: message });
  }
}
