import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ServiceExceptionFilter } from './common/errors/service-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }]
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new ServiceExceptionFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
}

bootstrap();
