import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteBucketPolicyCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private client: S3Client;
  private bucket: string;
  private publicEndpoint: string;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT') || 'http://localhost:9000';
    this.bucket = this.config.get<string>('S3_BUCKET') || 'matrixhr';
    // The API talks to MinIO over the Docker network; the browser needs the host-mapped port.
    this.publicEndpoint = this.config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint;

    this.client = new S3Client({
      endpoint,
      region: this.config.get<string>('S3_REGION') || 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY') || '',
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY') || '',
      },
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket })).catch(() => {});
    }
    // Files are private. Earlier versions made the bucket public-read; remove that policy so nothing is reachable by URL
    // guessing. Existing documents keep working because they are now served through short-lived signed links (FilesService).
    try {
      await this.client.send(new DeleteBucketPolicyCommand({ Bucket: this.bucket }));
    } catch (err) {
      this.logger.warn(`Could not remove a public bucket policy (fine if none exists): ${err}`);
    }
  }

  get bucketName() { return this.bucket; }
  get publicBase() { return this.publicEndpoint; }

  /** Streams an object's bytes (used by the signed-link endpoint). */
  async getObject(key: string) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return { body: out.Body as NodeJS.ReadableStream, contentType: out.ContentType, length: out.ContentLength };
  }

  async uploadFile(tenantId: string, file: Express.Multer.File): Promise<{ ref: string; key: string }> {
    const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : undefined;
    const key = `${tenantId}/${randomUUID()}${ext ? `.${ext}` : ''}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return { ref: `s3:${key}`, key };
  }

  /** For server-generated documents (payslips, reports) rather than user uploads. */
  async uploadBuffer(tenantId: string, buffer: Buffer, filename: string, contentType: string): Promise<{ ref: string; key: string }> {
    const ext = filename.includes('.') ? filename.split('.').pop() : undefined;
    const key = `${tenantId}/${randomUUID()}${ext ? `.${ext}` : ''}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return { ref: `s3:${key}`, key };
  }
}

/** A stored file reference: "s3:<key>", or a legacy public URL from before files were private. */
export function keyFromRef(ref: string, bucket: string, publicEndpoint?: string): string | null {
  if (ref.startsWith('s3:')) return ref.slice(3);
  try {
    const u = new URL(ref);
    const marker = `/${bucket}/`;
    const i = u.pathname.indexOf(marker);
    if (i !== 0 && !(publicEndpoint && ref.startsWith(publicEndpoint))) return null;
    return i >= 0 ? decodeURIComponent(u.pathname.slice(i + marker.length)) : null;
  } catch {
    return null;
  }
}
