import { Controller, Get } from '@nestjs/common';
import { Public } from '@conexa/service-kit';

import { env } from './config.js';
import { publicKeyToJwks } from './tokens.js';

@Controller()
export class JwksController {
  private cached?: { keys: unknown[] };

  @Public()
  @Get('.well-known/jwks.json')
  async jwks(): Promise<{ keys: unknown[] }> {
    this.cached ??= await publicKeyToJwks(env.JWT_PUBLIC_KEY);
    return this.cached;
  }
}
