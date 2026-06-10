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
    approve: (id: string) => request<any>(`/payroll/runs/${id}/approve`, { method: 'POST' }),
    bankFile: (id: string, bank: string) => request<any>(`/payroll/runs/${id}/bank-file?bank=${bank}`),
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
    sync: (id: string) => request<any>(`/marketplace/${id}/sync`, { method: 'POST' }),
  },
  notifications: {
    list: () => request<any>('/notifications'),
    markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  },
};
