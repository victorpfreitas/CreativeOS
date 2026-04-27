import type { CSSProperties, ReactNode } from 'react';
import type { Slide } from '../../lib/types';
import { getCarouselTemplate } from '../../lib/carouselTemplates';
import { getCarouselColorPalette, getCarouselFontPreset } from '../../lib/carouselVisuals';

interface TemplateSlideProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  templateId?: string;
  watermark?: string;
  logoUrl?: string;
  fontPresetId?: string;
  colorPaletteId?: string;
  accentColor?: string;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange?: (text: string) => void;
  onSlideChange?: (patch: Partial<Slide>) => void;
}

interface SlideContent {
  tagline: string;
  title: string;
  body: string;
  cta: string;
  accentText: string;
}

interface VisualSystem {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  font: string;
  displayFont: string;
  titleWeight: number;
  bodyWeight: number;
  letterSpacing: string;
  texture: string;
  textureOpacity: number;
}

function getScale(exportMode?: boolean, compact?: boolean) {
  if (compact) return 0.22;
  return exportMode ? 1 : 0.42;
}

function px(value: number, exportMode?: boolean, compact?: boolean) {
  return Math.round(value * getScale(exportMode, compact));
}

function brandLabel(watermark?: string) {
  return watermark?.trim() || 'Creative OS';
}

function joinSlideText(slide: Slide) {
  return [slide.tagline, slide.title, slide.body, slide.cta].filter(Boolean).join('\n\n') || slide.text || '';
}

function cleanLegacyText(text: string) {
  return text
    .replace(/^\s*(passo|slide|etapa)\s*\d+\s*[:.)-]\s*/i, '')
    .replace(/^\s*(passo|slide|etapa)\d+\s*[:.)-]\s*/i, '')
    .trim();
}

function splitLegacyText(text: string) {
  return text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitFirstSentence(text: string) {
  const match = text.match(/^(.{36,130}?[.!?])\s+(.+)$/s);
  if (!match) return null;
  return { title: match[1].trim(), body: match[2].trim() };
}

function splitLongLegacyText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 14) return null;
  const title = words.slice(0, 8).join(' ');
  const body = words.slice(8).join(' ');
  return { title, body };
}

function getSlideContent(slide: Slide, isCover: boolean, isCTA: boolean, label: string): SlideContent {
  const legacyText = cleanLegacyText(slide.text || '');
  const lines = splitLegacyText(legacyText);
  const sentenceSplit = splitFirstSentence(legacyText);
  const longSplit = splitLongLegacyText(legacyText);
  const hasStructuredContent = Boolean(slide.tagline || slide.title || slide.body || slide.cta || slide.accent_text);

  if (hasStructuredContent) {
    return {
      tagline: slide.tagline || (isCover ? label : ''),
      title: slide.title || legacyText || 'Escreva um titulo forte',
      body: slide.body || '',
      cta: slide.cta || '',
      accentText: slide.accent_text || '',
    };
  }

  if (isCover) {
    const fallback = lines.length > 1 ? { title: lines[0], body: lines.slice(1).join('\n') } : sentenceSplit || longSplit;
    return {
      tagline: label,
      title: fallback?.title || legacyText || 'Uma ideia forte comeca aqui',
      body: fallback?.body || '',
      cta: '',
      accentText: '',
    };
  }

  if (isCTA) {
    const fallback = lines.length > 1 ? { title: lines[0], body: lines.slice(1).join('\n') } : sentenceSplit || longSplit;
    return {
      tagline: 'proximo passo',
      title: fallback?.title || legacyText || 'Pronto para transformar isso em conteudo?',
      body: fallback?.body || '',
      cta: '',
      accentText: '',
    };
  }

  if (lines.length > 1) {
    return {
      tagline: '',
      title: lines[0],
      body: lines.slice(1).join('\n'),
      cta: '',
      accentText: '',
    };
  }

  if (sentenceSplit || longSplit) {
    const fallback = sentenceSplit || longSplit!;
    return {
      tagline: '',
      title: fallback.title,
      body: fallback.body,
      cta: '',
      accentText: '',
    };
  }

  return {
    tagline: '',
    title: legacyText || 'Escreva este slide',
    body: '',
    cta: '',
    accentText: '',
  };
}

function getVisualSystem(fontPresetId?: string, colorPaletteId?: string, accentColor?: string): VisualSystem {
  const font = getCarouselFontPreset(fontPresetId);
  const palette = getCarouselColorPalette(colorPaletteId);

  return {
    bg: palette.background,
    surface: palette.surface,
    ink: palette.text,
    muted: palette.muted,
    accent: accentColor || palette.accent,
    line: palette.line,
    font: font.bodyFont,
    displayFont: font.displayFont,
    titleWeight: font.titleWeight,
    bodyWeight: font.bodyWeight,
    letterSpacing: font.letterSpacing,
    texture: 'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.075) 0 1px, transparent 1.2px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.045) 0 1px, transparent 1.2px)',
    textureOpacity: palette.textureOpacity,
  };
}

function getTitleMetrics(text: string, variant: 'cover' | 'body' | 'cta', exportMode?: boolean, compact?: boolean) {
  const length = text.trim().length;
  let size = variant === 'cover' ? 82 : variant === 'cta' ? 66 : 54;

  if (variant === 'cover') {
    if (length > 155) size = 52;
    else if (length > 115) size = 60;
    else if (length > 80) size = 68;
  } else if (variant === 'cta') {
    if (length > 135) size = 46;
    else if (length > 90) size = 54;
  } else {
    if (length > 130) size = 40;
    else if (length > 88) size = 46;
  }

  const minimum = variant === 'cover' ? 46 : variant === 'cta' ? 40 : 36;
  return {
    fontSize: `${Math.max(px(minimum, exportMode, compact), px(size, exportMode, compact))}px`,
    lineHeight: variant === 'cover' ? 0.97 : 1.02,
  };
}

function getBodyMetrics(text: string, variant: 'cover' | 'body' | 'cta', title: string, exportMode?: boolean, compact?: boolean) {
  const cleanText = text.trim();
  const length = cleanText.length;
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const manualLines = cleanText.split('\n').filter((line) => line.trim()).length;
  const titleLength = title.trim().length;
  let size = variant === 'cover' ? 38 : variant === 'cta' ? 40 : 42;

  if (variant === 'cover') {
    if (length <= 80) size = 42;
    else if (length > 170 || wordCount > 28 || manualLines > 3) size = 30;
    else if (length > 125 || wordCount > 21) size = 34;
  } else if (variant === 'cta') {
    if (length <= 95) size = 44;
    else if (length > 180 || wordCount > 30 || manualLines > 3) size = 31;
    else if (length > 130 || wordCount > 22) size = 36;
  } else {
    if (length <= 90) size = 46;
    else if (length <= 155 && wordCount <= 26 && manualLines <= 3) size = 40;
    else if (length <= 230 && wordCount <= 38 && manualLines <= 4) size = 35;
    else if (length <= 320 && manualLines <= 5) size = 30;
    else size = 26;
  }

  if (titleLength > 92 && variant !== 'cover') size -= 2;
  if (titleLength > 135) size -= 2;
  const minimum = variant === 'body' ? 26 : 28;
  const lineHeight = size >= 42 ? 1.12 : size >= 35 ? 1.17 : 1.22;
  const maxWidth = length <= 150 ? '100%' : variant === 'cta' ? '88%' : '96%';

  return {
    fontSize: `${Math.max(px(minimum, exportMode, compact), px(size, exportMode, compact))}px`,
    lineHeight,
    maxWidth,
  };
}

function isTextTooLong(slide: Slide, isCover: boolean, isCTA: boolean) {
  const title = slide.title || slide.text || '';
  const body = slide.body || '';
  if (isCover) return title.length > 120 || body.length > 150;
  if (isCTA) return title.length > 100 || body.length > 170;
  return title.length > 90 || body.length > 230;
}

export function getSlideReadabilityWarning(slide: Slide, slideIndex: number, totalSlides: number) {
  const isCover = slideIndex === 0 || slide.type === 'hook';
  const isCTA = slideIndex === totalSlides - 1 && !isCover;
  if (!isTextTooLong(slide, isCover, isCTA)) return '';
  return 'Texto longo: reduza titulo ou corpo para manter leitura premium.';
}

function HighlightedText({ text, accentText, accentColor }: { text: string; accentText?: string; accentColor: string }) {
  if (!accentText?.trim()) return <>{text}</>;

  const source = text.toLocaleLowerCase();
  const needle = accentText.trim().toLocaleLowerCase();
  const index = source.indexOf(needle);
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <span style={{ color: accentColor }}>{text.slice(index, index + accentText.trim().length)}</span>
      {text.slice(index + accentText.trim().length)}
    </>
  );
}

function TextSlot({
  value,
  style,
  editable,
  accentText,
  accentColor,
  onChange,
}: {
  value: string;
  style: CSSProperties;
  editable?: boolean;
  accentText?: string;
  accentColor: string;
  onChange?: (text: string) => void;
}) {
  if (!editable) {
    return (
      <div style={style}>
        <HighlightedText text={value} accentText={accentText} accentColor={accentColor} />
      </div>
    );
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      spellCheck={false}
      style={{
        ...style,
        width: '100%',
        minHeight: '100%',
        background: 'transparent',
        border: 0,
        outline: 0,
        padding: 0,
        margin: 0,
        resize: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        cursor: 'text',
      }}
    />
  );
}

function MetaPill({ children, system, exportMode, compact }: { children: ReactNode; system: VisualSystem; exportMode?: boolean; compact?: boolean }) {
  return (
    <div
      style={{
        border: `${Math.max(1, px(2, exportMode, compact))}px solid ${system.line}`,
        borderRadius: 999,
        padding: `${px(8, exportMode, compact)}px ${px(24, exportMode, compact)}px`,
        fontSize: `${Math.max(7, px(18, exportMode, compact))}px`,
        fontWeight: 900,
        letterSpacing: '-0.035em',
        lineHeight: 1,
        maxWidth: '76%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}

export default function TemplateSlide({
  slide,
  slideIndex,
  totalSlides,
  templateId,
  watermark,
  logoUrl,
  fontPresetId,
  colorPaletteId,
  accentColor,
  editable,
  exportMode,
  compact,
  onTextChange,
  onSlideChange,
}: TemplateSlideProps) {
  const template = getCarouselTemplate(templateId);
  const system = getVisualSystem(fontPresetId, colorPaletteId, accentColor || template.accentColor);
  const isCover = slideIndex === 0 || slide.type === 'hook';
  const isCTA = slideIndex === totalSlides - 1 && !isCover;
  const label = brandLabel(watermark);
  const content = getSlideContent(slide, isCover, isCTA, label);

  function updateTextField(field: keyof Pick<Slide, 'tagline' | 'title' | 'body' | 'cta'>, value: string) {
    const nextSlide = { ...slide, [field]: value };
    onSlideChange?.({ [field]: value, text: joinSlideText(nextSlide) });
    if (!onSlideChange && field === 'title') onTextChange?.(value);
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: system.bg,
        color: system.ink,
        fontFamily: system.font,
      }}
    >
      {slide.image_url && template.layout !== 'image_editorial' && (
        <img
          src={slide.image_url}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: colorPaletteId === 'night-paper' ? 0.28 : 0.16,
            filter: colorPaletteId === 'night-paper' ? 'grayscale(1) contrast(1.1)' : 'grayscale(1) contrast(0.9)',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: system.texture,
          backgroundSize: exportMode ? '32px 32px' : compact ? '7px 7px' : '15px 15px',
          opacity: system.textureOpacity,
        }}
      />

      {template.layout === 'image_editorial' && isCover ? (
        <ImageCoverLayout
          content={content}
          imageUrl={slide.image_url}
          logoUrl={logoUrl}
          system={system}
          editable={editable}
          exportMode={exportMode}
          compact={compact}
          onTextChange={updateTextField}
        />
      ) : template.layout === 'image_editorial' ? (
        <ImageBodyLayout
          content={content}
          label={label}
          imageUrl={slide.image_url}
          logoUrl={logoUrl}
          slideIndex={slideIndex}
          totalSlides={totalSlides}
          isCTA={isCTA}
          system={system}
          editable={editable}
          exportMode={exportMode}
          compact={compact}
          onTextChange={updateTextField}
        />
      ) : isCover ? (
        <CoverLayout
          content={content}
          logoUrl={logoUrl}
          system={system}
          editable={editable}
          exportMode={exportMode}
          compact={compact}
          onTextChange={updateTextField}
        />
      ) : (
        <BodyLayout
          content={content}
          label={label}
          logoUrl={logoUrl}
          slideIndex={slideIndex}
          totalSlides={totalSlides}
          isCTA={isCTA}
          system={system}
          editable={editable}
          exportMode={exportMode}
          compact={compact}
          onTextChange={updateTextField}
        />
      )}
    </div>
  );
}

function ImageCoverLayout(props: {
  content: SlideContent;
  imageUrl?: string;
  logoUrl?: string;
  system: VisualSystem;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange: (field: keyof Pick<Slide, 'tagline' | 'title' | 'body' | 'cta'>, value: string) => void;
}) {
  const { content, imageUrl, logoUrl, system, editable, exportMode, compact, onTextChange } = props;
  const titleMetrics = getTitleMetrics(content.title, 'cover', exportMode, compact);
  const bodyMetrics = getBodyMetrics(content.body, 'cover', content.title, exportMode, compact);

  return (
    <>
      {imageUrl && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.04)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(17,17,17,0.10) 0%, rgba(17,17,17,0.28) 48%, rgba(244,240,230,0.96) 78%)' }} />
        </div>
      )}

      <div style={{ position: 'absolute', top: px(72, exportMode, compact), left: px(72, exportMode, compact), right: px(72, exportMode, compact), display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
        <MetaPill system={system} exportMode={exportMode} compact={compact}>{content.tagline}</MetaPill>
        {logoUrl && <img src={logoUrl} alt="" style={{ maxWidth: px(142, exportMode, compact), maxHeight: px(48, exportMode, compact), objectFit: 'contain' }} />}
      </div>

      <div style={{ position: 'absolute', left: px(76, exportMode, compact), right: px(76, exportMode, compact), bottom: px(78, exportMode, compact), zIndex: 2, display: 'flex', flexDirection: 'column', gap: px(28, exportMode, compact) }}>
        <TextSlot
          value={content.title}
          editable={editable}
          onChange={(value) => onTextChange('title', value)}
          accentText={content.accentText}
          accentColor={system.accent}
          style={{
            color: system.ink,
            fontFamily: system.displayFont,
            fontSize: titleMetrics.fontSize,
            fontWeight: system.titleWeight,
            lineHeight: titleMetrics.lineHeight,
            letterSpacing: system.letterSpacing,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        />
        {content.body && (
          <TextSlot
            value={content.body}
            editable={editable}
            onChange={(value) => onTextChange('body', value)}
            accentColor={system.accent}
            style={{
              color: system.muted,
              fontFamily: system.font,
              fontSize: bodyMetrics.fontSize,
              fontWeight: system.bodyWeight,
              lineHeight: bodyMetrics.lineHeight,
              letterSpacing: '-0.015em',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxWidth: bodyMetrics.maxWidth,
            }}
          />
        )}
        <div style={{ width: px(128, exportMode, compact), height: Math.max(2, px(8, exportMode, compact)), background: system.accent }} />
      </div>
    </>
  );
}

function ImageBodyLayout(props: {
  content: SlideContent;
  label: string;
  imageUrl?: string;
  logoUrl?: string;
  slideIndex: number;
  totalSlides: number;
  isCTA: boolean;
  system: VisualSystem;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange: (field: keyof Pick<Slide, 'tagline' | 'title' | 'body' | 'cta'>, value: string) => void;
}) {
  const { content, label, imageUrl, logoUrl, slideIndex, totalSlides, isCTA, system, editable, exportMode, compact, onTextChange } = props;
  const number = String(slideIndex + 1).padStart(2, '0');
  const total = String(totalSlides).padStart(2, '0');
  const titleMetrics = getTitleMetrics(content.title, isCTA ? 'cta' : 'body', exportMode, compact);
  const bodyMetrics = getBodyMetrics(content.body, isCTA ? 'cta' : 'body', content.title, exportMode, compact);

  return (
    <>
      {imageUrl && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '34%', overflow: 'hidden', zIndex: 0 }}>
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.08)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(17,17,17,0.16), rgba(244,240,230,0.22))' }} />
        </div>
      )}

      <div style={{ position: 'absolute', top: px(72, exportMode, compact), left: px(76, exportMode, compact), right: px(76, exportMode, compact), display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: imageUrl ? '#f8f3e8' : system.ink, zIndex: 2 }}>
        <div style={{ fontSize: `${Math.max(12, px(34, exportMode, compact))}px`, fontWeight: 950, lineHeight: 1 }}>{number}</div>
        <div style={{ fontSize: `${Math.max(7, px(18, exportMode, compact))}px`, fontWeight: 900, lineHeight: 1 }}>{number}/{total}</div>
      </div>

      <div style={{ position: 'absolute', left: px(76, exportMode, compact), right: px(76, exportMode, compact), top: imageUrl ? '39%' : px(160, exportMode, compact), bottom: px(142, exportMode, compact), display: 'flex', flexDirection: 'column', justifyContent: isCTA ? 'center' : 'flex-start', gap: px(28, exportMode, compact), zIndex: 1 }}>
        {content.tagline && isCTA && (
          <div style={{ color: system.accent, fontSize: `${Math.max(8, px(22, exportMode, compact))}px`, fontWeight: 900, lineHeight: 1 }}>
            {content.tagline}
          </div>
        )}
        <TextSlot
          value={content.title}
          editable={editable}
          onChange={(value) => onTextChange('title', value)}
          accentText={content.accentText}
          accentColor={system.accent}
          style={{
            color: system.ink,
            fontFamily: system.displayFont,
            fontSize: titleMetrics.fontSize,
            fontWeight: system.titleWeight,
            lineHeight: titleMetrics.lineHeight,
            letterSpacing: system.letterSpacing,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        />
        {content.body && (
          <TextSlot
            value={content.body}
            editable={editable}
            onChange={(value) => onTextChange('body', value)}
            accentColor={system.accent}
            style={{
              color: system.muted,
              fontFamily: system.font,
              fontSize: bodyMetrics.fontSize,
              fontWeight: system.bodyWeight,
              lineHeight: bodyMetrics.lineHeight,
              letterSpacing: '-0.012em',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxWidth: bodyMetrics.maxWidth,
            }}
          />
        )}
        {content.cta && (
          <div style={{ alignSelf: 'flex-start', borderRadius: 999, background: system.accent, color: system.bg, padding: `${px(12, exportMode, compact)}px ${px(22, exportMode, compact)}px`, fontSize: `${Math.max(8, px(20, exportMode, compact))}px`, fontWeight: 900, lineHeight: 1 }}>
            {content.cta}
          </div>
        )}
      </div>

      {logoUrl && <img src={logoUrl} alt="" style={{ position: 'absolute', left: px(76, exportMode, compact), bottom: px(72, exportMode, compact), maxWidth: px(132, exportMode, compact), maxHeight: px(42, exportMode, compact), objectFit: 'contain', zIndex: 2 }} />}

      <div style={{ position: 'absolute', left: px(76, exportMode, compact), right: px(76, exportMode, compact), bottom: px(70, exportMode, compact), display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: system.muted, fontSize: `${Math.max(6, px(18, exportMode, compact))}px`, fontWeight: 850, lineHeight: 1, zIndex: 2 }}>
        <span>{isCTA ? 'proximo passo' : label}</span>
        <span>{imageUrl ? 'imagem da fonte' : 'manifesto'}</span>
      </div>
    </>
  );
}

function CoverLayout(props: {
  content: SlideContent;
  logoUrl?: string;
  system: VisualSystem;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange: (field: keyof Pick<Slide, 'tagline' | 'title' | 'body' | 'cta'>, value: string) => void;
}) {
  const { content, logoUrl, system, editable, exportMode, compact, onTextChange } = props;
  const titleMetrics = getTitleMetrics(content.title, 'cover', exportMode, compact);
  const bodyMetrics = getBodyMetrics(content.body, 'cover', content.title, exportMode, compact);

  return (
    <>
      <div style={{ position: 'absolute', top: px(82, exportMode, compact), left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <MetaPill system={system} exportMode={exportMode} compact={compact}>{content.tagline}</MetaPill>
      </div>

      {logoUrl && <img src={logoUrl} alt="" style={{ position: 'absolute', top: px(78, exportMode, compact), right: px(82, exportMode, compact), maxWidth: px(150, exportMode, compact), maxHeight: px(52, exportMode, compact), objectFit: 'contain', zIndex: 2 }} />}

      <div style={{ position: 'absolute', left: px(84, exportMode, compact), right: px(84, exportMode, compact), top: '26%', bottom: '19%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: px(34, exportMode, compact), zIndex: 1 }}>
        <TextSlot
          value={content.title}
          editable={editable}
          onChange={(value) => onTextChange('title', value)}
          accentText={content.accentText}
          accentColor={system.accent}
          style={{
            color: system.ink,
            fontFamily: system.displayFont,
            fontSize: titleMetrics.fontSize,
            fontWeight: system.titleWeight,
            lineHeight: titleMetrics.lineHeight,
            letterSpacing: system.letterSpacing,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        />

        {content.body && (
          <TextSlot
            value={content.body}
            editable={editable}
            onChange={(value) => onTextChange('body', value)}
            accentColor={system.accent}
            style={{
              color: system.muted,
              fontFamily: system.font,
              fontSize: bodyMetrics.fontSize,
              fontWeight: system.bodyWeight,
              lineHeight: bodyMetrics.lineHeight,
              letterSpacing: '-0.015em',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxWidth: bodyMetrics.maxWidth,
            }}
          />
        )}
      </div>

      <div style={{ position: 'absolute', bottom: px(82, exportMode, compact), left: 0, right: 0, textAlign: 'center', fontSize: `${Math.max(12, px(38, exportMode, compact))}px`, fontWeight: 900, lineHeight: 1, zIndex: 2 }}>→</div>
    </>
  );
}

function BodyLayout(props: {
  content: SlideContent;
  label: string;
  logoUrl?: string;
  slideIndex: number;
  totalSlides: number;
  isCTA: boolean;
  system: VisualSystem;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange: (field: keyof Pick<Slide, 'tagline' | 'title' | 'body' | 'cta'>, value: string) => void;
}) {
  const { content, label, logoUrl, slideIndex, totalSlides, isCTA, system, editable, exportMode, compact, onTextChange } = props;
  const number = String(slideIndex + 1).padStart(2, '0');
  const total = String(totalSlides).padStart(2, '0');
  const titleMetrics = getTitleMetrics(content.title, isCTA ? 'cta' : 'body', exportMode, compact);
  const bodyMetrics = getBodyMetrics(content.body, isCTA ? 'cta' : 'body', content.title, exportMode, compact);

  return (
    <>
      <div style={{ position: 'absolute', top: px(78, exportMode, compact), left: px(82, exportMode, compact), right: px(82, exportMode, compact), display: 'flex', alignItems: 'center', gap: px(18, exportMode, compact), zIndex: 2 }}>
        <div
          style={{
            width: px(76, exportMode, compact),
            height: px(76, exportMode, compact),
            minWidth: px(76, exportMode, compact),
            border: `${Math.max(1, px(2, exportMode, compact))}px solid ${system.line}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 950,
            fontSize: `${Math.max(7, px(22, exportMode, compact))}px`,
            letterSpacing: '-0.035em',
          }}
        >
          {number}
        </div>
        <div style={{ flex: 1, height: Math.max(1, px(2, exportMode, compact)), background: system.line }} />
      </div>

      <div style={{ position: 'absolute', top: px(190, exportMode, compact), left: px(82, exportMode, compact), right: px(82, exportMode, compact), bottom: px(154, exportMode, compact), display: 'flex', flexDirection: 'column', justifyContent: isCTA ? 'center' : 'flex-start', gap: px(30, exportMode, compact), zIndex: 1 }}>
        {content.tagline && isCTA && (
          <div style={{ color: system.accent, fontSize: `${Math.max(8, px(22, exportMode, compact))}px`, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {content.tagline}
          </div>
        )}

        <TextSlot
          value={content.title}
          editable={editable}
          onChange={(value) => onTextChange('title', value)}
          accentText={content.accentText}
          accentColor={system.accent}
          style={{
            color: system.ink,
            fontFamily: system.displayFont,
            fontSize: titleMetrics.fontSize,
            fontWeight: system.titleWeight,
            lineHeight: titleMetrics.lineHeight,
            letterSpacing: system.letterSpacing,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        />

        {content.body && (
          <TextSlot
            value={content.body}
            editable={editable}
            onChange={(value) => onTextChange('body', value)}
            accentColor={system.accent}
            style={{
              color: system.muted,
              fontFamily: system.font,
              fontSize: bodyMetrics.fontSize,
              fontWeight: system.bodyWeight,
              lineHeight: bodyMetrics.lineHeight,
              letterSpacing: '-0.012em',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxWidth: bodyMetrics.maxWidth,
            }}
          />
        )}

        {content.cta && (
          <div style={{ alignSelf: 'flex-start', borderRadius: 999, background: system.accent, color: system.bg, padding: `${px(12, exportMode, compact)}px ${px(22, exportMode, compact)}px`, fontSize: `${Math.max(8, px(20, exportMode, compact))}px`, fontWeight: 900, lineHeight: 1 }}>
            {content.cta}
          </div>
        )}
      </div>

      {logoUrl && <img src={logoUrl} alt="" style={{ position: 'absolute', left: px(82, exportMode, compact), bottom: px(78, exportMode, compact), maxWidth: px(140, exportMode, compact), maxHeight: px(44, exportMode, compact), objectFit: 'contain', zIndex: 2 }} />}

      <div
        style={{
          position: 'absolute',
          left: px(82, exportMode, compact),
          right: px(82, exportMode, compact),
          bottom: px(72, exportMode, compact),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: system.muted,
          fontSize: `${Math.max(6, px(18, exportMode, compact))}px`,
          fontWeight: 850,
          letterSpacing: '-0.035em',
          lineHeight: 1,
          zIndex: 2,
        }}
      >
        <span>{isCTA ? 'proximo passo' : label}</span>
        <span>{number}/{total}</span>
      </div>
    </>
  );
}
