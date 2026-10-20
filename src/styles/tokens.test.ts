import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function sRGBtoLin(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const num = parseInt(cleanHex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relLuminance(hex1);
  const l2 = relLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Precision Ledger Design Tokens Contrast Conformance', () => {
  const lightTokens = {
    canvas: '#f8f9f6',
    surface: '#ffffff',
    surfaceSubtle: '#f2f4ef',
    textMain: '#141915',
    textMuted: '#576356',
    textSubtle: '#5e6c5d',
    textOnAccent: '#ffffff',
    brandPrimary: '#1f3d23',
    brandLime: '#ceeaa0',
    closingCardText: '#142811',
  };

  const darkTokens = {
    canvas: '#0c0f0d',
    surface: '#141915',
    surfaceSubtle: '#1e261f',
    textMain: '#f0f3ee',
    textMuted: '#9eaba0',
    textSubtle: '#869788',
    textOnAccent: '#0c0f0d',
    brandPrimary: '#2e5733',
    brandLime: '#1e3518',
    closingCardText: '#ceeaa0',
  };

  it('verifies light mode text-subtle meets WCAG AA (>= 4.5:1) on all background surfaces', () => {
    const onSurface = contrastRatio(lightTokens.textSubtle, lightTokens.surface);
    const onCanvas = contrastRatio(lightTokens.textSubtle, lightTokens.canvas);
    const onSubtle = contrastRatio(lightTokens.textSubtle, lightTokens.surfaceSubtle);

    expect(onSurface).toBeGreaterThanOrEqual(4.5);
    expect(onCanvas).toBeGreaterThanOrEqual(4.5);
    expect(onSubtle).toBeGreaterThanOrEqual(4.5);

    // Verify precise bounds
    expect(onSurface).toBeCloseTo(5.56, 1);
    expect(onCanvas).toBeCloseTo(5.26, 1);
    expect(onSubtle).toBeCloseTo(5.02, 1);
  });

  it('verifies light mode text-main and text-muted meet WCAG AA (>= 4.5:1)', () => {
    expect(contrastRatio(lightTokens.textMain, lightTokens.surface)).toBeGreaterThanOrEqual(7.0);
    expect(contrastRatio(lightTokens.textMain, lightTokens.canvas)).toBeGreaterThanOrEqual(7.0);
    expect(contrastRatio(lightTokens.textMuted, lightTokens.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightTokens.textMuted, lightTokens.canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it('verifies light mode accent combinations meet WCAG AA (>= 4.5:1)', () => {
    // White on forest green
    expect(contrastRatio(lightTokens.textOnAccent, lightTokens.brandPrimary)).toBeGreaterThanOrEqual(7.0);
    // Dark forest on lime closing card
    expect(contrastRatio(lightTokens.closingCardText, lightTokens.brandLime)).toBeGreaterThanOrEqual(7.0);
  });

  it('verifies dark mode text-subtle meets WCAG AA (>= 4.5:1) on all background surfaces', () => {
    const onSurface = contrastRatio(darkTokens.textSubtle, darkTokens.surface);
    const onCanvas = contrastRatio(darkTokens.textSubtle, darkTokens.canvas);
    const onSubtle = contrastRatio(darkTokens.textSubtle, darkTokens.surfaceSubtle);

    expect(onSurface).toBeGreaterThanOrEqual(4.5);
    expect(onCanvas).toBeGreaterThanOrEqual(4.5);
    expect(onSubtle).toBeGreaterThanOrEqual(4.5);

    // Verify precise bounds
    expect(onSurface).toBeCloseTo(5.76, 1);
    expect(onCanvas).toBeCloseTo(6.24, 1);
    expect(onSubtle).toBeCloseTo(5.03, 1);
  });

  it('verifies dark mode text-main and text-muted meet WCAG AA (>= 4.5:1)', () => {
    expect(contrastRatio(darkTokens.textMain, darkTokens.surface)).toBeGreaterThanOrEqual(7.0);
    expect(contrastRatio(darkTokens.textMain, darkTokens.canvas)).toBeGreaterThanOrEqual(7.0);
    expect(contrastRatio(darkTokens.textMuted, darkTokens.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkTokens.textMuted, darkTokens.canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it('verifies dark mode accent combinations meet WCAG AA (>= 4.5:1)', () => {
    // Dark text on lime accent button
    expect(contrastRatio(darkTokens.textOnAccent, '#ceeaa0')).toBeGreaterThanOrEqual(7.0);
    // Lime text on dark forest card
    expect(contrastRatio(darkTokens.closingCardText, darkTokens.brandLime)).toBeGreaterThanOrEqual(7.0);
  });

  it('verifies globals.css defines the exact tested accessible CSS variables', () => {
    const cssContent = fs.readFileSync(path.resolve('src/styles/globals.css'), 'utf-8');
    expect(cssContent).toContain('--text-subtle: #5e6c5d;');
    expect(cssContent).toContain('--text-subtle: #869788;');
    expect(cssContent).toContain('--bg-overlay: rgba(16, 27, 24, 0.45);');
    expect(cssContent).toContain('--bg-overlay: rgba(0, 0, 0, 0.70);');
    expect(cssContent).toContain('--border-focus: #1f3d23;');
    expect(cssContent).toContain('--border-focus: #ceeaa0;');
    expect(cssContent).toContain('--text-on-accent: #ffffff;');
    expect(cssContent).toContain('--text-on-accent: #0c0f0d;');
    expect(cssContent).toContain('--radius-sm: 6px;');
    expect(cssContent).toContain('--radius-md: 10px;');
    expect(cssContent).toContain('--radius-lg: 16px;');
  });
});
