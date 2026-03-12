import { Injectable, Inject } from '@nestjs/common';
import * as Minio from 'minio';
import { MINIO_CLIENT } from './minio.constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioService {
  private bucketName: string;

  constructor(
    @Inject(MINIO_CLIENT) private readonly minioClient: Minio.Client,
    private readonly config: ConfigService,
  ) {
    this.bucketName = this.config.get('app.minio.bucketName') || 'dietwise';
  }

  async createBucketIfNotExists(): Promise<void> {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
      // 设置公开读策略（生产环境建议更严格的策略）
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucketName}/*`],
          },
        ],
      };
      await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
    }
  }

  async getPresignedPutUrl(objectName: string, expirySeconds: number = 600): Promise<string> {
    return this.minioClient.presignedPutObject(this.bucketName, objectName, expirySeconds);
  }

  async getPresignedGetUrl(objectName: string, expirySeconds: number = 86400): Promise<string> {
    return this.minioClient.presignedGetObject(this.bucketName, objectName, expirySeconds);
  }

  getPublicUrl(objectName: string): string {
    const protocol = this.config.get('app.minio.useSSL') ? 'https' : 'http';
    const endpoint = this.config.get('app.minio.endPoint');
    const port = this.config.get('app.minio.port');
    return `${protocol}://${endpoint}:${port}/${this.bucketName}/${objectName}`;
  }
}