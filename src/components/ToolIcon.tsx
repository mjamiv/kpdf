import type { Tool } from '../types';

type IconProps = { size?: number };

const S = 18; // default icon size

function SelectIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2l8.5 12-3.2-1.8L5.7 16.5 4.2 15l2.6-4.3L3 9.5z" fill="currentColor" />
    </svg>
  );
}

function PenIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 15c2-4 5-8 8-10s4-1.5 4.5-.5-1 3-3 5.5S5 16 2 15z" />
    </svg>
  );
}

function RectIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="14" height="12" rx="1" />
    </svg>
  );
}

function HighlightIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="7" width="16" height="5" rx="0.5" fill="currentColor" opacity="0.25" />
      <line x1="1" y1="14" x2="17" y2="14" />
    </svg>
  );
}

function TextIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3h10M9 3v12M6 15h6" />
    </svg>
  );
}

function ArrowIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="16" x2="14" y2="4" />
      <polyline points="8,4 14,4 14,10" />
    </svg>
  );
}

function CalloutIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="11" height="8" rx="1" />
      <line x1="5" y1="6" x2="2" y2="15" />
    </svg>
  );
}

function CloudIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13a3 3 0 010-6 4.5 4.5 0 018.5-1A3 3 0 0115 12H4z" />
    </svg>
  );
}

function MeasureIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="14" x2="16" y2="4" />
      <line x1="2" y1="11" x2="2" y2="14" />
      <line x1="16" y1="4" x2="16" y2="7" />
      <text x="7" y="12" fill="currentColor" fontSize="5" fontFamily="sans-serif" stroke="none">10</text>
    </svg>
  );
}

function PolygonIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="9,2 16,7 14,16 4,16 2,7" />
    </svg>
  );
}

function StampIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="12" height="8" rx="1" />
      <line x1="2" y1="15" x2="16" y2="15" />
      <line x1="9" y1="12" x2="9" y2="15" />
    </svg>
  );
}

function EllipseIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="9" cy="9" rx="7" ry="5" />
    </svg>
  );
}

function AreaIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="2,15 9,2 16,15" fill="currentColor" opacity="0.12" />
      <polygon points="2,15 9,2 16,15" />
      <text x="6" y="14" fill="currentColor" fontSize="5" fontFamily="sans-serif" stroke="none">A</text>
    </svg>
  );
}

function AngleIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="14" x2="9" y2="3" />
      <line x1="3" y1="14" x2="16" y2="14" />
      <path d="M6 14a5 5 0 01-1.5-3.5" fill="none" />
    </svg>
  );
}

function CountIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="6" />
      <text x="9" y="12" fill="currentColor" fontSize="8" fontFamily="sans-serif" textAnchor="middle" stroke="none">3</text>
    </svg>
  );
}

function DimensionIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="9" x2="16" y2="9" />
      <line x1="2" y1="6" x2="2" y2="12" />
      <line x1="16" y1="6" x2="16" y2="12" />
      <polyline points="2,9 4.5,7.5" />
      <polyline points="16,9 13.5,7.5" />
    </svg>
  );
}

function PolylineIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,14 6,5 10,12 16,3" />
    </svg>
  );
}

function HyperlinkIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 10.5l3-3" />
      <path d="M10 7a3 3 0 014 4l-2 2a3 3 0 01-4-4" />
      <path d="M8 11a3 3 0 01-4-4l2-2a3 3 0 014 4" />
    </svg>
  );
}

const ICON_MAP: Record<Tool, React.FC<IconProps>> = {
  select: SelectIcon,
  pen: PenIcon,
  rectangle: RectIcon,
  highlight: HighlightIcon,
  text: TextIcon,
  arrow: ArrowIcon,
  callout: CalloutIcon,
  cloud: CloudIcon,
  measurement: MeasureIcon,
  polygon: PolygonIcon,
  stamp: StampIcon,
  ellipse: EllipseIcon,
  area: AreaIcon,
  angle: AngleIcon,
  count: CountIcon,
  dimension: DimensionIcon,
  polyline: PolylineIcon,
  hyperlink: HyperlinkIcon,
};

type ToolIconProps = {
  tool: Tool;
  size?: number;
};

export default function ToolIcon({ tool, size }: ToolIconProps) {
  const Icon = ICON_MAP[tool];
  if (!Icon) return null;
  return <Icon size={size} />;
}
