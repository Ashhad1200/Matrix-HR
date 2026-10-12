import { resolveBrand, brandPalette, type Brand } from '@matrixhr/shared';

/** Server-side brand, read from the container env on every request (the root layout is force-dynamic). */
export const getBrand = (): Brand => resolveBrand(process.env as Record<string, string | undefined>);

const hexToHsl = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(((h * 60) + 360) % 360);
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
};
const rgbTriplet = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`; };

/** CSS that re-points the brand palette and the primary/ring tokens at the reseller's colour. Empty when not set. */
export function brandCss(brand: Brand): string {
  if (!brand.primaryColor) return '';
  const pal = brandPalette(brand.primaryColor);
  const vars = Object.entries(pal).map(([k, v]) => `--brand-${k}:${rgbTriplet(v)};`).join('');
  const c = hexToHsl(pal['700']);
  const dk = hexToHsl(pal['400']);
  return `:root{${vars}--primary:${c.h} ${c.s}% ${c.l}%;--ring:${c.h} ${c.s}% ${Math.min(c.l + 10, 90)}%;}.dark{--primary:${dk.h} ${dk.s}% ${dk.l}%;--ring:${dk.h} ${dk.s}% ${dk.l}%;}`;
}
