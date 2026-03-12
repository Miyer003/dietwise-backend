import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { MinioService } from './minio.service';
import { MINIO_CLIENT } from './minio.constants';

@Global()
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
    MinioService,
  ],
  exports: [MINIO_CLIENT, MinioService],
})
export class MinioModule {}