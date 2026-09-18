const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export type AuthSession = {
  user: any;
  tenant: any;
  accessToken: string;
  refreshToken: string;
};

export type LoginResponse = AuthSession | { mfaRequired: true; mfaToken: string };

export type WhatsAppConsent = {
  phone: string | null;
  status: 'OPTED_IN' | 'OPTED_OUT' | 'NOT_SET' | 'NO_PHONE';
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

let refreshPromise: Promise<string> | null = null;

// A 401 from credential endpoints (login, mfa, reset...) means "wrong input", not "expired session", so only
// /auth/me (the page-load check) and non-auth routes are worth a refresh attempt.
const canRefresh = (path: string) => path === '/auth/me' || !path.startsWith('/auth/');

function clearTokensAndRedirect() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.assign('/login');
}

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new ApiError(401, 'Your session has expired');

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(res.status, err.message || 'Session refresh failed');
    }

    const tokens: { accessToken: string; refreshToken: string } = await res.json();
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    return tokens.accessToken;
  })();

  try {
    return await refreshPromise;
  } catch (error) {
    clearTokensAndRedirect();
    throw error;
  } finally {
    refreshPromise = null;
  }
}

async function authenticatedRetryToken(tokenUsed: string | null): Promise<string> {
  const currentToken = localStorage.getItem('accessToken');
  if (currentToken && currentToken !== tokenUsed) return currentToken;
  return refreshAccessToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const send = (accessToken: string | null) => fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

  let res = await send(token);

  if (res.status === 401 && canRefresh(path) && typeof window !== 'undefined') {
    const newToken = await authenticatedRetryToken(token);
    res = await send(newToken);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, err.message || 'Request failed');
  }

  return res.json();
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const send = (accessToken: string | null) => {
    const form = new FormData();
    form.append('file', file);
    // The browser must set the multipart boundary itself.
    return fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  };

  let res = await send(token);

  if (res.status === 401 && canRefresh(path) && typeof window !== 'undefined') {
    const newToken = await authenticatedRetryToken(token);
    res = await send(newToken);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, err.message || 'Upload failed');
  }

  return res.json();
}

export const api = {
  uploads: {
    upload: (file: File) => uploadFile<{ url: string; key: string }>('/uploads', file),
  },
  auth: {
    signup: (data: { email: string; password: string; companyName: string; subdomain: string }) =>
      request<any>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    verifyMfa: (data: { mfaToken: string; code: string }) =>
      request<AuthSession>('/auth/mfa/verify', { method: 'POST', body: JSON.stringify(data) }),
    logout: (data: { refreshToken: string }) =>
      request<{ success: true }>('/auth/logout', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (data: { email: string }) =>
      request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
    resetPassword: (data: { token: string; password: string }) =>
      request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      request<AuthSession>('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
    mfaSetup: () => request<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup', { method: 'POST' }),
    mfaEnable: (data: { code: string }) =>
      request<{ recoveryCodes: string[] }>('/auth/mfa/enable', { method: 'POST', body: JSON.stringify(data) }),
    mfaDisable: (data: { password: string; code: string }) =>
      request<{ success: true }>('/auth/mfa/disable', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<any>('/auth/me'),
  },
  dashboard: () => request<any>('/dashboard'),
  employees: {
    list: (params?: Record<string, string>) =>
      request<any>(`/employees?${new URLSearchParams(params || {})}`),
    get: (id: string) => request<any>(`/employees/${id}`),
    create: (data: any) => request<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    addDocument: (id: string, data: { type: string; name: string; fileUrl: string; expiryDate?: string }) =>
      request<any>(`/employees/${id}/documents`, { method: 'POST', body: JSON.stringify(data) }),
    updateSelf: (data: { phone?: string; address?: string; emergencyContact?: string }) =>
      request<any>('/employees/me/self', { method: 'PATCH', body: JSON.stringify(data) }),
    myPayslips: () => request<any>('/employees/me/payslips'),
    team: () => request<any>('/employees/team'),
    orgChart: () => request<any>('/employees/org-chart'),
    departments: () => request<any>('/employees/departments'),
    designations: () => request<any>('/employees/designations'),
    import: (rows: any[]) => request<any>('/employees/import', { method: 'POST', body: JSON.stringify({ rows }) }),
  },
  approvals: {
    inbox: () => request<any>('/approvals/inbox'),
    approve: (id: string) => request<any>(`/leave/requests/${id}/approve`, { method: 'PATCH' }),
    reject: (id: string, reason?: string) =>
      request<any>(`/leave/requests/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  },
  settings: {
    customFields: () => request<any>('/custom-fields'),
    workflows: () => request<any>('/workflows'),
  },
  audit: {
    logs: (params?: Record<string, string>) =>
      request<any>(`/audit/logs?${new URLSearchParams(params || {})}`),
  },
  leave: {
    policies: () => request<any>('/leave/policies'),
    balances: () => request<any>('/leave/balances'),
    requests: (params?: Record<string, string>) =>
      request<any>(`/leave/requests?${new URLSearchParams(params || {})}`),
    createRequest: (data: any) => request<any>('/leave/requests', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: string) => request<any>(`/leave/requests/${id}/approve`, { method: 'PATCH' }),
    reject: (id: string, reason?: string) =>
      request<any>(`/leave/requests/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
    whosOut: (month?: string) => request<any>(`/leave/whos-out${month ? `?month=${month}` : ''}`),
    holidays: () => request<any>('/leave/holidays'),
  },
  attendance: {
    clockIn: (data?: { latitude?: number; longitude?: number }) =>
      request<any>('/attendance/clock-in', { method: 'POST', body: JSON.stringify(data || {}) }),
    clockOut: () => request<any>('/attendance/clock-out', { method: 'POST' }),
    myLogs: (month?: string) => request<any>(`/attendance/my-logs${month ? `?month=${month}` : ''}`),
    dashboard: () => request<any>('/attendance/dashboard'),
    regularization: (data: any) =>
      request<any>('/attendance/regularization', { method: 'POST', body: JSON.stringify(data) }),
  },
  onboarding: {
    templates: () => request<any>('/onboarding/templates'),
    progress: () => request<any>('/onboarding/progress'),
    dashboard: () => request<any>('/onboarding/dashboard'),
    start: (data: { employeeId: string; templateId: string }) =>
      request<any>('/onboarding/start', { method: 'POST', body: JSON.stringify(data) }),
    completeTask: (progressId: string, taskId: string) =>
      request<any>(`/onboarding/tasks/${progressId}/${taskId}/complete`, { method: 'PATCH' }),
  },
  payroll: {
    runs: () => request<any>('/payroll/runs'),
    createRun: (period: string) => request<any>(`/payroll/runs?period=${period}`, { method: 'POST' }),
    getRun: (id: string) => request<any>(`/payroll/runs/${id}`),
    submit: (id: string) => request<any>(`/payroll/runs/${id}/submit`, { method: 'POST' }),
    approve: (id: string) => request<any>(`/payroll/runs/${id}/approve`, { method: 'POST' }),
    lock: (id: string) => request<any>(`/payroll/runs/${id}/lock`, { method: 'POST' }),
    reopen: (id: string, reason: string) => request<any>(`/payroll/runs/${id}/reopen`, { method: 'POST', body: JSON.stringify({ reason }) }),
    payslipUrl: (runId: string, itemId: string) => request<{ url: string }>(`/payroll/runs/${runId}/items/${itemId}/payslip`),
    bankFile: (id: string, bank: string) => request<any>(`/payroll/runs/${id}/bank-file?bank=${bank}`),
    journal: (id: string) => request<any>(`/payroll/runs/${id}/journal`),
    compensationItems: (employeeId?: string) => request<any>(`/payroll/compensation-items${employeeId ? `?employeeId=${employeeId}` : ''}`),
    createCompensationItem: (data: { employeeId: string; type: string; label: string; amount: number; recurring?: boolean; startPeriod?: string; endPeriod?: string }) =>
      request<any>('/payroll/compensation-items', { method: 'POST', body: JSON.stringify(data) }),
    deleteCompensationItem: (id: string) => request<any>(`/payroll/compensation-items/${id}`, { method: 'DELETE' }),
  },
  offboarding: {
    list: (status?: string) => request<any>(`/offboarding${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    inbox: () => request<any>('/offboarding/inbox'),
    mine: () => request<any>('/offboarding/mine'),
    get: (id: string) => request<any>(`/offboarding/${id}`),
    initiate: (data: { employeeId?: string; type: 'RESIGNATION' | 'TERMINATION'; lastWorkingDay: string; reason?: string }) =>
      request<any>('/offboarding', { method: 'POST', body: JSON.stringify(data) }),
    decide: (id: string, action: 'APPROVE' | 'REJECT', comment?: string) =>
      request<any>(`/offboarding/${id}/decision`, { method: 'POST', body: JSON.stringify({ action, comment }) }),
    clearItem: (id: string, itemId: string, notes?: string) =>
      request<any>(`/offboarding/${id}/clearance/${itemId}/clear`, { method: 'POST', body: JSON.stringify({ notes }) }),
    submitExitInterview: (id: string, data: { primaryReason: string; feedback?: string; rating: number; wouldRecommend: boolean }) =>
      request<any>(`/offboarding/${id}/exit-interview`, { method: 'POST', body: JSON.stringify(data) }),
    recalculateSettlement: (id: string) =>
      request<any>(`/offboarding/${id}/settlement/recalculate`, { method: 'POST' }),
    complete: (id: string) => request<any>(`/offboarding/${id}/complete`, { method: 'POST' }),
    cancel: (id: string) => request<any>(`/offboarding/${id}/cancel`, { method: 'POST' }),
  },
  recruitment: {
    jobs: () => request<any>('/recruitment/jobs'),
    createJob: (data: any) => request<any>('/recruitment/jobs', { method: 'POST', body: JSON.stringify(data) }),
    applications: () => request<any>('/recruitment/applications'),
    updateApplicationStatus: (id: string, status: string) =>
      request<any>(`/recruitment/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    preboarding: () => request<any>('/preboarding'),
  },
  performance: {
    goals: () => request<any>('/performance/goals'),
    cycles: () => request<any>('/performance/cycles'),
    createCycle: (data: any) => request<any>('/performance/cycles', { method: 'POST', body: JSON.stringify(data) }),
    createGoal: (data: any) => request<any>('/performance/goals', { method: 'POST', body: JSON.stringify(data) }),
    updateGoalProgress: (id: string, progress: number) =>
      request<any>(`/performance/goals/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) }),
    enps: () => request<any>('/enps/surveys/summary'),
    enpsSurveys: () => request<any>('/enps/surveys'),
    reviews: (cycleId?: string) => request<any>(`/performance/reviews${cycleId ? `?cycleId=${cycleId}` : ''}`),
    createReview: (data: any) => request<any>('/performance/reviews', { method: 'POST', body: JSON.stringify(data) }),
    submitReview: (id: string, data: any) =>
      request<any>(`/performance/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  peerReviews: {
    list: (cycleId?: string) => request<any>(`/peer-reviews${cycleId ? `?cycleId=${cycleId}` : ''}`),
    create: (data: any) => request<any>('/peer-reviews', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/peer-reviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  oneOnOnes: {
    list: () => request<any>('/one-on-ones'),
    create: (data: any) => request<any>('/one-on-ones', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/one-on-ones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request<any>(`/one-on-ones/${id}`, { method: 'DELETE' }),
  },
  timesheets: {
    projects: () => request<any>('/timesheets/projects'),
    createProject: (data: { key: string; name: string }) =>
      request<any>('/timesheets/projects', { method: 'POST', body: JSON.stringify(data) }),
    entries: (weekStart?: string) => request<any>(`/timesheets/entries${weekStart ? `?weekStart=${weekStart}` : ''}`),
    createEntry: (data: any) => request<any>('/timesheets/entries', { method: 'POST', body: JSON.stringify(data) }),
    updateEntry: (id: string, data: any) =>
      request<any>(`/timesheets/entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteEntry: (id: string) => request<any>(`/timesheets/entries/${id}`, { method: 'DELETE' }),
    submitWeek: (weekStart: string) =>
      request<any>('/timesheets/submit', { method: 'POST', body: JSON.stringify({ weekStart }) }),
    pending: () => request<any>('/timesheets/pending'),
    approve: (id: string) => request<any>(`/timesheets/entries/${id}/approve`, { method: 'PATCH' }),
    reject: (id: string) => request<any>(`/timesheets/entries/${id}/reject`, { method: 'PATCH' }),
  },
  apiKeys: {
    list: () => request<any>('/api-keys'),
    create: (name: string) => request<any>('/api-keys', { method: 'POST', body: JSON.stringify({ name }) }),
    revoke: (id: string) => request<any>(`/api-keys/${id}`, { method: 'DELETE' }),
  },
  sso: {
    config: () => request<any>('/sso/config'),
    save: (data: any) => request<any>('/sso/config', { method: 'PUT', body: JSON.stringify(data) }),
  },
  eor: {
    countries: () => request<any>('/eor/countries'),
    quote: (country: string, salary: number) => request<any>(`/eor/quote?country=${country}&salary=${salary}`),
  },
  payrollExtras: {
    w2: (year?: number) => request<any>(`/payroll/w2${year ? `?year=${year}` : ''}`),
  },
  extensions: {
    list: () => request<any>('/extensions/panels'),
  },
  lms: {
    courses: () => request<any>('/lms/courses'),
    enroll: (courseId: string) => request<any>('/lms/enroll', { method: 'POST', body: JSON.stringify({ courseId }) }),
  },
  whatsapp: {
    messages: () => request<any>('/whatsapp/messages'),
    myConsent: () => request<WhatsAppConsent>('/whatsapp/consent/me'),
    setMyConsent: (status: 'OPTED_IN' | 'OPTED_OUT') =>
      request<WhatsAppConsent>('/whatsapp/consent/me', { method: 'PUT', body: JSON.stringify({ status }) }),
  },
  reports: {
    headcount: () => request<any>('/reports/headcount'),
    leaveConsumption: () => request<any>('/reports/leave-consumption'),
    attendance: (month: string) => request<any>(`/reports/attendance?month=${month}`),
    payrollCost: () => request<any>('/reports/payroll-cost'),
  },
  ai: {
    ask: (question: string) => request<any>('/ai/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  },
  marketplace: {
    integrations: () => request<any>('/marketplace/integrations'),
    categories: () => request<any>('/marketplace/categories'),
    connect: (id: string) => request<any>(`/marketplace/${id}/connect`, { method: 'POST' }),
    disconnect: (id: string) => request<any>(`/marketplace/${id}/disconnect`, { method: 'POST' }),
    logs: (appId: string) => request<any>(`/marketplace/${appId}/logs`),
  },
  webhooks: {
    list: () => request<any>('/webhooks'),
    create: (data: { url: string; events: string[]; secret?: string }) =>
      request<any>('/webhooks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { url?: string; events?: string[]; secret?: string; isActive?: boolean }) =>
      request<any>(`/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request<any>(`/webhooks/${id}`, { method: 'DELETE' }),
    deliveries: (id: string, status?: string) =>
      request<any>(`/webhooks/${id}/deliveries${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    test: (id: string) => request<any>(`/webhooks/${id}/test`, { method: 'POST' }),
    redeliver: (deliveryId: string) =>
      request<any>(`/webhooks/deliveries/${deliveryId}/redeliver`, { method: 'POST' }),
  },
  biometric: {
    devices: () => request<any>('/biometric/devices'),
    createDevice: (data: { serialNumber: string; name: string; location?: string }) =>
      request<any>('/biometric/devices', { method: 'POST', body: JSON.stringify(data) }),
    updateDevice: (id: string, data: { name?: string; location?: string; isActive?: boolean }) =>
      request<any>(`/biometric/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removeDevice: (id: string) => request<any>(`/biometric/devices/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    list: () => request<any>('/notifications'),
    markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  },
  platform: {
    tenants: () => request<any>('/platform/tenants'),
    tenant: (id: string) => request<any>(`/platform/tenants/${id}`),
    plans: () => request<any>('/platform/plans'),
    assignPlan: (tenantId: string, planCode: string) =>
      request<any>(`/platform/tenants/${tenantId}/subscription`, { method: 'POST', body: JSON.stringify({ planCode }) }),
    setStatus: (tenantId: string, status: string) =>
      request<any>(`/platform/tenants/${tenantId}/subscription/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    createOverride: (tenantId: string, data: { featureKey: string; enabled?: boolean; limit?: number; reason: string }) =>
      request<any>(`/platform/tenants/${tenantId}/overrides`, { method: 'POST', body: JSON.stringify(data) }),
    deleteOverride: (tenantId: string, overrideId: string) =>
      request<any>(`/platform/tenants/${tenantId}/overrides/${overrideId}`, { method: 'DELETE' }),
    audit: (limit = 100) => request<any>(`/platform/audit?limit=${limit}`),
  },
};
