import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  REQUIRE_ADMIN_KEY,
  REQUIRE_SCOPE_KEY,
} from './auth.decorators';
import { AuthService } from './auth.service';

@Injectable()
export class MediaAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const caller = await this.authService.resolveCallerFromRequest(req);
    if (!caller) {
      throw new UnauthorizedException(
        'Authentication required. Provide Admin JWT/session or valid X-Media-Api-Key.',
      );
    }

    req.mediaCaller = caller;

    const requireAdmin = this.reflector.getAllAndOverride<boolean>(REQUIRE_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requireAdmin && caller.type !== 'admin') {
      throw new ForbiddenException('Admin access required for this endpoint');
    }

    const requiredScope = this.reflector.getAllAndOverride<string>(REQUIRE_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredScope && caller.type === 'client') {
      if (!caller.scopes.includes(requiredScope) && !caller.scopes.includes('media:*')) {
        throw new ForbiddenException(
          `Client '${caller.slug}' lacks required scope '${requiredScope}'`,
        );
      }
    }

    return true;
  }
}
