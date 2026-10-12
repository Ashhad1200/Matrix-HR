import { BadRequestException } from '@nestjs/common';
import { sniffProof } from '../billing/billing.config';

export const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
const TEXT_LIMIT = 20_000;

export interface Extracted { name: string; kind: 'text' | 'image'; text?: string; image?: { mime: string; base64: string } }

const clip = (s: string) => (s.length > TEXT_LIMIT ? s.slice(0, TEXT_LIMIT) + '\n[...truncated]' : s);
const isZip = (b: Buffer) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** Type is decided from the bytes, never from the client's mime or filename alone. Text pulled out of a file is data for the model, not instructions. */
export async function extractAttachment(file: { originalname: string; buffer: Buffer; size: number }): Promise<Extracted> {
  const name = file.originalname.replace(/[^\w.\- ]/g, '_').slice(0, 120);
  const buf = file.buffer;
  if (!buf || !buf.length) throw new BadRequestException('The file is empty');
  if (file.size > ATTACH_MAX_BYTES) throw new BadRequestException('Files can be at most 5 MB');
  const ext = (name.split('.').pop() || '').toLowerCase();
  const sniff = sniffProof(buf);

  if (sniff && sniff.mime !== 'application/pdf') return { name, kind: 'image', image: { mime: sniff.mime, base64: buf.toString('base64') } };
  if (sniff?.mime === 'application/pdf') {
    const pdf = require('pdf-parse/lib/pdf-parse.js');
    try { const r = await pdf(buf); return { name, kind: 'text', text: clip(String(r.text || '').trim() || '[no readable text in this PDF]') }; } catch { throw new BadRequestException('This PDF could not be read'); }
  }
  if (isZip(buf) && ext === 'docx') {
    const mammoth = require('mammoth');
    try { const r = await mammoth.extractRawText({ buffer: buf }); return { name, kind: 'text', text: clip(String(r.value || '').trim() || '[empty document]') }; } catch { throw new BadRequestException('This Word file could not be read'); }
  }
  if (isZip(buf) && ext === 'xlsx') {
    const ExcelJS = require('exceljs');
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const out: string[] = [];
      wb.eachSheet((ws: any) => {
        out.push(`## Sheet: ${ws.name}`);
        let rows = 0;
        ws.eachRow((row: any) => {
          if (rows++ >= 200) return;
          out.push((row.values as any[]).slice(1, 31).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? '') : v ?? '')).join(','));
        });
      });
      return { name, kind: 'text', text: clip(out.join('\n')) };
    } catch { throw new BadRequestException('This Excel file could not be read'); }
  }
  if ((ext === 'csv' || ext === 'txt') && !buf.includes(0)) return { name, kind: 'text', text: clip(buf.toString('utf8')) };
  throw new BadRequestException('Attach a PDF, image (png/jpg/webp), Word (.docx), Excel (.xlsx) or CSV file');
}
