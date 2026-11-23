import type { AppSettings } from '@shared';
import { api } from './client';

export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const { settings } = await api.get<{ settings: AppSettings }>('/api/settings');
    return settings;
  },
};
