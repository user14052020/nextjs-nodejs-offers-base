import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';

import { ServiceException } from './service.exception';

@Catch(ServiceException)
export class ServiceExceptionFilter implements ExceptionFilter {
  catch(exception: ServiceException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(exception.status).json({
      error: exception.code,
      message: exception.message
    });
  }
}
