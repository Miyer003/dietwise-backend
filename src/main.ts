import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局管道与拦截器
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS 配置
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:8081'], // React Native / Web
    credentials: true,
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

  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 服务启动: http://localhost:${process.env.PORT || 3000}`);
  console.log(`📚 API文档: http://localhost:${process.env.PORT || 3000}/api-docs`);
}
bootstrap();