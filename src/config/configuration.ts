import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: process.env.DB_SYNC === 'true',
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
    endPoint: process.env.MINIO_ENDPOINT,
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT,
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
}));