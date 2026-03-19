import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // 开发环境配置
  // DEV_MODE=local: 本机开发 (localhost)
  // DEV_MODE=lan:   局域网/手机热点开发 (DEV_HOST)
  const devMode = isProduction ? null : (process.env.DEV_MODE || 'local');
  const devHost = isProduction ? null : (process.env.DEV_HOST || 'localhost');
  
  // 后端服务绑定地址
  // - 生产环境: 0.0.0.0 (接受所有请求)
  // - 开发环境 lan 模式: 0.0.0.0 (接受局域网请求)
  // - 开发环境 local 模式: localhost (仅本机)
  const serverHost = isProduction || devMode === 'lan' ? '0.0.0.0' : 'localhost';
  
  // MinIO 服务端点
  // - 生产环境: 使用配置的 MINIO_ENDPOINT (通常是域名)
  // - 开发环境 lan 模式: 使用 DEV_HOST (电脑局域网IP)
  // - 开发环境 local 模式: localhost
  const minioHost = isProduction 
    ? (process.env.MINIO_ENDPOINT || 'localhost')
    : (devMode === 'lan' ? devHost : 'localhost');
  
  return {
    isProduction,
    port: parseInt(process.env.PORT || '3000', 10),
    host: serverHost,
    nodeEnv: process.env.NODE_ENV || 'development',
    devMode,
    devHost,
    
    database: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      synchronize: !isProduction && process.env.DB_SYNC === 'true', // 生产环境强制关闭
      logging: process.env.DB_LOGGING === 'true',
    },
    
    redis: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    
    jwt: {
      secret: process.env.JWT_SECRET,
      accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '7d',
      refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '30d',
    },
    
    minio: {
      // 内部连接端点（后端服务用）
      endPoint: minioHost,
      // 公网访问端点（手机/外部客户端用，如未配置则使用 endPoint）
      publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT || minioHost,
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      bucketName: process.env.MINIO_BUCKET_NAME || 'dietwise',
    },
    
    ai: {
      dashscope: {
        apiKey: process.env.DASHSCOPE_API_KEY,
        vlModel: process.env.DASHSCOPE_VL_MODEL || 'qwen-vl-plus',
        textModel: process.env.DASHSCOPE_TEXT_MODEL || 'qwen-turbo',
        audioModel: process.env.DASHSCOPE_AUDIO_MODEL || 'qwen3-omni-flash-realtime',
        ttsModel: process.env.DASHSCOPE_TTS_MODEL || 'qwen3-tts-vd-2026-01-26',
      },
      moonshot: {
        apiKey: process.env.MOONSHOT_API_KEY,
        model: process.env.MOONSHOT_MODEL || 'kimi-v1',
      },
    },
  };
});