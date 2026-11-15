import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MediaVisibility, VariantType } from '@prisma/client';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { PublicRoute } from '../auth/auth.decorators';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AssetsService } from './assets.service';

@ApiTags('Media Delivery')
@Controller('api/media')
export class MediaDeliveryController {
  private readonly nginxAccelPrefix?: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly authService: AuthService,
    private readonly assetsService: AssetsService,
  ) {
    this.nginxAccelPrefix = this.config.get<string>('NGINX_ACCEL_PREFIX')?.trim() || undefined;
  }

  @Get(':id/file')
  @PublicRoute()
  @ApiOperation({ summary: 'Stream or download default media variant with access check & Range support' })
  async serveDefault(
    @Param('id') id: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Query('client') clientSlug: string | undefined,
    @Headers('range') rangeHeader: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.serveVariant(id, 'auto', exp, sig, clientSlug, rangeHeader, req, res);
  }

  @Get(':id/file/:variant')
  @PublicRoute()
  @ApiOperation({
    summary:
      'Stream or download specific variant (original | full | thumb | poster | mp4_720p | audio_mp3)',
  })
  async serveVariant(
    @Param('id') id: string,
    @Param('variant') variant: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Query('client') clientSlug: string | undefined,
    @Headers('range') rangeHeader: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: { variants: true, grants: true },
    });
    if (!asset) {
      throw new NotFoundException(`Media asset '${id}' not found`);
    }

    const normalizedVariant = (variant || 'auto').toLowerCase();

    // 1. Verify access permission
    if (asset.visibility !== MediaVisibility.PUBLIC) {
      const signedOk = this.authService.verifyMediaSignature({
        assetId: asset.id,
        variant: normalizedVariant,
        exp,
        sig,
        clientSlug,
      });

      if (!signedOk) {
        const caller = await this.authService.resolveCallerFromRequest(req);
        if (!caller) {
          throw new UnauthorizedException(
            'Protected media asset requires Admin session, X-Media-Api-Key, or valid signed URL.',
          );
        }
        if (!this.assetsService.canCallerReadAsset(caller, asset)) {
          throw new ForbiddenException(`Access denied to media asset '${id}'`);
        }
      }
    }

    // 2. Pick requested file variant on disk
    const resolved = this.resolveVariantFile(asset, normalizedVariant);
    const absPath = this.storage.resolveStoragePath(resolved.storageKey);

    let stat: fs.Stats;
    try {
      stat = await fsPromises.stat(absPath);
    } catch {
      throw new NotFoundException(`Media file for '${id}' (${normalizedVariant}) not found on disk`);
    }

    const cacheControl =
      asset.visibility === MediaVisibility.PUBLIC
        ? 'public, max-age=31536000, immutable'
        : 'private, max-age=300';

    res.setHeader('Content-Type', resolved.mimeType);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Accept-Ranges', 'bytes');

    // Optional Nginx offloaded static serving
    if (this.nginxAccelPrefix) {
      const cleanKey = resolved.storageKey.replace(/^\/+/, '');
      const accelPath = `${this.nginxAccelPrefix.replace(/\/$/, '')}/${cleanKey}`;
      res.setHeader('X-Accel-Redirect', accelPath);
      res.status(200).end();
      return;
    }

    const fileSize = stat.size;
    if (rangeHeader) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1;

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= fileSize) {
          res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
          return;
        }

        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', String(chunkSize));

        const stream = fs.createReadStream(absPath, { start, end });
        stream.pipe(res);
        return;
      }
    }

    res.status(200);
    res.setHeader('Content-Length', String(fileSize));
    const stream = fs.createReadStream(absPath);
    stream.pipe(res);
  }

  private resolveVariantFile(
    asset: any,
    requested: string,
  ): { storageKey: string; mimeType: string } {
    const byType = new Map<VariantType, any>(
      (asset.variants || []).map((v: any) => [v.variantType as VariantType, v]),
    );

    const prefer = (order: VariantType[]) => {
      for (const t of order) {
        const found = byType.get(t);
        if (found) return { storageKey: found.storageKey, mimeType: found.mimeType };
      }
      return { storageKey: asset.storageKey, mimeType: asset.mimeType };
    };

    switch (requested) {
      case 'thumb':
      case 'thumb_360':
        return prefer([
          VariantType.THUMB_360,
          VariantType.POSTER_JPG,
          VariantType.FULL_WEBP,
          VariantType.ORIGINAL,
        ]);
      case 'poster':
      case 'poster_jpg':
        return prefer([VariantType.POSTER_JPG, VariantType.THUMB_360, VariantType.ORIGINAL]);
      case 'full':
      case 'full_webp':
        return prefer([VariantType.FULL_WEBP, VariantType.ORIGINAL]);
      case 'mp4_720p':
      case 'mp4':
        return prefer([VariantType.MP4_720P, VariantType.ORIGINAL]);
      case 'audio_mp3':
      case 'mp3':
        return prefer([VariantType.AUDIO_MP3, VariantType.ORIGINAL]);
      case 'original':
        return prefer([VariantType.ORIGINAL, VariantType.FULL_WEBP]);
      case 'auto':
      default:
        return prefer([
          VariantType.MP4_720P,
          VariantType.AUDIO_MP3,
          VariantType.FULL_WEBP,
          VariantType.ORIGINAL,
        ]);
    }
  }
}
