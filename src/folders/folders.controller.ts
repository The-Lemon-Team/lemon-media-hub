import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FoldersService, CreateFolderDto, MediaFolder } from './folders.service';

@ApiTags('Folders')
@Controller('api/folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список всех папок хранения медиа' })
  @ApiResponse({ status: 200, description: 'Список папок' })
  async getFolders(): Promise<MediaFolder[]> {
    return this.foldersService.getAllFolders();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Создать новую папку' })
  async createFolder(@Body() dto: CreateFolderDto): Promise<MediaFolder> {
    return this.foldersService.createFolder(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить папку по ID' })
  async deleteFolder(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.foldersService.deleteFolder(id);
    return { success };
  }
}
