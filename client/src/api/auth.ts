import type { AuthUser, ChangePasswordInput, LoginInput } from '@shared';
import { ApiError, api } from './client';

interface LoginResponse {
  user: AuthUser;
  redirect_to: string;
}

export const authApi = {
  login: (input: LoginInput) => api.post<LoginResponse>('/api/auth/login', { ...input }),

  logout: () => api.post<void>('/api/auth/logout'),

  /**
   * Resolves to null rather than throwing when nobody is signed in — "logged
   * out" is an expected state on first load, not an error to surface.
   */
  me: async (): Promise<AuthUser | null> => {
    try {
      const { user } = await api.get<{ user: AuthUser }>('/api/auth/me');
      return user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },

  changePassword: (input: ChangePasswordInput) =>
    api.post<{ message: string }>('/api/auth/change-password', { ...input }),
};
