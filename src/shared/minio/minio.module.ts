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
        // 开发环境下，如果配置了 PUBLIC_ENDPOINT，使用它作为 endpoint
        // 这样生成的预签名 URL 就是正确的公网地址
        const publicEndpoint = config.get('app.minio.publicEndpoint');
        const endPoint = publicEndpoint || config.get('app.minio.endPoint') || 'localhost';
        
        return new Minio.Client({
          endPoint,
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