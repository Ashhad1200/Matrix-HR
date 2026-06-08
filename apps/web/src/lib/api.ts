const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, err.message || 'Request failed');
  }

  return res.json();
}

export const api = {
  auth: {
    signup: (data: { email: string; password: string; companyName: string; subdomain: string }) =>
      request<any>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<any>('/auth/me'),
  },
  dashboard: () => request<any>('/dashboard'),
  employees: {
    list: (params?: Record<string, string>) =>
      request<any>(`/employees?${new URLSearchParams(params || {})}`),
    get: (id: string) => request<any>(`/employees/${id}`),
    create: (data: any) => request<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),
    orgChart: () => request<any>('/employees/org-chart'),
    departments: () => request<any>('/employees/departments'),
    designations: () => request<any>('/employees/designations'),
    import: (rows: any[]) => request<any>('/employees/import', { method: 'POST', body: JSON.stringify({ rows }) }),
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
    approve: (id: string) => request<any>(`/payroll/runs/${id}/approve`, { method: 'POST' }),
    bankFile: (id: string, bank: string) => request<any>(`/payroll/runs/${id}/bank-file?bank=${bank}`),
  },
  recruitment: {
    jobs: () => request<any>('/recruitment/jobs'),
    createJob: (data: any) => request<any>('/recruitment/jobs', { method: 'POST', body: JSON.stringify(data) }),
    applications: () => request<any>('/recruitment/applications'),
    updateApplicationStatus: (id: string, status: string) =>
      request<any>(`/recruitment/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  performance: {
    goals: () => request<any>('/performance/goals'),
    cycles: () => request<any>('/performance/cycles'),
    createGoal: (data: any) => request<any>('/performance/goals', { method: 'POST', body: JSON.stringify(data) }),
    updateGoalProgress: (id: string, progress: number) =>
      request<any>(`/performance/goals/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) }),
  },
  lms: {
    courses: () => request<any>('/lms/courses'),
    enroll: (courseId: string) => request<any>('/lms/enroll', { method: 'POST', body: JSON.stringify({ courseId }) }),
  },
  whatsapp: {
    messages: () => request<any>('/whatsapp/messages'),
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
  },
  notifications: {
    list: () => request<any>('/notifications'),
    markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  },
};
