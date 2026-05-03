from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import json
import re

from yt_dlp import YoutubeDL


def get_video_id(value: str) -> str:
    clean = (value or "").strip()
    if not clean:
        return ""

    patterns = [
        r"(?:v=|youtu\.be/|shorts/|embed/)([a-zA-Z0-9_-]{6,})",
    ]
    for pattern in patterns:
        match = re.search(pattern, clean)
        if match:
            return match.group(1)
    return ""


def thumbnail_candidates(video_id: str) -> list[str]:
    if not video_id:
        return []
    return [
        f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/sddefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/default.jpg",
    ]


def pick_track(track_map: dict, preferred_lang: str):
    if not isinstance(track_map, dict) or not track_map:
        return None

    preferred = []
    if preferred_lang:
        preferred.append(preferred_lang)
        if "-" in preferred_lang:
            preferred.append(preferred_lang.split("-")[0])
    preferred.extend(["pt", "pt-BR", "en", "en-US"])

    for lang in preferred:
        if track_map.get(lang):
            return {"language": lang, "formats": track_map[lang]}

    first_language = next(iter(track_map.keys()), "")
    if not first_language:
        return None
    return {"language": first_language, "formats": track_map[first_language]}


def pick_format(formats):
    if not isinstance(formats, list):
        return None
    priorities = ["json3", "srv3", "vtt", "ttml"]
    for ext in priorities:
        for item in formats:
            if item.get("ext") == ext and item.get("url"):
                return item
    for item in formats:
        if item.get("url"):
            return item
    return None


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "CreativeOS/1.0 youtube intake"})
    with urlopen(request, timeout=20) as response:
        payload = response.read().decode("utf-8", errors="ignore")
    return payload


def parse_json3(payload: str) -> str:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return ""

    lines = []
    for event in data.get("events", []):
        text = "".join(seg.get("utf8", "") for seg in event.get("segs", []) if isinstance(seg, dict)).strip()
        if text:
            lines.append(re.sub(r"\s+", " ", text))
    return "\n".join(lines).strip()


def parse_vtt(payload: str) -> str:
    text = re.sub(r"^WEBVTT[^\n]*\n+", "", payload, flags=re.IGNORECASE)
    text = re.sub(r"\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*", "", text)
    text = re.sub(r"\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}\.\d{3}.*", "", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return text.strip()


def fetch_transcript(track) -> str:
    if not track or not track.get("url"):
        return ""
    payload = fetch_text(track["url"])
    ext = track.get("ext", "")
    if ext in ["json3", "srv3"]:
        return parse_json3(payload)
    return parse_vtt(payload)


def resolve_source(url: str, preferred_lang: str):
    ydl_options = {
        "quiet": True,
        "skip_download": True,
        "no_warnings": True,
        "extract_flat": False,
    }

    with YoutubeDL(ydl_options) as ydl:
        info = ydl.extract_info(url, download=False)

    video_id = str(info.get("id") or get_video_id(url))
    title = str(info.get("title") or "Video do YouTube")
    thumbnail_url = str(info.get("thumbnail") or (thumbnail_candidates(video_id)[0] if video_id else ""))

    official_track = pick_track(info.get("subtitles") or {}, preferred_lang)
    auto_track = pick_track(info.get("automatic_captions") or {}, preferred_lang)

    if official_track:
        picked = pick_format(official_track.get("formats"))
        transcript_text = fetch_transcript(picked)
        if transcript_text:
            return {
                "videoId": video_id,
                "title": title,
                "thumbnailUrl": thumbnail_url,
                "transcriptText": transcript_text,
                "transcriptLanguage": official_track.get("language", ""),
                "transcriptSource": "official",
                "hasTimestamps": True,
                "note": "Transcript loaded from official subtitles.",
            }

    if auto_track:
        picked = pick_format(auto_track.get("formats"))
        transcript_text = fetch_transcript(picked)
        if transcript_text:
            return {
                "videoId": video_id,
                "title": title,
                "thumbnailUrl": thumbnail_url,
                "transcriptText": transcript_text,
                "transcriptLanguage": auto_track.get("language", ""),
                "transcriptSource": "auto",
                "hasTimestamps": True,
                "note": "Transcript loaded from automatic captions.",
            }

    return {
        "videoId": video_id,
        "title": title,
        "thumbnailUrl": thumbnail_url,
        "transcriptText": "",
        "transcriptLanguage": preferred_lang or "",
        "transcriptSource": "unavailable",
        "hasTimestamps": False,
        "note": "No transcript was available for this public video.",
    }


class handler(BaseHTTPRequestHandler):
    def end_json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        url = (params.get("url", [""])[0] or "").strip()
        preferred_lang = (params.get("lang", [""])[0] or "").strip()

        if not url:
            self.end_json(400, {"error": "Informe a URL do video."})
            return

        try:
            result = resolve_source(url, preferred_lang)
            self.end_json(200, result)
        except (HTTPError, URLError):
            self.end_json(502, {"error": "Nao consegui buscar dados do video agora."})
        except Exception as error:
            self.end_json(502, {"error": str(error) or "Nao consegui ler este video agora."})
