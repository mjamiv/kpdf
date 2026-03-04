export type StampDef = {
  id: string;
  label: string;
  color: string;
  defaultWidth: number;   // normalized
  defaultHeight: number;  // normalized
};

export const STAMP_LIBRARY: StampDef[] = [
  { id: 'approved', label: 'APPROVED', color: '#16a34a', defaultWidth: 0.08, defaultHeight: 0.04 },
  { id: 'rejected', label: 'REJECTED', color: '#dc2626', defaultWidth: 0.08, defaultHeight: 0.04 },
  { id: 'revision', label: 'REVISION', color: '#f59e0b', defaultWidth: 0.08, defaultHeight: 0.04 },
  { id: 'draft', label: 'DRAFT', color: '#6b7280', defaultWidth: 0.06, defaultHeight: 0.03 },
  { id: 'final', label: 'FINAL', color: '#2563eb', defaultWidth: 0.06, defaultHeight: 0.03 },
  { id: 'confidential', label: 'CONFIDENTIAL', color: '#dc2626', defaultWidth: 0.12, defaultHeight: 0.04 },
];

export function getStamp(id: string): StampDef | undefined {
  return STAMP_LIBRARY.find((s) => s.id === id);
}

export function getStampLabel(id: string): string {
  return getStamp(id)?.label ?? id.toUpperCase();
}
