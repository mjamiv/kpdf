import { describe, it, expect } from 'vitest';
import { detectSheetReferences, extractSheetNumber } from './sheetDetection';

describe('detectSheetReferences', () => {
  it('detects "SEE SHEET A-101"', () => {
    const refs = detectSheetReferences('Please SEE SHEET A-101 for details', 0);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    const match = refs.find((r) => r.targetSheet === 'A-101');
    expect(match).toBeDefined();
    expect(match!.position.pageIndex).toBe(0);
  });

  it('detects "REFER TO S-201"', () => {
    const refs = detectSheetReferences('REFER TO S-201', 2);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].targetSheet).toBe('S-201');
    expect(refs[0].position.pageIndex).toBe(2);
  });

  it('detects "SEE DETAIL A/S-201"', () => {
    const refs = detectSheetReferences('SEE DETAIL A/S-201', 0);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].targetSheet).toBe('S-201');
  });

  it('detects "DETAIL 3/A-201"', () => {
    const refs = detectSheetReferences('DETAIL 3/A-201', 0);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    const match = refs.find((r) => r.targetSheet === 'A-201');
    expect(match).toBeDefined();
  });

  it('detects "SHEET M-001"', () => {
    const refs = detectSheetReferences('SHEET M-001', 0);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].targetSheet).toBe('M-001');
  });

  it('detects "SEE A-101"', () => {
    const refs = detectSheetReferences('SEE A-101', 0);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].targetSheet).toBe('A-101');
  });

  it('detects standalone sheet IDs', () => {
    const refs = detectSheetReferences('Drawing reference E-100 is here', 0);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs.some((r) => r.targetSheet === 'E-100')).toBe(true);
  });

  it('deduplicates references to the same sheet on the same page', () => {
    const text = 'SEE SHEET A-101 and also REFER TO A-101';
    const refs = detectSheetReferences(text, 0);
    const a101Refs = refs.filter((r) => r.targetSheet === 'A-101');
    expect(a101Refs.length).toBe(1);
  });

  it('detects multiple different sheet references', () => {
    const text = 'SEE SHEET A-101 and REFER TO S-201';
    const refs = detectSheetReferences(text, 0);
    expect(refs.length).toBeGreaterThanOrEqual(2);
    expect(refs.some((r) => r.targetSheet === 'A-101')).toBe(true);
    expect(refs.some((r) => r.targetSheet === 'S-201')).toBe(true);
  });

  it('is case-insensitive for keywords', () => {
    const refs = detectSheetReferences('see sheet A-101', 0);
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].targetSheet).toBe('A-101');
  });

  it('returns empty array for text with no references', () => {
    const refs = detectSheetReferences('This is a regular paragraph with no references.', 0);
    expect(refs).toEqual([]);
  });

  it('defaults pageIndex to 0', () => {
    const refs = detectSheetReferences('SHEET A-101');
    expect(refs[0].position.pageIndex).toBe(0);
  });
});

describe('extractSheetNumber', () => {
  it('extracts from "SHEET: A-101"', () => {
    expect(extractSheetNumber('Title block SHEET: A-101')).toBe('A-101');
  });

  it('extracts from "SHEET NO: S-201"', () => {
    expect(extractSheetNumber('SHEET NO: S-201')).toBe('S-201');
  });

  it('extracts from "DRAWING NO: M-001"', () => {
    expect(extractSheetNumber('DRAWING NO: M-001')).toBe('M-001');
  });

  it('extracts from "DWG NO. E-100"', () => {
    expect(extractSheetNumber('DWG NO. E-100')).toBe('E-100');
  });

  it('falls back to first sheet ID found', () => {
    expect(extractSheetNumber('Some text with P-300 in it')).toBe('P-300');
  });

  it('returns null for text with no sheet IDs', () => {
    expect(extractSheetNumber('No sheet numbers here')).toBeNull();
  });

  it('uppercases the result', () => {
    // Even if the text has lowercase, the result is uppercased
    expect(extractSheetNumber('sheet: a-101')).toBe('A-101');
  });
});
