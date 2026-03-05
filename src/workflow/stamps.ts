export type StampCategory = 'status' | 'aec' | 'custom';

export type StampDef = {
  id: string;
  label: string;
  color: string;
  defaultWidth: number;   // normalized
  defaultHeight: number;  // normalized
  category?: StampCategory;
  borderStyle?: 'solid' | 'dashed';
  imageUrl?: string;
};

export const STAMP_LIBRARY: StampDef[] = [
  { id: 'approved', label: 'APPROVED', color: '#16a34a', defaultWidth: 0.08, defaultHeight: 0.04, category: 'status' },
  { id: 'rejected', label: 'REJECTED', color: '#dc2626', defaultWidth: 0.08, defaultHeight: 0.04, category: 'status' },
  { id: 'revision', label: 'REVISION', color: '#f59e0b', defaultWidth: 0.08, defaultHeight: 0.04, category: 'status' },
  { id: 'draft', label: 'DRAFT', color: '#6b7280', defaultWidth: 0.06, defaultHeight: 0.03, category: 'status' },
  { id: 'final', label: 'FINAL', color: '#2563eb', defaultWidth: 0.06, defaultHeight: 0.03, category: 'status' },
  { id: 'confidential', label: 'CONFIDENTIAL', color: '#dc2626', defaultWidth: 0.12, defaultHeight: 0.04, category: 'status' },
];

export const AEC_STAMPS: StampDef[] = [
  { id: 'rfi', label: 'RFI', color: '#2563eb', defaultWidth: 0.06, defaultHeight: 0.03, category: 'aec' },
  { id: 'asi', label: 'ASI', color: '#7c3aed', defaultWidth: 0.06, defaultHeight: 0.03, category: 'aec' },
  { id: 'co', label: 'CHANGE ORDER', color: '#ea580c', defaultWidth: 0.10, defaultHeight: 0.04, category: 'aec' },
  { id: 'punch', label: 'PUNCH ITEM', color: '#dc2626', defaultWidth: 0.08, defaultHeight: 0.04, category: 'aec' },
  { id: 'hold', label: 'HOLD', color: '#dc2626', defaultWidth: 0.06, defaultHeight: 0.03, category: 'aec', borderStyle: 'dashed' },
  { id: 'verified', label: 'VERIFIED', color: '#16a34a', defaultWidth: 0.08, defaultHeight: 0.04, category: 'aec' },
  { id: 'not-approved', label: 'NOT APPROVED', color: '#dc2626', defaultWidth: 0.10, defaultHeight: 0.04, category: 'aec' },
];

const CUSTOM_STAMPS_KEY = 'kpdf-custom-stamps';

export function loadCustomStamps(): StampDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STAMPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StampDef[];
    return parsed.map((s) => ({ ...s, category: 'custom' as StampCategory }));
  } catch {
    return [];
  }
}

export function saveCustomStamps(stamps: StampDef[]): void {
  localStorage.setItem(CUSTOM_STAMPS_KEY, JSON.stringify(stamps));
}

export function getAllStamps(): StampDef[] {
  return [...STAMP_LIBRARY, ...AEC_STAMPS, ...loadCustomStamps()];
}

export function addCustomStamp(stamp: StampDef): void {
  const customs = loadCustomStamps();
  customs.push({ ...stamp, category: 'custom' });
  saveCustomStamps(customs);
}

export function removeCustomStamp(id: string): void {
  const customs = loadCustomStamps().filter((s) => s.id !== id);
  saveCustomStamps(customs);
}

export function getStamp(id: string): StampDef | undefined {
  return getAllStamps().find((s) => s.id === id);
}

export function getStampLabel(id: string): string {
  return getStamp(id)?.label ?? id.toUpperCase();
}
