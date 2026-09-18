import { Global, Injectable, Logger, Module } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export type Mail = { to: string; subject: string; text: string };

/**
 * Transactional email over SMTP (SMTP_URL, e.g. smtps://user:pass@smtp.example.com). Without it, dev
 * keeps messages in an in-memory outbox (readable at GET /dev/outbox) so flows like password reset can
 * be exercised locally; production logs that email is unconfigured and never prints message bodies,
 * because they contain single-use links.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  readonly outbox: (Mail & { at: string })[] = [];

  async send(mail: Mail) {
    if (this.transporter) {
      await this.transporter.sendMail({ from: process.env.MAIL_FROM || 'MatrixHR <no-reply@matrixhr.local>', ...mail });
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(`SMTP_URL is not configured — email "${mail.subject}" was NOT delivered`);
      return;
    }
    this.outbox.unshift({ ...mail, at: new Date().toISOString() });
    this.outbox.length = Math.min(this.outbox.length, 50);
    this.logger.warn(`[dev mail] "${mail.subject}" -> ${mail.to} (see GET /dev/outbox)`);
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
