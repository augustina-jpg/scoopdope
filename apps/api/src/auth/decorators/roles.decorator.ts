import { SetMetadata } from '@nestjs/common';

export enum Role {
  LEARNER = 'LEARNER',
  INSTRUCTOR = 'INSTRUCTOR',
  ADMIN = 'ADMIN',
}

export const ROLES_KEY = 'roles';

/**
 * Attaches the required roles to a route handler or controller so the
 * RolesGuard can enforce RBAC. Mirrors the roles defined in the shared
 * Soroban contract.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
