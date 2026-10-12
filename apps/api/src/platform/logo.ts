import { BadRequestException } from '@nestjs/common';

export const LOGO_MAX_BYTES = 256 * 1024;

/**
 * A per-client logo is stored inline as a small raster data URI so it needs no file host and is never a
 * path into someone else's storage. Type is decided from the bytes (never the declared MIME), and SVG is
 * refused because it can carry script.
 */
export function parseLogoDataUri(input: string): string {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(input ?? '');
  if (!m) throw new BadRequestException('Logo must be a PNG, JPEG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > LOGO_MAX_BYTES) throw new BadRequestException('Logo must be 256 KB or smaller');
  const png = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const webp = buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  const actual = png ? 'image/png' : jpg ? 'image/jpeg' : webp ? 'image/webp' : null;
  if (!actual || actual !== m[1]) throw new BadRequestException('That file is not a valid PNG, JPEG or WebP image');
  return input;
}

/** Multipart upload → validated data URI. The declared MIME is ignored; the bytes decide. */
export function logoFromBytes(buf: Buffer | undefined): string {
  if (!buf || buf.length === 0) throw new BadRequestException('Choose an image file');
  if (buf.length > LOGO_MAX_BYTES) throw new BadRequestException('Logo must be 256 KB or smaller');
  const png = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const webp = buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  const mime = png ? 'image/png' : jpg ? 'image/jpeg' : webp ? 'image/webp' : null;
  if (!mime) throw new BadRequestException('Logo must be a PNG, JPEG or WebP image');
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/** PDFKit draws PNG and JPEG only. */
export function logoBufferForPdf(dataUri?: string | null): Buffer | undefined {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri ?? '');
  return m ? Buffer.from(m[2], 'base64') : undefined;
}
