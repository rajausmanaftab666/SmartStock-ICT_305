import { z } from 'zod';
import { emailField, passwordField } from './common';

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: passwordField,
    confirm_password: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'The two passwords do not match',
    path: ['confirm_password'],
  })
  .refine((data) => data.new_password !== data.current_password, {
    message: 'Choose a password different from your current one',
    path: ['new_password'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
