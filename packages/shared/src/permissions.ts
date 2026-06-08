import { ROLES } from './constants';

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: string;
};

export type PermissionActions = {
  employees: { create: boolean; update: boolean; import: boolean };
  leave: { request: boolean; approve: boolean };
  payroll: { run: boolean; approve: boolean; viewAll: boolean };
  recruitment: { manage: boolean };
  attendance: { clock: boolean; viewTeam: boolean; viewOrg: boolean };
  onboarding: { manage: boolean };
  performance: { manageGoals: boolean };
  settings: { manage: boolean };
  reports: { view: boolean };
  ai: { use: boolean };
  marketplace: { view: boolean };
  approvals: { viewInbox: boolean };
  profile: { editSelf: boolean };
  payslips: { viewSelf: boolean };
};

export type UserPermissions = {
  portal: 'admin' | 'manager' | 'ess';
  nav: NavItem[];
  actions: PermissionActions;
};

const ALL_NAV: Record<string, NavItem> = {
  dashboard: { href: '/dashboard', label: 'Home', icon: 'LayoutDashboard' },
  myProfile: { href: '/my-profile', label: 'My Info', icon: 'User' },
  leave: { href: '/leave', label: 'Time Off', icon: 'Calendar' },
  attendance: { href: '/attendance', label: 'Time Clock', icon: 'Clock' },
  myPay: { href: '/my-pay', label: 'Pay Stubs', icon: 'DollarSign' },
  performance: { href: '/performance', label: 'Performance', icon: 'Target' },
  lms: { href: '/lms', label: 'Learning', icon: 'GraduationCap' },
  ai: { href: '/ai', label: 'Ask MatrixHR', icon: 'Sparkles' },
  team: { href: '/team', label: 'My Team', icon: 'Users' },
  approvals: { href: '/approvals', label: 'Approvals', icon: 'Inbox', badge: 'pendingApprovals' },
  employees: { href: '/employees', label: 'Employees', icon: 'Users' },
  payroll: { href: '/payroll', label: 'Payroll', icon: 'DollarSign' },
  recruitment: { href: '/recruitment', label: 'Recruitment', icon: 'Briefcase' },
  onboarding: { href: '/onboarding', label: 'Onboarding', icon: 'UserPlus' },
  whatsapp: { href: '/whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  reports: { href: '/reports', label: 'Reports', icon: 'BarChart3' },
  settings: { href: '/settings', label: 'Settings', icon: 'Settings' },
  marketplace: { href: '/marketplace', label: 'Marketplace', icon: 'Store' },
  customFields: { href: '/settings/custom-fields', label: 'Custom Fields', icon: 'Sliders' },
  workflows: { href: '/settings/workflows', label: 'Workflows', icon: 'GitBranch' },
  audit: { href: '/settings/audit', label: 'Audit Log', icon: 'Shield' },
  atsKanban: { href: '/recruitment/kanban', label: 'ATS Board', icon: 'Kanban' },
  preboarding: { href: '/recruitment/preboarding', label: 'Pre-boarding', icon: 'FileSignature' },
  enps: { href: '/performance/enps', label: 'eNPS', icon: 'Heart' },
  extensions: { href: '/extensions', label: 'Extensions', icon: 'Puzzle' },
};

function nav(...keys: string[]): NavItem[] {
  return keys.map((k) => ALL_NAV[k]).filter(Boolean);
}

const ADMIN_ACTIONS: PermissionActions = {
  employees: { create: true, update: true, import: true },
  leave: { request: true, approve: true },
  payroll: { run: true, approve: true, viewAll: true },
  recruitment: { manage: true },
  attendance: { clock: true, viewTeam: true, viewOrg: true },
  onboarding: { manage: true },
  performance: { manageGoals: true },
  settings: { manage: true },
  reports: { view: true },
  ai: { use: true },
  marketplace: { view: true },
  approvals: { viewInbox: true },
  profile: { editSelf: true },
  payslips: { viewSelf: true },
};

const MANAGER_ACTIONS: PermissionActions = {
  employees: { create: false, update: false, import: false },
  leave: { request: true, approve: true },
  payroll: { run: false, approve: false, viewAll: false },
  recruitment: { manage: false },
  attendance: { clock: true, viewTeam: true, viewOrg: false },
  onboarding: { manage: false },
  performance: { manageGoals: true },
  settings: { manage: false },
  reports: { view: true },
  ai: { use: true },
  marketplace: { view: false },
  approvals: { viewInbox: true },
  profile: { editSelf: true },
  payslips: { viewSelf: true },
};

const ESS_ACTIONS: PermissionActions = {
  employees: { create: false, update: false, import: false },
  leave: { request: true, approve: false },
  payroll: { run: false, approve: false, viewAll: false },
  recruitment: { manage: false },
  attendance: { clock: true, viewTeam: false, viewOrg: false },
  onboarding: { manage: false },
  performance: { manageGoals: false },
  settings: { manage: false },
  reports: { view: false },
  ai: { use: true },
  marketplace: { view: false },
  approvals: { viewInbox: false },
  profile: { editSelf: true },
  payslips: { viewSelf: true },
};

export function getPermissionsForRole(role: string): UserPermissions {
  switch (role) {
    case ROLES.SUPER_ADMIN:
    case ROLES.COMPANY_ADMIN:
    case ROLES.HR_MANAGER:
      return {
        portal: 'admin',
        nav: nav(
          'dashboard', 'employees', 'leave', 'attendance', 'payroll', 'recruitment',
          'atsKanban', 'preboarding', 'onboarding', 'performance', 'enps', 'lms',
          'reports', 'whatsapp', 'settings', 'customFields', 'workflows', 'audit',
          'marketplace', 'extensions', 'ai',
        ),
        actions: ADMIN_ACTIONS,
      };
    case ROLES.MANAGER:
      return {
        portal: 'manager',
        nav: nav('dashboard', 'team', 'approvals', 'leave', 'performance', 'attendance', 'reports', 'myProfile', 'myPay', 'ai'),
        actions: MANAGER_ACTIONS,
      };
    case ROLES.EMPLOYEE:
    default:
      return {
        portal: 'ess',
        nav: nav('dashboard', 'myProfile', 'leave', 'attendance', 'myPay', 'performance', 'lms', 'ai'),
        actions: ESS_ACTIONS,
      };
  }
}

export function canPerform(role: string, action: keyof PermissionActions, sub: string): boolean {
  const perms = getPermissionsForRole(role);
  const group = perms.actions[action] as Record<string, boolean> | undefined;
  return group?.[sub] ?? false;
}
