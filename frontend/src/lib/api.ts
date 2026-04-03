import axios from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para adicionar JWT
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('otimiz_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de resposta para erros 401
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('otimiz_token');
      window.location.href = '/auth/auth1/login';
    }
    return Promise.reject(error);
  },
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  getProfile: () => apiClient.get('/auth/profile'),
};

type ID = number | string;

// ─── Helpers de sessão ───────────────────────────────────────────────────────
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: string;
  companyId: number;
  avatarUrl?: string | null;
}

export function saveSession(accessToken: string, user: SessionUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('otimiz_token', accessToken);
  localStorage.setItem('otimiz_user', JSON.stringify(user));
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('otimiz_user');
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch { return null; }
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('otimiz_token');
  localStorage.removeItem('otimiz_user');
}

// ─── Companies ───────────────────────────────────────────────────────────────
export const companiesApi = {
  getAll: () => apiClient.get('/companies').then((r) => r.data),
  getById: (id: ID) => apiClient.get(`/companies/${id}`).then((r) => r.data),
  create: (data: object) => apiClient.post('/companies', data).then((r) => r.data),
  update: (id: ID, data: object) => apiClient.patch(`/companies/${id}`, data).then((r) => r.data),
  delete: (id: ID) => apiClient.delete(`/companies/${id}`).then((r) => r.data),
};

// ─── Lines ───────────────────────────────────────────────────────────────────
export const linesApi = {
  getAll: (params?: object) => apiClient.get('/lines', { params }).then((r) => r.data),
  getById: (id: ID) => apiClient.get(`/lines/${id}`).then((r) => r.data),
  create: (data: object) => apiClient.post('/lines', data).then((r) => r.data),
  update: (id: ID, data: object) => apiClient.patch(`/lines/${id}`, data).then((r) => r.data),
  delete: (id: ID) => apiClient.delete(`/lines/${id}`).then((r) => r.data),
};

// ─── Terminals ───────────────────────────────────────────────────────────────
export const terminalsApi = {
  getAll: (params?: object) => apiClient.get('/terminals', { params }).then((r) => r.data),
  getById: (id: ID) => apiClient.get(`/terminals/${id}`).then((r) => r.data),
  create: (data: object) => apiClient.post('/terminals', data).then((r) => r.data),
  update: (id: ID, data: object) => apiClient.patch(`/terminals/${id}`, data).then((r) => r.data),
  delete: (id: ID) => apiClient.delete(`/terminals/${id}`).then((r) => r.data),
};

// ─── Trips ───────────────────────────────────────────────────────────────────
export const tripsApi = {
  getAll: (params?: object) => apiClient.get('/trips', { params }).then((r) => r.data),
  getById: (id: ID) => apiClient.get(`/trips/${id}`).then((r) => r.data),
  create: (data: object) => apiClient.post('/trips', data).then((r) => r.data),
  createBulk: (data: object[]) => apiClient.post('/trips/bulk', data).then((r) => r.data),
  update: (id: ID, data: object) => apiClient.patch(`/trips/${id}`, data).then((r) => r.data),
  delete: (id: ID) => apiClient.delete(`/trips/${id}`).then((r) => r.data),
};

// ─── Optimization ────────────────────────────────────────────────────────────
export const optimizationSettingsApi = {
  getAll: (companyId?: number) => apiClient.get('/optimization-settings', { params: companyId ? { companyId } : {} }).then((r) => r.data),
  getActive: (companyId?: number) => apiClient.get('/optimization-settings/active', { params: companyId ? { companyId } : {} }).then((r) => r.data),
  getById: (id: ID) => apiClient.get(`/optimization-settings/${id}`).then((r) => r.data),
  create: (data: object, companyId?: number) => apiClient.post('/optimization-settings', data, { params: companyId ? { companyId } : {} }).then((r) => r.data),
  update: (id: ID, data: object, companyId?: number) => apiClient.patch(`/optimization-settings/${id}`, data, { params: companyId ? { companyId } : {} }).then((r) => r.data),
  activate: (id: ID, companyId?: number) => apiClient.patch(`/optimization-settings/${id}/activate`, {}, { params: companyId ? { companyId } : {} }).then((r) => r.data),
  delete: (id: ID, companyId?: number) => apiClient.delete(`/optimization-settings/${id}`, { params: companyId ? { companyId } : {} }).then((r) => r.data),
};

export const optimizationApi = {
  run: (data: object) => apiClient.post('/optimization/run', data).then((r) => r.data),
  getAll: (params?: object) => apiClient.get('/optimization', { params }).then((r) => r.data),
  getById: (id: ID) => apiClient.get(`/optimization/${id}`).then((r) => r.data),
  cancel: (id: ID) => apiClient.delete(`/optimization/${id}/cancel`).then((r) => r.data),
  getDashboard: (companyId: ID) =>
    apiClient.get(`/optimization/dashboard/${companyId}`).then((r) => r.data),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  getKpis: (companyId: ID) =>
    apiClient.get(`/reports/kpis/${companyId}`).then((r) => r.data),
  getHistory: (companyId: ID, days?: number) =>
    apiClient.get(`/reports/history/${companyId}`, { params: { days } }).then((r) => r.data),
  compare: (run1: ID, run2: ID) =>
    apiClient.get('/reports/compare', { params: { run1, run2 } }).then((r) => r.data),
};

export const vehicleTypesApi = {
  getAll: () => apiClient.get('/vehicle-types').then((r) => r.data),
  getById: (id: ID) => apiClient.get(`/vehicle-types/${id}`).then((r) => r.data),
  create: (data: object) => apiClient.post('/vehicle-types', data).then((r) => r.data),
  update: (id: ID, data: object) =>
    apiClient.patch(`/vehicle-types/${id}`, data).then((r) => r.data),
  delete: (id: ID) => apiClient.delete(`/vehicle-types/${id}`).then((r) => r.data),
};

export const usersApi = {
  getAll: () => apiClient.get('/users').then((r) => r.data),
  getById: (id: ID) => apiClient.get(`/users/${id}`).then((r) => r.data),
  create: (data: object) => apiClient.post('/users', data).then((r) => r.data),
  update: (id: ID, data: object) =>
    apiClient.patch(`/users/${id}`, data).then((r) => r.data),
  delete: (id: ID) => apiClient.delete(`/users/${id}`).then((r) => r.data),
};
