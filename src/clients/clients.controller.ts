import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RequireAdmin } from '../auth/auth.decorators';
import { ClientsService } from './clients.service';

class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}

class UpdateClientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('Clients')
@ApiBearerAuth()
@RequireAdmin()
@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List registered external consumer apps (Admin only)' })
  list() {
    return this.clientsService.listClients();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new service client and issue an X-Media-Api-Key (Admin only)' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.createClient(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client scopes or active status (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.updateClient(id, dto);
  }

  @Post(':id/rotate-key')
  @ApiOperation({ summary: 'Rotate API key for a service client (Admin only)' })
  rotateKey(@Param('id') id: string) {
    return this.clientsService.rotateKey(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service client (Admin only)' })
  remove(@Param('id') id: string) {
    return this.clientsService.deleteClient(id);
  }
}
