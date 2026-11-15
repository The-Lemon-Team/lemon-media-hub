import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MediaVisibility } from '@prisma/client';
import { MediaCaller, RequireAdmin, RequireScope } from '../auth/auth.decorators';
import { MediaCallerContext } from '../auth/auth.types';
import {
  CreateSignedUrlDto,
  QueryAssetsDto,
  UpdateAssetAccessDto,
  UpdateAssetMetadataDto,
} from './assets.dto';
import { AssetsService } from './assets.service';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('api/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequireScope('media:read')
  @ApiOperation({ summary: 'List and filter accessible media assets (photo/video/audio)' })
  async getAssets(
    @MediaCaller() caller: MediaCallerContext,
    @Query() query: QueryAssetsDto,
  ) {
    return this.assetsService.queryAssets(caller, query);
  }

  @Get(':id')
  @RequireScope('media:read')
  @ApiOperation({ summary: 'Get asset details by ID (subject to visibility/access grants)' })
  async getAssetById(@MediaCaller() caller: MediaCallerContext, @Param('id') id: string) {
    const asset = await this.assetsService.getAssetById(caller, id);
    if (!asset) {
      throw new NotFoundException(`Asset '${id}' not found`);
    }
    return asset;
  }

  @Get(':id/lineage')
  @RequireScope('media:read')
  @ApiOperation({ summary: 'Get asset lineage (ancestors, children, siblings, root)' })
  async getAssetLineage(
    @MediaCaller() caller: MediaCallerContext,
    @Param('id') id: string,
  ) {
    const lineage = await this.assetsService.getAssetLineage(caller, id);
    if (!lineage) {
      throw new NotFoundException(`Asset '${id}' not found`);
    }
    return lineage;
  }

  @Post('upload')
  @RequireScope('media:write')
  @ApiOperation({
    summary: 'Upload an image, video, or audio file to local disk and trigger processing pipeline',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folderPath: { type: 'string', default: 'covers' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        title: { type: 'string' },
        description: { type: 'string' },
        visibility: { type: 'string', enum: ['PRIVATE', 'SCOPED', 'PUBLIC'] },
        allowedClients: { type: 'string', description: 'Comma-separated client slugs' },
        aiRequestId: { type: 'string' },
        sourceAssetId: { type: 'string' },
        prompt: { type: 'string' },
        userPrompt: { type: 'string' },
        style: { type: 'string' },
        aspectRatio: { type: 'string' },
        model: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @MediaCaller() caller: MediaCallerContext,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, string | undefined>,
  ) {
    const tags = body.tags
      ? body.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const allowedClients = body.allowedClients
      ? body.allowedClients
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const visibility =
      body.visibility && Object.values(MediaVisibility).includes(body.visibility as MediaVisibility)
        ? (body.visibility as MediaVisibility)
        : undefined;

    return this.assetsService.uploadFile(caller, file, {
      folderPath: body.folderPath,
      tags,
      title: body.title,
      description: body.description,
      visibility,
      allowedClients,
      aiRequestId: body.aiRequestId,
      sourceAssetId: body.sourceAssetId,
      prompt: body.prompt,
      userPrompt: body.userPrompt,
      style: body.style,
      aspectRatio: body.aspectRatio,
      model: body.model,
    });
  }

  @Patch(':id')
  @RequireAdmin()
  @ApiOperation({ summary: 'Update asset title, description, folder, or tags (Admin only)' })
  async updateMetadata(
    @Param('id') id: string,
    @Body() dto: UpdateAssetMetadataDto,
  ) {
    return this.assetsService.updateMetadata(id, dto);
  }

  @Patch(':id/access')
  @RequireAdmin()
  @ApiOperation({
    summary: 'Set asset visibility (PRIVATE | SCOPED | PUBLIC) and per-app grants (Admin only)',
  })
  async updateAccess(@Param('id') id: string, @Body() dto: UpdateAssetAccessDto) {
    return this.assetsService.updateAccess(id, dto);
  }

  @Post(':id/signed-url')
  @RequireScope('media:read')
  @ApiOperation({
    summary: 'Generate a short-lived HMAC signed URL for protected browser/mobile delivery',
  })
  async createSignedUrl(
    @MediaCaller() caller: MediaCallerContext,
    @Param('id') id: string,
    @Body() dto: CreateSignedUrlDto,
  ) {
    return this.assetsService.createSignedUrl(caller, id, dto);
  }

  @Post(':id/reprocess')
  @RequireAdmin()
  @ApiOperation({ summary: 'Re-run image/video/audio processing pipeline for an asset (Admin only)' })
  async reprocess(@Param('id') id: string) {
    return this.assetsService.reprocessAsset(id);
  }

  @Patch(':id/favorite')
  @RequireScope('media:read')
  @ApiOperation({ summary: 'Toggle asset favorite flag' })
  async toggleFavorite(@MediaCaller() caller: MediaCallerContext, @Param('id') id: string) {
    return this.assetsService.toggleFavorite(caller, id);
  }

  @Post(':id/usage')
  @RequireScope('media:read')
  @ApiOperation({ summary: 'Increment asset usage counter' })
  async incrementUsage(@MediaCaller() caller: MediaCallerContext, @Param('id') id: string) {
    await this.assetsService.incrementUsage(caller, id);
    return { success: true };
  }

  @Delete(':id')
  @RequireAdmin()
  @ApiOperation({ summary: 'Delete asset and remove local files (Admin only)' })
  async deleteAsset(@Param('id') id: string) {
    const success = await this.assetsService.deleteAsset(id);
    return { success };
  }
}
