import type { INestApplication } from '@nestjs/common';

export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
}
