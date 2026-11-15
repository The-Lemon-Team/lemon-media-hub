import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Response } from 'express';
import { MediaCaller, PublicRoute, RequireAdmin } from './auth.decorators';
import { AuthService } from './auth.service';
import { MediaCallerContext } from './auth.types';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate as the single global Admin user' })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const valid = this.authService.verifyAdminCredentials(dto.username, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid admin username or password');
    }

    const token = this.authService.signAdminToken(dto.username);
    res.cookie(this.authService.getCookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: this.authService.getTokenTtlSeconds() * 1000,
    });

    return {
      accessToken: token,
      admin: {
        username: dto.username,
        role: 'admin',
      },
    };
  }

  @Post('logout')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear admin session cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.authService.getCookieName(), { path: '/' });
    return { success: true };
  }

  @Get('me')
  @RequireAdmin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check current admin session' })
  me(@MediaCaller() caller: MediaCallerContext) {
    return caller;
  }
}
