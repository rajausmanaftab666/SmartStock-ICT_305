import type {
  AdminDashboard,
  AppSettings,
  EntityStatus,
  ManagerDashboard,
  Paginated,
  ReportResult,
  StaffDashboard,
  SupplierDashboard,
  UserCreateInput,
  UserRecord,
  UserUpdateInput,
} from '@shared';
import { api, withQuery } from './client';

export const dashboardApi = {
  admin: () => api.get<AdminDashboard>('/api/dashboard/admin'),
  staff: () => api.get<StaffDashboard>('/api/dashboard/staff'),
  manager: () => api.get<ManagerDashboard>('/api/dashboard/manager'),
  supplier: () => api.get<SupplierDashboard>('/api/dashboard/supplier'),
};

export interface ReportParams {
  type: string;
  date_from?: string;
  date_to?: string;
  category_id?: string;
  supplier_id?: string;
  product_id?: string;
  movement_type?: string;
  reason?: string;
  status?: string;
}

export const reportsApi = {
  run: async (params: ReportParams): Promise<ReportResult> => {
    const { report } = await api.get<{ report: ReportResult }>(
      withQuery('/api/reports', { ...params })
    );
    return report;
  },

  /**
   * CSV comes back as an attachment, so it is fetched rather than navigated to
   * — a plain link would drop the session cookie on some browsers and cannot
   * surface a 403 as a toast.
   */
  csvUrl: (params: ReportParams): string =>
    withQuery('/api/reports', { ...params, format: 'csv' }),
};

export interface UserListParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const usersApi = {
  list: (params: UserListParams) =>
    api.get<Paginated<UserRecord>>(withQuery('/api/users', { ...params })),

  get: async (id: number): Promise<UserRecord> => {
    const { user } = await api.get<{ user: UserRecord }>(`/api/users/${id}`);
    return user;
  },

  create: async (input: UserCreateInput): Promise<UserRecord> => {
    const { user } = await api.post<{ user: UserRecord }>('/api/users', { ...input });
    return user;
  },

  update: async (id: number, input: UserUpdateInput): Promise<UserRecord> => {
    const { user } = await api.put<{ user: UserRecord }>(`/api/users/${id}`, { ...input });
    return user;
  },

  setStatus: async (id: number, status: EntityStatus): Promise<UserRecord> => {
    const { user } = await api.patch<{ user: UserRecord }>(`/api/users/${id}/status`, { status });
    return user;
  },

  resetPassword: (id: number, newPassword: string) =>
    api.post<{ message: string }>(`/api/users/${id}/reset-password`, { new_password: newPassword }),
};

export const settingsWriteApi = {
  update: async (input: AppSettings): Promise<AppSettings> => {
    const { settings } = await api.put<{ settings: AppSettings }>('/api/settings', { ...input });
    return settings;
  },
};
