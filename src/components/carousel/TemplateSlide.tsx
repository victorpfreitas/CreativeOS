import type { CSSProperties, FormEvent } from 'react';
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
  inverse: string;
  font: string;
  displayFont: string;
  texture: string;
}

const paperSystem: VisualSystem = {
  bg: '#f4f0e6',
  ink: '#111111',
  muted: '#57534a',
  inverse: '#f4f0e6',
  font: 'Inter, Arial, sans-serif',
  displayFont: 'Inter, Arial Black, Arial, sans-serif',
  texture: 'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.085) 0 1px, transparent 1.2px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.055) 0 1px, transparent 1.2px)',
};

function getScale(exportMode?: boolean, compact?: boolean) {
  if (compact) return 0.22;
  return exportMode ? 1 : 0.42;
}

function px(value: number, exportMode?: boolean, compact?: boolean) {
  return Math.round(value * getScale(exportMode, compact));
}

function getTextMetrics(text: string, variant: 'cover' | 'body' | 'cta', exportMode?: boolean, compact?: boolean) {
  const clean = text.trim();
  const length = clean.length;
  const lines = clean.split('\n').length;
  let size = variant === 'cover' ? 116 : variant === 'cta' ? 78 : 56;
  let lineHeight = variant === 'cover' ? 0.88 : 1.06;

  if (length > 260) size *= 0.46;
  else if (length > 210) size *= 0.54;
  else if (length > 165) size *= 0.64;
  else if (length > 120) size *= 0.76;
  else if (length > 82) size *= 0.88;

  if (lines > 6) size *= 0.72;
  else if (lines > 4) size *= 0.84;

  return {
    fontSize: `${Math.max(px(24, exportMode, compact), px(size, exportMode, compact))}px`,
    lineHeight,
  };
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

  function handleInput(event: FormEvent<HTMLDivElement>) {
    onTextChange?.(event.currentTarget.innerText);
  }

  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      style={{
        ...style,
        minHeight: '1em',
        cursor: 'text',
        outline: 'none',
      }}
    >
      {value}
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
  editable,
  exportMode,
  compact,
  onTextChange,
}: TemplateSlideProps) {
  const template = getCarouselTemplate(templateId);
  const system = paperSystem;
  const isCover = slideIndex === 0 || slide.type === 'hook';
  const isCTA = slideIndex === totalSlides - 1 && !isCover;
  const label = brandLabel(watermark);
  const text = slide.text || 'Clique para escrever';

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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: system.texture,
          backgroundSize: exportMode ? '32px 32px' : compact ? '7px 7px' : '15px 15px',
          opacity: 0.32,
        }}
      />

      {isCover ? (
        <CoverLayout
          text={text}
          label={label}
          logoUrl={logoUrl}
          system={system}
          editable={editable}
          exportMode={exportMode}
          compact={compact}
          onTextChange={onTextChange}
        />
      ) : (
        <BodyLayout
          text={text}
          label={label}
          logoUrl={logoUrl}
          slideIndex={slideIndex}
          totalSlides={totalSlides}
          isCTA={isCTA}
          templateName={template.name}
          system={system}
          editable={editable}
          exportMode={exportMode}
          compact={compact}
          onTextChange={onTextChange}
        />
      )}
    </div>
  );
}

function CoverLayout(props: {
  text: string;
  label: string;
  logoUrl?: string;
  system: VisualSystem;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange?: (text: string) => void;
}) {
  const { text, label, logoUrl, system, editable, exportMode, compact, onTextChange } = props;
  const metrics = getTextMetrics(text, 'cover', exportMode, compact);

  return (
    <>
      <div style={{ position: 'absolute', top: px(86, exportMode, compact), left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            border: `${Math.max(1, px(2, exportMode, compact))}px solid ${system.ink}`,
            borderRadius: 999,
            padding: `${px(9, exportMode, compact)}px ${px(30, exportMode, compact)}px`,
            fontSize: `${Math.max(7, px(22, exportMode, compact))}px`,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {label}
        </div>
      </div>

      {logoUrl && <img src={logoUrl} alt="" style={{ position: 'absolute', top: px(78, exportMode, compact), right: px(82, exportMode, compact), maxWidth: px(150, exportMode, compact), maxHeight: px(52, exportMode, compact), objectFit: 'contain' }} />}

      <div style={{ position: 'absolute', left: px(88, exportMode, compact), right: px(88, exportMode, compact), top: '23%', bottom: '19%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EditableText
          value={text}
          editable={editable}
          onTextChange={onTextChange}
          style={{
            color: system.ink,
            fontFamily: system.displayFont,
            fontSize: metrics.fontSize,
            fontWeight: 950,
            lineHeight: metrics.lineHeight,
            letterSpacing: '-0.065em',
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        />
      </div>

      <div style={{ position: 'absolute', bottom: px(82, exportMode, compact), left: 0, right: 0, textAlign: 'center', fontSize: `${Math.max(12, px(42, exportMode, compact))}px`, fontWeight: 900, lineHeight: 1 }}>→</div>
    </>
  );
}

function BodyLayout(props: {
  text: string;
  label: string;
  logoUrl?: string;
  slideIndex: number;
  totalSlides: number;
  isCTA: boolean;
  templateName: string;
  system: VisualSystem;
  editable?: boolean;
  exportMode?: boolean;
  compact?: boolean;
  onTextChange?: (text: string) => void;
}) {
  const { text, label, logoUrl, slideIndex, totalSlides, isCTA, system, editable, exportMode, compact, onTextChange } = props;
  const number = String(slideIndex + 1).padStart(2, '0');
  const total = String(totalSlides).padStart(2, '0');
  const metrics = getTextMetrics(text, isCTA ? 'cta' : 'body', exportMode, compact);

  return (
    <>
      <div style={{ position: 'absolute', top: px(78, exportMode, compact), left: px(82, exportMode, compact), right: px(82, exportMode, compact), display: 'flex', alignItems: 'center', gap: px(18, exportMode, compact) }}>
        <div
          style={{
            width: px(80, exportMode, compact),
            height: px(80, exportMode, compact),
            minWidth: px(80, exportMode, compact),
            border: `${Math.max(1, px(2, exportMode, compact))}px solid ${system.ink}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 950,
            fontSize: `${Math.max(7, px(24, exportMode, compact))}px`,
            letterSpacing: '-0.04em',
          }}
        >
          {number}
        </div>
        <div style={{ flex: 1, height: Math.max(1, px(2, exportMode, compact)), background: system.ink }} />
      </div>

      <div style={{ position: 'absolute', top: px(208, exportMode, compact), left: px(82, exportMode, compact), right: px(82, exportMode, compact), bottom: px(188, exportMode, compact), display: 'flex', alignItems: isCTA ? 'center' : 'flex-start' }}>
        <EditableText
          value={text}
          editable={editable}
          onTextChange={onTextChange}
          style={{
            color: system.ink,
            fontFamily: system.displayFont,
            fontSize: metrics.fontSize,
            fontWeight: 900,
            lineHeight: metrics.lineHeight,
            letterSpacing: '-0.055em',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '100%',
            overflow: 'hidden',
          }}
        />
      </div>

      {logoUrl && <img src={logoUrl} alt="" style={{ position: 'absolute', left: px(82, exportMode, compact), bottom: px(78, exportMode, compact), maxWidth: px(140, exportMode, compact), maxHeight: px(44, exportMode, compact), objectFit: 'contain' }} />}

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
          fontSize: `${Math.max(6, px(20, exportMode, compact))}px`,
          fontWeight: 850,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        <span>{isCTA ? 'proximo passo' : label}</span>
        <span>{number}/{total}</span>
      </div>
    </>
  );
}
