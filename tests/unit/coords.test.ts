import { describe, it, expect } from 'vitest';
import { screenToPdf, pdfToScreen, screenLenToPdf } from '../../src/overlay/coords';

describe('coordinate conversion', () => {
  const H = 800; // page height in points
  const scale = 2;

  it('flips the y axis between screen and PDF space', () => {
    // top of the page in screen space (y=0) is the top in PDF space (y=H)
    expect(pdfToScreen(0, H, H, scale)).toEqual({ x: 0, y: 0 });
    // bottom of the page (screen y = H*scale) is PDF y = 0
    expect(pdfToScreen(0, 0, H, scale)).toEqual({ x: 0, y: H * scale });
  });

  it('round-trips screen -> pdf -> screen', () => {
    const sx = 120;
    const sy = 340;
    const p = screenToPdf(sx, sy, H, scale);
    const back = pdfToScreen(p.x, p.y, H, scale);
    expect(back.x).toBeCloseTo(sx);
    expect(back.y).toBeCloseTo(sy);
  });

  it('converts screen length to pdf points', () => {
    expect(screenLenToPdf(20, scale)).toBe(10);
  });
});
