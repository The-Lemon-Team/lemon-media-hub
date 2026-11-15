import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { MediaCallerContext } from './auth.types';

export const IS_PUBLIC_KEY = 'media_is_public';
export const REQUIRE_ADMIN_KEY = 'media_require_admin';
export const REQUIRE_SCOPE_KEY = 'media_require_scope';

export const PublicRoute = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequireAdmin = () => SetMetadata(REQUIRE_ADMIN_KEY, true);
export const RequireScope = (scope: string) => SetMetadata(REQUIRE_SCOPE_KEY, scope);

export const MediaCaller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MediaCallerContext | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.mediaCaller as MediaCallerContext | undefined;
  },
);
