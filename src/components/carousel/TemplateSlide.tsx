import type { CSSProperties } from 'react';
import type { Slide } from '../../lib/types';
import { getCarouselTemplate } from '../../lib/carouselTemplates';

interface TemplateSlideProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  templateId?: string;
  watermark?: string;
  logoUrl?: string;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange?: (text: string) => void;
}

interface VisualSystem {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  inverse: string;
  font: string;
  displayFont: string;
  texture?: string;
}

const systems: Record<string, VisualSystem> = {
  'paper-manifesto': {
    bg: '#f4f1e8',
    ink: '#111111',
    muted: '#4b4b42',
    accent: '#111111',
    inverse: '#f7f2e8',
    font: "Inter, Arial, sans-serif",
    displayFont: "Inter, Arial Black, Arial, sans-serif",
    texture: 'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.08) 0 1px, transparent 1px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.06) 0 1px, transparent 1px)',
  },
  'obvious-poster': {
    bg: '#8f8f8a',
    ink: '#ffffff',
    muted: 'rgba(255,255,255,0.72)',
    accent: '#ffffff',
    inverse: '#111111',
    font: "Inter, Arial, sans-serif",
    displayFont: "Inter, Arial Black, Arial, sans-serif",
  },
  'orange-signal': {
    bg: 'linear-gradient(135deg, #060301 0%, #180701 42%, #ff4d00 100%)',
    ink: '#ffffff',
    muted: 'rgba(255,255,255,0.68)',
    accent: '#ff5a14',
    inverse: '#050505',
    font: "Inter, Arial, sans-serif",
    displayFont: "Impact, Inter, Arial Black, Arial, sans-serif",
  },
  'product-editorial': {
    bg: '#d7d2c9',
    ink: '#ffffff',
    muted: 'rgba(255,255,255,0.78)',
    accent: '#ffffff',
    inverse: '#171717',
    font: "Inter, Arial, sans-serif",
    displayFont: "Inter, Arial Black, Arial, sans-serif",
  },
};

function getSystem(templateId?: string): VisualSystem {
  return systems[templateId || ''] || systems['paper-manifesto'];
}

function fontSize(text: string, variant: 'cover' | 'body' | 'cta', exportMode?: boolean, compact?: boolean) {
  const length = text.trim().length;
  let size = variant === 'cover' ? 112 : variant === 'cta' ? 82 : 64;

  if (length > 210) size *= 0.48;
  else if (length > 160) size *= 0.58;
  else if (length > 115) size *= 0.72;
  else if (length > 75) size *= 0.84;

  if (compact) size *= 0.22;
  if (!exportMode && !compact) size *= 0.42;
  return `${Math.max(compact ? 10 : 24, Math.round(size))}${exportMode || compact ? 'px' : 'px'}`;
}

function smallSize(exportMode?: boolean, compact?: boolean) {
  if (compact) return '7px';
  return exportMode ? '28px' : '12px';
}

function padding(exportMode?: boolean, compact?: boolean) {
  if (compact) return 12;
  return exportMode ? 88 : 34;
}

function brandLabel(watermark?: string) {
  return watermark?.trim() || 'Creative OS';
}

function EditableText({
  value,
  style,
  editable,
  onTextChange,
}: {
  value: string;
  style: CSSProperties;
  editable?: boolean;
  onTextChange?: (text: string) => void;
}) {
  if (!editable) {
    return <div style={style}>{value}</div>;
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onTextChange?.(event.target.value)}
      style={{
        ...style,
        width: '100%',
        background: 'transparent',
        border: 0,
        outline: 0,
        resize: 'none',
        overflow: 'hidden',
      }}
      spellCheck={false}
    />
  );
}

export default function TemplateSlide({
  slide,
  slideIndex,
  totalSlides,
  templateId,
  watermark,
  logoUrl,
  editable,
  exportMode,
  compact,
  onTextChange,
}: TemplateSlideProps) {
  const template = getCarouselTemplate(templateId);
  const system = getSystem(template.id);
  const isCover = slideIndex === 0 || slide.type === 'hook';
  const isCTA = slideIndex === totalSlides - 1 && !isCover;
  const pad = padding(exportMode, compact);
  const label = brandLabel(watermark);
  const text = slide.text || 'Clique para escrever';
  const rootBg = slide.image_url && template.id !== 'paper-manifesto' ? '#111111' : system.bg;

  const rootStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: rootBg,
    color: system.ink,
    fontFamily: system.font,
  };

  return (
    <div style={rootStyle}>
      {system.texture && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: system.texture, backgroundSize: exportMode ? '34px 34px' : '16px 16px', opacity: 0.38 }} />
      )}

      {slide.image_url && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${slide.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: template.id === 'obvious-poster' ? 'grayscale(100%) contrast(0.95)' : 'none' }} />
      )}

      {template.id === 'obvious-poster' && (
        <div style={{ position: 'absolute', inset: 0, background: slide.image_url ? 'rgba(0,0,0,0.35)' : 'linear-gradient(180deg, rgba(120,120,116,0.95), rgba(60,60,58,0.92))' }} />
      )}

      {template.id === 'product-editorial' && (
        <div style={{ position: 'absolute', inset: 0, background: slide.image_url ? 'linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.32))' : 'linear-gradient(135deg, #b7aea3, #6f665e)' }} />
      )}

      {template.id === 'orange-signal' && (
        <>
          <div style={{ position: 'absolute', right: '-18%', top: '-5%', width: '58%', height: '72%', background: 'rgba(255,87,20,0.96)', transform: 'skewX(-18deg)' }} />
          <div style={{ position: 'absolute', left: '-12%', bottom: '-18%', width: '74%', height: '34%', background: 'rgba(255,87,20,0.35)', transform: 'skewX(-20deg)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: exportMode ? '86px 86px' : '34px 34px', opacity: 0.38 }} />
        </>
      )}

      {template.id === 'paper-manifesto' ? (
        <PaperLayout
          text={text}
          label={label}
          logoUrl={logoUrl}
          slideIndex={slideIndex}
          totalSlides={totalSlides}
          isCover={isCover}
          isCTA={isCTA}
          system={system}
          pad={pad}
          editable={editable}
          exportMode={exportMode}
          compact={compact}
          onTextChange={onTextChange}
        />
      ) : (
        <PosterLayout
          text={text}
          label={label}
          logoUrl={logoUrl}
          slideIndex={slideIndex}
          totalSlides={totalSlides}
          isCover={isCover}
          isCTA={isCTA}
          system={system}
          templateId={template.id}
          pad={pad}
          editable={editable}
          exportMode={exportMode}
          compact={compact}
          onTextChange={onTextChange}
        />
      )}
    </div>
  );
}

function PaperLayout(props: {
  text: string;
  label: string;
  logoUrl?: string;
  slideIndex: number;
  totalSlides: number;
  isCover: boolean;
  isCTA: boolean;
  system: VisualSystem;
  pad: number;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange?: (text: string) => void;
}) {
  const { text, label, logoUrl, slideIndex, totalSlides, isCover, isCTA, system, pad, editable, exportMode, compact, onTextChange } = props;
  const number = String(slideIndex + 1).padStart(2, '0');

  if (isCover) {
    return (
      <>
        <div style={{ position: 'absolute', top: pad, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ border: `${exportMode ? 3 : 1}px solid ${system.ink}`, borderRadius: 999, padding: exportMode ? '12px 34px' : compact ? '2px 8px' : '5px 16px', fontSize: smallSize(exportMode, compact), fontWeight: 900, letterSpacing: '-0.02em' }}>{label}</div>
        </div>
        {logoUrl && <img src={logoUrl} alt="" style={{ position: 'absolute', top: pad, right: pad, maxWidth: exportMode ? 150 : 70, maxHeight: exportMode ? 56 : 26, objectFit: 'contain' }} />}
        <div style={{ position: 'absolute', left: pad, right: pad, top: '24%', bottom: '24%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EditableText
            value={text}
            editable={editable}
            onTextChange={onTextChange}
            style={{
              color: system.ink,
              fontFamily: system.displayFont,
              fontSize: fontSize(text, 'cover', exportMode, compact),
              fontWeight: 950,
              lineHeight: 0.88,
              letterSpacing: '-0.055em',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          />
        </div>
        <div style={{ position: 'absolute', bottom: pad, left: 0, right: 0, textAlign: 'center', fontSize: compact ? 11 : exportMode ? 42 : 24, fontWeight: 900 }}>→</div>
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'absolute', top: pad, left: pad, display: 'flex', alignItems: 'center', gap: exportMode ? 22 : 8 }}>
        <div style={{ width: exportMode ? 88 : compact ? 28 : 42, height: exportMode ? 88 : compact ? 28 : 42, border: `${exportMode ? 3 : 1}px solid ${system.ink}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: compact ? 7 : exportMode ? 28 : 13 }}>{number}</div>
        <div style={{ width: exportMode ? 660 : compact ? 88 : 245, height: exportMode ? 3 : 1, background: system.ink }} />
      </div>
      <div style={{ position: 'absolute', top: exportMode ? 220 : compact ? 66 : 106, left: pad, right: pad }}>
        <EditableText
          value={text}
          editable={editable}
          onTextChange={onTextChange}
          style={{
            color: system.ink,
            fontFamily: system.displayFont,
            fontSize: fontSize(text, isCTA ? 'cta' : 'body', exportMode, compact),
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: '-0.05em',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        />
      </div>
      <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, height: compact ? 40 : exportMode ? 245 : 110, background: system.ink, color: system.inverse, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: compact ? 8 : exportMode ? 42 : 20, textAlign: 'center', fontSize: compact ? 6 : exportMode ? 30 : 12, fontWeight: 900, lineHeight: 1.15 }}>
        {isCTA ? 'próximo passo' : `${label} · ${number}/${String(totalSlides).padStart(2, '0')}`}
      </div>
    </>
  );
}

function PosterLayout(props: {
  text: string;
  label: string;
  logoUrl?: string;
  slideIndex: number;
  totalSlides: number;
  isCover: boolean;
  isCTA: boolean;
  system: VisualSystem;
  templateId: string;
  pad: number;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange?: (text: string) => void;
}) {
  const { text, label, logoUrl, slideIndex, totalSlides, isCover, isCTA, system, templateId, pad, editable, exportMode, compact, onTextChange } = props;
  const align: CSSProperties['textAlign'] = templateId === 'orange-signal' ? 'left' : 'left';
  const vertical = isCover ? '22%' : '18%';

  return (
    <>
      <div style={{ position: 'absolute', top: pad, left: pad, right: pad, display: 'flex', justifyContent: 'space-between', color: system.muted, fontSize: smallSize(exportMode, compact), fontWeight: 850, letterSpacing: '-0.045em', lineHeight: 0.95 }}>
        <span>{label}</span>
        <span>{String(slideIndex + 1).padStart(2, '0')}/{String(totalSlides).padStart(2, '0')}</span>
      </div>
      <div style={{ position: 'absolute', left: pad, right: pad, top: vertical, bottom: isCTA ? '18%' : '14%', display: 'flex', alignItems: isCover ? 'center' : 'flex-start' }}>
        <EditableText
          value={text}
          editable={editable}
          onTextChange={onTextChange}
          style={{
            color: system.ink,
            fontFamily: system.displayFont,
            fontSize: fontSize(text, isCover ? 'cover' : isCTA ? 'cta' : 'body', exportMode, compact),
            fontWeight: templateId === 'orange-signal' ? 950 : 900,
            lineHeight: templateId === 'orange-signal' ? 0.9 : 0.88,
            letterSpacing: '-0.065em',
            textAlign: align,
            textTransform: templateId === 'orange-signal' ? 'uppercase' : 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textShadow: templateId === 'orange-signal' ? '0 10px 40px rgba(0,0,0,0.45)' : 'none',
          }}
        />
      </div>
      {templateId === 'orange-signal' && (
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, height: compact ? 16 : exportMode ? 62 : 28, borderTop: `${exportMode ? 4 : 2}px solid rgba(255,255,255,0.55)`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', color: 'rgba(255,255,255,0.82)', fontSize: smallSize(exportMode, compact), fontWeight: 900 }}>
          <span>{label}</span>
          <span>arrasta para conferir</span>
        </div>
      )}
      {templateId !== 'orange-signal' && (
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: system.muted, fontSize: smallSize(exportMode, compact), fontWeight: 850, letterSpacing: '-0.04em' }}>
          <span>{isCTA ? 'salve para aplicar' : 'arrasta para o lado'}</span>
          {logoUrl ? <img src={logoUrl} alt="" style={{ maxWidth: exportMode ? 150 : 68, maxHeight: exportMode ? 54 : 24, objectFit: 'contain' }} /> : <span>→</span>}
        </div>
      )}
    </>
  );
}
