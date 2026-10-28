import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SimilarRequestSchema, UpsertEmbeddingSchema } from '@conexa/contracts';
import { createServiceTokenGuard } from '@conexa/service-kit';

import { AiService } from './ai.service.js';
import { env } from './config.js';

const ServiceTokenGuard = createServiceTokenGuard(env.SERVICE_TOKEN);

/**
 * Aucune route utilisateur : le service n'est appelé que par Dating, Talents et
 * le worker. Le Gateway bloque de toute façon `/internal/*` depuis l'extérieur.
 */
@Controller('internal/embeddings')
export class EmbeddingsController {
  constructor(private readonly ai: AiService) {}

  @UseGuards(ServiceTokenGuard)
  @Post()
  @HttpCode(200)
  upsert(@Body() body: unknown) {
    return this.ai.upsert(UpsertEmbeddingSchema.parse(body));
  }

  @UseGuards(ServiceTokenGuard)
  @Post('similar')
  @HttpCode(200)
  similar(@Body() body: unknown) {
    return this.ai.similar(SimilarRequestSchema.parse(body));
  }
}
