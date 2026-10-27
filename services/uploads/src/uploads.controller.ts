import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  AttachUploadSchema,
  CreateUploadSchema,
  UploadObjectTypeSchema,
  type JwtClaims,
} from '@conexa/contracts';
import { AppError, validationError } from '@conexa/errors';
import { CurrentUser, JwtAuthGuard, Public } from '@conexa/service-kit';
import type { Request, Response } from 'express';

import { readHeaders } from './uploads.rules.js';
import { UploadsService } from './uploads.service.js';

const MAX_ACCEPTED_BYTES = 10 * 1024 * 1024;

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: JwtClaims, @Body() body: unknown) {
    return this.uploads.create(user.sub, CreateUploadSchema.parse(body));
  }

  /** Envoi brut des octets : `Content-Type` doit être celui déclaré à la création. */
  @UseGuards(JwtAuthGuard)
  @Put(':id/content')
  async putContent(
    @CurrentUser() user: JwtClaims,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const bytes = await readBody(request, MAX_ACCEPTED_BYTES);
    return this.uploads.writeContent(user.sub, id, request.headers['content-type'], bytes);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  metadata(@Param('id') id: string) {
    return this.uploads.metadata(id);
  }

  /** URL de lecture : identifiant non devinable, servi en cache long. */
  @Public()
  @Get(':id/content')
  async content(@Param('id') id: string, @Res() response: Response): Promise<void> {
    const file = await this.uploads.content(id);
    response.set(readHeaders(file.contentType)).send(file.bytes);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/attach')
  @HttpCode(200)
  attach(@CurrentUser() user: JwtClaims, @Param('id') id: string, @Body() body: unknown) {
    return this.uploads.attach(user.sub, id, AttachUploadSchema.parse(body));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: JwtClaims, @Param('id') id: string): Promise<void> {
    await this.uploads.remove(user.sub, id);
  }
}

@Controller('files')
export class FilesController {
  constructor(private readonly uploads: UploadsService) {}

  /** Fichiers rattachés à un objet : galerie d'offre, portfolio, preuves… */
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Query('object_type') objectType: unknown, @Query('object_id') objectId: unknown) {
    const type = UploadObjectTypeSchema.safeParse(objectType);
    if (!type.success || typeof objectId !== 'string' || objectId.length === 0) {
      throw validationError('object_type et object_id requis');
    }
    return this.uploads.listForObject(type.data, objectId);
  }
}

/** Lit le corps brut avec un plafond dur, indépendant de l'en-tête déclaré. */
async function readBody(request: Request, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buffer.length;
    if (total > limit) {
      throw new AppError('UPLOAD_TOO_LARGE', 'Fichier trop lourd', { max_bytes: limit });
    }
    chunks.push(buffer);
  }

  if (total === 0) {
    throw validationError('Corps de requête vide');
  }
  return Buffer.concat(chunks);
}
