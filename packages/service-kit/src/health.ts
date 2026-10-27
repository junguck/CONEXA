import { Controller, Get, Inject, Module, Res, type DynamicModule } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from './auth.js';

export const READINESS_CHECK = Symbol('CONEXA_READINESS_CHECK');

export type ReadinessCheck = () => Promise<boolean>;

@Controller()
export class HealthController {
  constructor(@Inject(READINESS_CHECK) private readonly check: ReadinessCheck) {}

  @Public()
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<{
    status: 'ready' | 'degraded';
    checks: Record<string, boolean>;
  }> {
    const database = await this.check().catch(() => false);
    if (!database) {
      response.status(503);
    }
    return { status: database ? 'ready' : 'degraded', checks: { database } };
  }
}

@Module({})
export class HealthModule {
  static forRoot(check: ReadinessCheck): DynamicModule {
    return {
      module: HealthModule,
      providers: [{ provide: READINESS_CHECK, useValue: check }, HealthController],
      controllers: [HealthController],
    };
  }
}
