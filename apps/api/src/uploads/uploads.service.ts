import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
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
    // ponytail: public-read bucket policy is a dev-appropriate simplification, not a
    // production one — Phase 6 (per ENGINEERING_ROADMAP.md) should move to presigned
    // per-object URLs or a CDN-fronted bucket so documents aren't world-readable by URL guess.
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket })).catch(() => {});
    }
    try {
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        }),
      );
    } catch (err) {
      this.logger.warn(`Could not set bucket policy (non-fatal in dev): ${err}`);
    }
  }

  async uploadFile(tenantId: string, file: Express.Multer.File): Promise<{ url: string; key: string }> {
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

    return { url: `${this.publicEndpoint}/${this.bucket}/${key}`, key };
  }
}
