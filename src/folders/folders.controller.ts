import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MediaVisibility } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RequireAdmin, RequireScope } from '../auth/auth.decorators';
import { FoldersService, MediaFolderDto } from './folders.service';

class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsEnum(MediaVisibility)
  defaultVisibility?: MediaVisibility;
}

@ApiTags('Folders')
@ApiBearerAuth()
@Controller('api/folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @RequireScope('media:read')
  @ApiOperation({ summary: 'List all media folders' })
  @ApiResponse({ status: 200, description: 'Folder list' })
  async getFolders(): Promise<MediaFolderDto[]> {
    return this.foldersService.getAllFolders();
  }

  @Post()
  @RequireAdmin()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new media folder (Admin only)' })
  async createFolder(@Body() dto: CreateFolderDto): Promise<MediaFolderDto> {
    return this.foldersService.createFolder(dto);
  }

  @Delete(':id')
  @RequireAdmin()
  @ApiOperation({ summary: 'Delete folder by ID (Admin only)' })
  async deleteFolder(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.foldersService.deleteFolder(id);
    return { success };
  }
}
