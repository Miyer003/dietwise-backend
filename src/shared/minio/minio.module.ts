import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

export const MINIO_CLIENT = 'MINIO_CLIENT';

@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      useFactory: (config: ConfigService) => {
        return new Minio.Client({
          endPoint: config.get('app.minio.endPoint') || 'localhost',
          port: config.get('app.minio.port'),
          useSSL: config.get('app.minio.useSSL'),
          accessKey: config.get('app.minio.accessKey'),
          secretKey: config.get('app.minio.secretKey'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [MINIO_CLIENT],
})
export class MinioModule {}