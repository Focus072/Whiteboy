/**
 * Admin API Client (Storefront)
 * Uses the same backend API, but targets /admin routes.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? window.location.origin.replace(':3000', ':3001')
    : 'http://localhost:3001');

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    reasons?: string[];
    reasonCode?: string;
  };
}

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      error: data.error || { code: 'UNKNOWN_ERROR', message: 'Request failed' },
    };
  }

  return data;
}

// Admin Orders API
export async function getOrders(params?: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  statuses?: string[];
}) {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', params.page.toString());
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);
  if (params?.statuses) params.statuses.forEach((s) => query.append('statuses', s));

  const queryString = query.toString();
  return apiRequest(`/admin/orders${queryString ? `?${queryString}` : ''}`);
}

export async function getOrder(id: string) {
  return apiRequest(`/admin/orders/${id}`);
}

export async function logStakeCall(orderId: string, notes: string) {
  return apiRequest(`/admin/orders/${orderId}/stake-call`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function shipOrder(orderId: string) {
  return apiRequest(`/admin/orders/${orderId}/ship`, {
    method: 'POST',
  });
}

// Reports API
export async function generatePactReport(params: {
  state: string;
  periodStart: string;
  periodEnd: string;
}) {
  return apiRequest('/admin/reports/pact', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Audit API
export async function getAuditEvents(params?: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString());

  const queryString = query.toString();
  return apiRequest(`/admin/audit-events${queryString ? `?${queryString}` : ''}`);
}

// Products API
export async function getProducts(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
  if (params?.search) query.append('search', params.search);
  if (params?.active !== undefined) query.append('active', params.active.toString());

  const queryString = query.toString();
  return apiRequest(`/admin/products${queryString ? `?${queryString}` : ''}`);
}

export async function getProduct(id: string) {
  return apiRequest(`/admin/products/${id}`);
}

export async function createProduct(data: {
  name: string;
  sku: string;
  flavorType: string;
  nicotineMg: number;
  netWeightGrams: number;
  price: number;
  caUtlApproved?: boolean;
  sensoryCooling?: boolean;
  active?: boolean;
}) {
  return apiRequest('/admin/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  id: string,
  data: {
    name?: string;
    sku?: string;
    flavorType?: string;
    nicotineMg?: number;
    netWeightGrams?: number;
    price?: number;
    caUtlApproved?: boolean;
    sensoryCooling?: boolean;
    active?: boolean;
    imageUrl?: string | null;
    imageFileId?: string | null;
  }
) {
  return apiRequest(`/admin/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: string) {
  return apiRequest(`/admin/products/${id}`, {
    method: 'DELETE',
  });
}

export async function presignFileUpload(data: { key: string; contentType: string; sizeBytes: number }) {
  return apiRequest('/admin/files/presign', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProductImage(id: string, data: { imageUrl?: string; imageFileId?: string }) {
  return apiRequest(`/admin/products/${id}/image`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Users API
export async function getUsers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
  if (params?.search) query.append('search', params.search);
  if (params?.role) query.append('role', params.role);

  const queryString = query.toString();
  return apiRequest(`/admin/users${queryString ? `?${queryString}` : ''}`);
}

export async function getUser(id: string) {
  return apiRequest(`/admin/users/${id}`);
}

export async function createUser(data: { email: string; password: string; role: string }) {
  return apiRequest('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  id: string,
  data: { email?: string; role?: string; disabled?: boolean }
) {
  return apiRequest(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: string) {
  return apiRequest(`/admin/users/${id}`, {
    method: 'DELETE',
  });
}

export async function resetUserPassword(id: string, newPassword: string) {
  return apiRequest(`/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

// Dashboard Analytics API
export async function getDashboardStats() {
  return apiRequest('/admin/dashboard/stats');
}

