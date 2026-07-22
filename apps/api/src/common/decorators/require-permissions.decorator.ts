import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';
export const REQUIRE_ANY_PERMISSIONS_KEY = 'require_any_permissions';

/** Deny-by-default when present: caller must hold all listed permission codes (AND). */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, codes);

/** Deny-by-default when present: caller must hold at least one listed permission code (OR). */
export const RequireAnyPermissions = (...codes: string[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSIONS_KEY, codes);
