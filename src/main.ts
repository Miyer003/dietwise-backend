import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import * as bodyParser from 'body-parser';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // 获取服务配置
  const port = configService.get('app.port') || 3000;
  const host = configService.get('app.host') || '0.0.0.0';
  const devMode = configService.get('app.devMode') || 'local';
  const devHost = configService.get('app.devHost') || 'localhost';

  // 配置 body parser，允许空请求体，增加大小限制以支持 base64 图片
  app.use(bodyParser.json({ 
    strict: false,  // 允许非严格模式，接受更多类型的 JSON
    limit: '10mb',  // 增加到 10MB 以支持 base64 图片
  }));
  app.use(bodyParser.urlencoded({ 
    extended: true,
    limit: '10mb',
  }));

  // 全局管道与拦截器
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    forbidNonWhitelisted: false,  // 改为 false，允许未定义的字段
    skipMissingProperties: true,  // 跳过缺失的属性验证
  }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS 配置 - 允许所有来源（开发环境）
  app.enableCors({
    origin: true, // 允许所有来源
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // API 前缀
  app.setGlobalPrefix('v1');

  // Swagger 文档（开发环境）
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('膳智 DietWise API')
      .setDescription('智能膳食管理系统 API 文档')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(port, host);
  
  // 根据模式显示不同的访问地址
  if (devMode === 'lan' || devMode === 'hotspot') {
    console.log(`🚀 服务启动 (局域网模式)`);
    console.log(`   本机访问: http://localhost:${port}`);
    console.log(`   局域网访问: http://${devHost}:${port}`);
    console.log(`   API文档: http://${devHost}:${port}/api-docs`);
  } else {
    console.log(`🚀 服务启动 (本机模式): http://localhost:${port}`);
    console.log(`📚 API文档: http://localhost:${port}/api-docs`);
  }
}
bootstrap();