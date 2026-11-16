import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function setupApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
}
