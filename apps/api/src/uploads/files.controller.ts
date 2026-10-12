import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { UploadsService } from './uploads.service';

const SAFE_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp)|application\/(msword|vnd\.openxmlformats-officedocument\.[\w.+-]+))$/;

/** Serves a file for a valid signed link. No login is needed (the link IS the credential) and every link expires in minutes. */
@Controller('files')
export class FilesController {
  constructor(private files: FilesService, private uploads: UploadsService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':token')
  async get(@Param('token') token: string, @Res() res: Response) {
    const t = this.files.verify(token);
    let obj;
    try { obj = await this.uploads.getObject(t.k); } catch { throw new NotFoundException('File not found'); }
    const type = obj.contentType && SAFE_TYPES.test(obj.contentType) ? obj.contentType : 'application/octet-stream';
    const name = (t.n || t.k.split('/').pop() || 'file').replace(/[^\w.\- ]/g, '_');
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', `${type === 'application/octet-stream' ? 'attachment' : t.d ?? 'attachment'}; filename="${name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    if (obj.length != null) res.setHeader('Content-Length', String(obj.length));
    (obj.body as any).pipe(res);
  }
}
