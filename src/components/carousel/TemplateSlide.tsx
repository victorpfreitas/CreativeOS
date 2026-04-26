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
  font: string;
  displayFont: string;
  texture: string;
}

const paperSystem: VisualSystem = {
  bg: '#f4f0e6',
  ink: '#111111',
  muted: '#57534a',
  font: 'Inter, Arial, sans-serif',
  displayFont: 'Inter, Arial Black, Arial, sans-serif',
  texture: 'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.075) 0 1px, transparent 1.2px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.045) 0 1px, transparent 1.2px)',
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
  const explicitLines = clean.split('\n').length;
  const estimatedLines = Math.max(explicitLines, Math.ceil(length / (variant === 'cover' ? 24 : 34)));
  let size = variant === 'cover' ? 96 : variant === 'cta' ? 58 : 44;

  if (estimatedLines >= 9) size *= 0.48;
  else if (estimatedLines >= 7) size *= 0.58;
  else if (estimatedLines >= 5) size *= 0.72;
  else if (estimatedLines >= 4) size *= 0.84;

  if (length > 260) size *= 0.58;
  else if (length > 210) size *= 0.68;
  else if (length > 165) size *= 0.78;
  else if (length > 120) size *= 0.88;

  return {
    fontSize: `${Math.max(px(14, exportMode, compact), px(size, exportMode, compact))}px`,
    lineHeight: variant === 'cover' ? 0.98 : 1.08,
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

  return (
    <textarea
      value={value}
      onChange={(event) => onTextChange?.(event.target.value)}
      spellCheck={false}
      style={{
        ...style,
        width: '100%',
        height: '100%',
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
          opacity: 0.3,
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
      <div style={{ position: 'absolute', top: px(82, exportMode, compact), left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <div
          style={{
            border: `${Math.max(1, px(2, exportMode, compact))}px solid ${system.ink}`,
            borderRadius: 999,
            padding: `${px(9, exportMode, compact)}px ${px(28, exportMode, compact)}px`,
            fontSize: `${Math.max(7, px(20, exportMode, compact))}px`,
            fontWeight: 900,
            letterSpacing: '-0.035em',
            lineHeight: 1,
            maxWidth: '76%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </div>

      {logoUrl && <img src={logoUrl} alt="" style={{ position: 'absolute', top: px(78, exportMode, compact), right: px(82, exportMode, compact), maxWidth: px(150, exportMode, compact), maxHeight: px(52, exportMode, compact), objectFit: 'contain', zIndex: 2 }} />}

      <div style={{ position: 'absolute', left: px(86, exportMode, compact), right: px(86, exportMode, compact), top: '25%', bottom: '21%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
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
            letterSpacing: '-0.045em',
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </div>

      <div style={{ position: 'absolute', bottom: px(82, exportMode, compact), left: 0, right: 0, textAlign: 'center', fontSize: `${Math.max(12, px(38, exportMode, compact))}px`, fontWeight: 900, lineHeight: 1, zIndex: 2 }}>→</div>
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
      <div style={{ position: 'absolute', top: px(78, exportMode, compact), left: px(82, exportMode, compact), right: px(82, exportMode, compact), display: 'flex', alignItems: 'center', gap: px(18, exportMode, compact), zIndex: 2 }}>
        <div
          style={{
            width: px(76, exportMode, compact),
            height: px(76, exportMode, compact),
            minWidth: px(76, exportMode, compact),
            border: `${Math.max(1, px(2, exportMode, compact))}px solid ${system.ink}`,
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
        <div style={{ flex: 1, height: Math.max(1, px(2, exportMode, compact)), background: system.ink }} />
      </div>

      <div style={{ position: 'absolute', top: px(188, exportMode, compact), left: px(82, exportMode, compact), right: px(82, exportMode, compact), bottom: px(154, exportMode, compact), display: 'flex', alignItems: isCTA ? 'center' : 'flex-start', zIndex: 1 }}>
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
            letterSpacing: '-0.035em',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        />
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
