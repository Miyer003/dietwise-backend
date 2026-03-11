import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const requestId = request.headers['x-request-id'] || `req_${Date.now()}`;
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 50000;
    let message = '服务器内部错误';
    let error = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      // 自定义业务错误码映射
      switch (status) {
        case 400:
          code = 40001;
          error = 'PARAM_ERROR';
          break;
        case 401:
          code = 40101;
          error = 'UNAUTHORIZED';
          break;
        case 403:
          code = 40300;
          error = 'FORBIDDEN';
          break;
        case 404:
          code = 40400;
          error = 'NOT_FOUND';
          break;
        case 429:
          code = 42900;
          error = 'RATE_LIMIT';
          break;
        default:
          code = status * 100;
      }
      
      message = exceptionResponse.message || message;
    }

    // 记录错误日志
    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} - ${status}: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      code,
      message,
      error,
      data: null,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
}