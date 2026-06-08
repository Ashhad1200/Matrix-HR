import { getPermissionsForRole, canPerform, ROLES } from '@matrixhr/shared';

describe('permissions matrix', () => {
  it('admin roles get settings nav', () => {
    const p = getPermissionsForRole(ROLES.COMPANY_ADMIN);
    expect(p.portal).toBe('admin');
    expect(p.nav.find((n) => n.href === '/settings')).toBeDefined();
  });

  it('manager gets approvals inbox', () => {
    const p = getPermissionsForRole(ROLES.MANAGER);
    expect(p.portal).toBe('manager');
    expect(p.nav.find((n) => n.href === '/approvals')).toBeDefined();
    expect(canPerform(ROLES.MANAGER, 'leave', 'approve')).toBe(true);
  });

  it('employee gets ESS nav only', () => {
    const p = getPermissionsForRole(ROLES.EMPLOYEE);
    expect(p.portal).toBe('ess');
    expect(p.nav.find((n) => n.href === '/my-pay')).toBeDefined();
    expect(p.nav.find((n) => n.href === '/employees')).toBeUndefined();
  });
});
