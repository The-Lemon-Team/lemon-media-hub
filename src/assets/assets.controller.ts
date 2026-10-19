import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AssetsService, QueryAssetsDto } from './assets.service';

@ApiTags('Assets')
@Controller('api/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List and search media assets with filters and pagination' })
  async getAssets(@Query() query: QueryAssetsDto) {
    return this.assetsService.queryAssets(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by ID' })
  async getAssetById(@Param('id') id: string) {
    const asset = await this.assetsService.getAssetById(id);
    if (!asset) {
      throw new NotFoundException(`Asset '${id}' not found`);
    }
    return asset;
  }

  @Patch(':id/favorite')
  @ApiOperation({ summary: 'Toggle asset favorite flag' })
  async toggleFavorite(@Param('id') id: string) {
    return this.assetsService.toggleFavorite(id);
  }

  @Post(':id/usage')
  @ApiOperation({ summary: 'Increment asset usage counter' })
  async incrementUsage(@Param('id') id: string) {
    await this.assetsService.incrementUsage(id);
    return { success: true };
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload an image manually to a folder' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folderPath: { type: 'string', default: 'covers' },
        tags: { type: 'string', description: 'Comma separated tags' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 25 * 1024 * 1024 }), // 25MB max
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('folderPath') folderPath?: string,
    @Body('tags') rawTags?: string,
  ) {
    const tags = rawTags ? rawTags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    return this.assetsService.uploadManualFile(file, folderPath || 'covers', tags);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete asset and remove files from disk' })
  async deleteAsset(@Param('id') id: string) {
    const success = await this.assetsService.deleteAsset(id);
    return { success };
  }
}
