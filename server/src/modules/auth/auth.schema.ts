/**
 * The auth module validates with the shared schemas so the browser and the
 * server apply exactly the same rules. Re-exported here to keep every module's
 * public surface in the same shape.
 */
export { loginSchema, changePasswordSchema } from '@shared';
export type { LoginInput, ChangePasswordInput } from '@shared';
