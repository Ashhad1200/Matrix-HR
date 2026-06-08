import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient, UserRole, EmploymentType, EmployeeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

config({ path: resolve(__dirname, '../../../.env'), override: true });
config({ path: resolve(__dirname, '../.env'), override: true });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Acme Software tenant...');

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'acme' },
    update: {},
    create: {
      name: 'Acme Software',
      subdomain: 'acme',
      plan: 'growth',
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      locale: 'en',
      primaryColor: '#2563eb',
    },
  });

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@acme.com',
      passwordHash,
      role: UserRole.COMPANY_ADMIN,
      emailVerified: true,
    },
  });

  const hrUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'hr@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'hr@acme.com',
      passwordHash,
      role: UserRole.HR_MANAGER,
      emailVerified: true,
    },
  });

  const departments = await Promise.all(
    ['Engineering', 'Product', 'Sales', 'HR', 'Finance', 'Operations'].map((name) =>
      prisma.department.upsert({
        where: { id: `${tenant.id}-${name.toLowerCase()}` },
        update: {},
        create: { id: `${tenant.id}-${name.toLowerCase()}`, tenantId: tenant.id, name },
      }),
    ),
  );

  const engDept = departments.find((d) => d.name === 'Engineering')!;

  const designations = await Promise.all(
    [
      { name: 'Software Engineer', grade: 'L3' },
      { name: 'Senior Software Engineer', grade: 'L4' },
      { name: 'Engineering Manager', grade: 'M1' },
      { name: 'Product Manager', grade: 'L4' },
      { name: 'HR Manager', grade: 'M1' },
    ].map((d) =>
      prisma.designation.upsert({
        where: { id: `${tenant.id}-${d.name.replace(/\s/g, '-').toLowerCase()}` },
        update: {},
        create: {
          id: `${tenant.id}-${d.name.replace(/\s/g, '-').toLowerCase()}`,
          tenantId: tenant.id,
          name: d.name,
          grade: d.grade,
          departmentId: d.name.includes('Engineer') || d.name.includes('Manager') && d.name.includes('Engineering')
            ? engDept.id
            : undefined,
        },
      }),
    ),
  );

  const seDesignation = designations.find((d) => d.name === 'Software Engineer')!;

  const manager = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'EMP001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      employeeCode: 'EMP001',
      firstName: 'Ali',
      lastName: 'Khan',
      email: 'ali.khan@acme.com',
      phone: '+923001234567',
      cnic: '42101-1234567-1',
      designationId: designations.find((d) => d.name === 'Engineering Manager')!.id,
      departmentId: engDept.id,
      employmentType: EmploymentType.PERMANENT,
      dateOfJoining: new Date('2022-01-15'),
      status: EmployeeStatus.ACTIVE,
      baseSalary: 350000,
    },
  });

  const employee = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'EMP002' } },
    update: {},
    create: {
      tenantId: tenant.id,
      employeeCode: 'EMP002',
      firstName: 'Sara',
      lastName: 'Ahmed',
      email: 'sara.ahmed@acme.com',
      phone: '+923007654321',
      cnic: '42101-7654321-2',
      designationId: seDesignation.id,
      departmentId: engDept.id,
      managerId: manager.id,
      employmentType: EmploymentType.PERMANENT,
      dateOfJoining: new Date('2023-06-01'),
      probationEndDate: new Date('2023-09-01'),
      status: EmployeeStatus.ACTIVE,
      baseSalary: 180000,
    },
  });

  await prisma.user.update({
    where: { id: adminUser.id },
    data: { employeeId: manager.id },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'sara.ahmed@acme.com' } },
    update: { employeeId: employee.id },
    create: {
      tenantId: tenant.id,
      email: 'sara.ahmed@acme.com',
      passwordHash,
      role: UserRole.EMPLOYEE,
      employeeId: employee.id,
      emailVerified: true,
    },
  });

  // Leave policies
  const leavePolicies = [
    { code: 'annual', name: 'Annual Leave', daysPerYear: 14 },
    { code: 'casual', name: 'Casual Leave', daysPerYear: 10 },
    { code: 'sick', name: 'Sick Leave', daysPerYear: 8 },
  ];

  for (const policy of leavePolicies) {
    const p = await prisma.leavePolicy.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: policy.code } },
      update: {},
      create: { tenantId: tenant.id, ...policy, accrualType: 'yearly', allowHalfDay: true },
    });

    for (const emp of [manager, employee]) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_policyId_year: { employeeId: emp.id, policyId: p.id, year: 2026 } },
        update: {},
        create: {
          tenantId: tenant.id,
          employeeId: emp.id,
          policyId: p.id,
          year: 2026,
          entitled: policy.daysPerYear,
          used: 0,
          pending: 0,
          carried: 0,
        },
      });
    }
  }

  // Pakistan holidays 2026
  const holidays = [
    { name: 'Pakistan Day', date: new Date('2026-03-23') },
    { name: 'Labour Day', date: new Date('2026-05-01') },
    { name: 'Independence Day', date: new Date('2026-08-14') },
    { name: 'Defence Day', date: new Date('2026-09-06') },
    { name: 'Iqbal Day', date: new Date('2026-11-09') },
    { name: 'Quaid-e-Azam Day', date: new Date('2026-12-25') },
  ];

  for (const h of holidays) {
    await prisma.holiday.create({
      data: { tenantId: tenant.id, name: h.name, date: h.date, country: 'PK' },
    }).catch(() => {});
  }

  // Flexible shift
  await prisma.shift.upsert({
    where: { id: `${tenant.id}-flexible` },
    update: {},
    create: {
      id: `${tenant.id}-flexible`,
      tenantId: tenant.id,
      name: 'Flexible 8-Hour',
      type: 'flexible',
      workingHours: 8,
      graceMinutes: 15,
    },
  });

  // Office location
  await prisma.officeLocation.upsert({
    where: { id: `${tenant.id}-hq` },
    update: {},
    create: {
      id: `${tenant.id}-hq`,
      tenantId: tenant.id,
      name: 'Acme HQ Karachi',
      address: 'Clifton, Karachi',
      latitude: 24.8138,
      longitude: 67.0299,
      radiusMeters: 200,
    },
  });

  // Onboarding template
  const template = await prisma.onboardingTemplate.upsert({
    where: { id: `${tenant.id}-se-onboarding` },
    update: {},
    create: {
      id: `${tenant.id}-se-onboarding`,
      tenantId: tenant.id,
      name: 'Software Engineer Onboarding',
      role: 'Software Engineer',
      department: 'Engineering',
    },
  });

  const tasks = [
    { title: 'Sign NDA', phase: 'pre_joining', assignee: 'employee', order: 1 },
    { title: 'Submit CNIC copy', phase: 'pre_joining', assignee: 'employee', order: 2 },
    { title: 'Submit education certificates', phase: 'pre_joining', assignee: 'employee', order: 3 },
    { title: 'Issue laptop', phase: 'day1', assignee: 'it', order: 4 },
    { title: 'Create email account', phase: 'day1', assignee: 'it', order: 5 },
    { title: 'Setup GitHub access', phase: 'day1', assignee: 'it', order: 6 },
    { title: 'Setup Slack access', phase: 'day1', assignee: 'it', order: 7 },
    { title: 'Manager introduction', phase: 'day1', assignee: 'manager', order: 8 },
    { title: 'Team orientation', phase: 'week1', assignee: 'manager', order: 9 },
    { title: 'Probation review', phase: 'month3', assignee: 'hr', order: 10 },
  ];

  const templateTaskIds: string[] = [];
  for (const task of tasks) {
    const taskId = `${template.id}-task-${task.order}`;
    templateTaskIds.push(taskId);
    await prisma.onboardingTask.upsert({
      where: { id: taskId },
      update: {},
      create: { id: taskId, templateId: template.id, ...task },
    });
  }

  const annualPolicy = await prisma.leavePolicy.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: 'annual' } },
  });
  const casualPolicy = await prisma.leavePolicy.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: 'casual' } },
  });
  const sickPolicy = await prisma.leavePolicy.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: 'sick' } },
  });

  const shift = await prisma.shift.findUnique({ where: { id: `${tenant.id}-flexible` } });

  const { seedBulkData } = await import('../src/seed-bulk');
  const bulk = await seedBulkData(prisma, tenant.id, {
    departments,
    designations,
    engDeptId: engDept.id,
    seDesignationId: seDesignation.id,
    managerId: manager.id,
    shiftId: shift!.id,
    templateId: template.id,
    templateTaskIds,
    adminUserId: adminUser.id,
    hrUserId: hrUser.id,
    policyIds: {
      annual: annualPolicy!.id,
      casual: casualPolicy!.id,
      sick: sickPolicy!.id,
    },
    passwordHash,
  });

  console.log('Seed complete!');
  console.log(`  Employees: ${bulk.employeeCount}`);
  console.log('  Tenant: acme.matrixhr.com');
  console.log('  Admin: admin@acme.com / Password123!');
  console.log('  HR: hr@acme.com / Password123!');
  console.log('  Employee: sara.ahmed@acme.com / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
