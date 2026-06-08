import {
  PrismaClient,
  LeaveRequestStatus,
  AttendanceStatus,
  AttendanceSource,
  JobApplicationStatus,
  ReviewCycleStatus,
  CourseStatus,
  NotificationChannel,
  EmploymentType,
  EmployeeStatus,
  PayrollRunStatus,
} from '@prisma/client';

const FIRST_NAMES = [
  'Ayesha', 'Hassan', 'Fatima', 'Usman', 'Zainab', 'Bilal', 'Hira', 'Omar',
  'Maryam', 'Hamza', 'Sana', 'Imran', 'Nadia', 'Kamran', 'Rabia', 'Tariq',
  'Amna', 'Faisal', 'Sadia', 'Waqas', 'Hina', 'Asad', 'Lubna', 'Danish', 'Mehwish',
];
const LAST_NAMES = [
  'Khan', 'Ahmed', 'Malik', 'Hussain', 'Sheikh', 'Raza', 'Iqbal', 'Siddiqui',
  'Butt', 'Mirza', 'Qureshi', 'Abbasi', 'Chaudhry', 'Ansari', 'Hashmi',
];

const JOB_TITLES = [
  'Senior Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer',
  'QA Engineer', 'UI/UX Designer', 'Product Manager', 'Business Analyst',
  'Sales Executive', 'Marketing Specialist', 'HR Coordinator', 'Accountant',
  'Customer Success Manager', 'Data Analyst', 'Mobile Developer', 'Scrum Master',
  'Technical Writer', 'Security Engineer', 'ML Engineer', 'Cloud Architect',
  'Finance Analyst', 'Operations Lead', 'Recruiter', 'Support Engineer', 'Intern Developer',
];

const COURSE_TITLES = [
  'Pakistan Labor Law Basics', 'Workplace Safety', 'Anti-Harassment Training',
  'Data Privacy & GDPR', 'Leadership Fundamentals', 'Agile Scrum', 'Git & Code Review',
  'Customer Communication', 'Excel for HR', 'FBR Tax Awareness', 'EOBI Compliance',
  'Performance Feedback', 'Conflict Resolution', 'Time Management', 'Presentation Skills',
  'Urdu Business Writing', 'Remote Work Best Practices', 'Cybersecurity Essentials',
  'Onboarding for Managers', 'Payroll Basics', 'Interview Skills', 'Sales Fundamentals',
  'Product Discovery', 'Design Systems', 'API Security',
];

export async function seedBulkData(
  prisma: PrismaClient,
  tenantId: string,
  opts: {
    departments: { id: string; name: string }[];
    designations: { id: string; name: string }[];
    engDeptId: string;
    seDesignationId: string;
    managerId: string;
    shiftId: string;
    templateId: string;
    templateTaskIds: string[];
    adminUserId: string;
    hrUserId: string;
    policyIds: { annual: string; casual: string; sick: string };
    passwordHash: string;
  },
) {
  const {
    departments, designations, engDeptId, seDesignationId, managerId, shiftId,
    templateId, templateTaskIds, adminUserId, hrUserId, policyIds, passwordHash,
  } = opts;

  // Clear bulk-seeded records (safe re-run)
  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.whatsAppMessage.deleteMany({ where: { tenantId } });
  await prisma.courseEnrollment.deleteMany({ where: { course: { tenantId } } });
  await prisma.course.deleteMany({ where: { tenantId } });
  await prisma.goal.deleteMany({ where: { tenantId } });
  await prisma.performanceReview.deleteMany({ where: { tenantId } });
  await prisma.reviewCycle.deleteMany({ where: { tenantId } });
  await prisma.jobApplication.deleteMany({ where: { tenantId } });
  await prisma.jobPosting.deleteMany({ where: { tenantId } });
  await prisma.payrollItem.deleteMany({ where: { payrollRun: { tenantId } } });
  await prisma.payrollRun.deleteMany({ where: { tenantId } });
  await prisma.onboardingTaskProgress.deleteMany({ where: { progress: { tenantId } } });
  await prisma.onboardingProgress.deleteMany({ where: { tenantId } });
  await prisma.regularizationRequest.deleteMany({ where: { tenantId } });
  await prisma.attendanceLog.deleteMany({ where: { tenantId } });
  await prisma.leaveRequest.deleteMany({ where: { tenantId } });
  await prisma.employeeDocument.deleteMany({ where: { tenantId } });

  // ─── 25 Employees ─────────────────────────────────────────────────────────
  const activeEmployees = [];
  for (let i = 1; i <= 25; i++) {
    const code = `EMP${String(i).padStart(3, '0')}`;
    const dept = departments[i % departments.length];
    const desig = designations[i % designations.length];
    const emp = await prisma.employee.upsert({
      where: { tenantId_employeeCode: { tenantId, employeeCode: code } },
      update: {
        baseSalary: 120000 + i * 8000,
        managerId: i > 2 && i <= 15 ? managerId : i === 1 ? undefined : undefined,
      },
      create: {
        tenantId,
        employeeCode: code,
        firstName: FIRST_NAMES[i - 1],
        lastName: LAST_NAMES[i % LAST_NAMES.length],
        email: `${FIRST_NAMES[i - 1].toLowerCase()}.${LAST_NAMES[i % LAST_NAMES.length].toLowerCase()}@acme.com`,
        phone: `+92300${String(1000000 + i).slice(-7)}`,
        cnic: `42101-${String(1000000 + i).slice(-7)}-${i % 9}`,
        designationId:
          i === 1
            ? designations.find((d) => d.name.includes('Engineering Manager'))?.id
            : i === 2
              ? seDesignationId
              : desig.id,
        departmentId: i <= 2 ? engDeptId : dept.id,
        managerId: i > 2 && i <= 15 ? managerId : undefined,
        employmentType: i === 25 ? EmploymentType.INTERN : EmploymentType.PERMANENT,
        dateOfJoining: new Date(2022 + (i % 4), (i % 12), 1 + (i % 28)),
        status: EmployeeStatus.ACTIVE,
        baseSalary: 120000 + i * 8000,
        bankAccount: `PK${String(1000000000 + i)}`,
        iban: `PK36MEZN${String(100000000000 + i)}`,
      },
    });
    activeEmployees.push(emp);
  }

  // Link HR user to an employee if missing
  await prisma.user.update({
    where: { id: hrUserId },
    data: { employeeId: activeEmployees[2]?.id },
  }).catch(() => {});

  // Employee portal users for a few staff
  for (let i = 3; i <= 6; i++) {
    const emp = activeEmployees[i];
    if (!emp?.email) continue;
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: emp.email } },
      update: { employeeId: emp.id, role: i === 5 ? 'MANAGER' : 'EMPLOYEE' },
      create: {
        tenantId,
        email: emp.email,
        passwordHash,
        role: i === 5 ? 'MANAGER' : 'EMPLOYEE',
        employeeId: emp.id,
        emailVerified: true,
      },
    });
  }

  // Leave balances for all 25
  for (const emp of activeEmployees) {
    for (const [code, policyId] of Object.entries(policyIds)) {
      const days = code === 'annual' ? 14 : code === 'casual' ? 10 : 8;
      await prisma.leaveBalance.upsert({
        where: { employeeId_policyId_year: { employeeId: emp.id, policyId, year: 2026 } },
        update: {},
        create: {
          tenantId,
          employeeId: emp.id,
          policyId,
          year: 2026,
          entitled: days,
          used: Math.floor(Math.random() * 3),
          pending: 0,
          carried: 0,
        },
      });
    }
  }

  // ─── 25 Leave Requests ────────────────────────────────────────────────────
  const statuses: LeaveRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'APPROVED', 'PENDING'];
  for (let i = 0; i < 25; i++) {
    const emp = activeEmployees[i % activeEmployees.length];
    const policyKey = i % 3 === 0 ? policyIds.annual : i % 3 === 1 ? policyIds.casual : policyIds.sick;
    const start = new Date(2026, 5, 1 + i);
    const end = new Date(2026, 5, 1 + i + (i % 3));
    const status = statuses[i % statuses.length];
    await prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId: emp.id,
        policyId: policyKey,
        startDate: start,
        endDate: end,
        days: 1 + (i % 3),
        reason: `Leave request #${i + 1} — personal / medical / family`,
        status,
        approverId: status !== 'PENDING' ? managerId : undefined,
        approvedAt: status === 'APPROVED' ? new Date() : undefined,
        rejectionReason: status === 'REJECTED' ? 'Peak project deadline' : undefined,
      },
    });
  }

  // ─── 25 Attendance Logs (last 25 weekdays) ────────────────────────────────
  const attStatuses: AttendanceStatus[] = ['PRESENT', 'PRESENT', 'LATE', 'PRESENT', 'HALF_DAY'];
  for (let i = 0; i < 25; i++) {
    const emp = activeEmployees[i % activeEmployees.length];
    const date = new Date();
    date.setDate(date.getDate() - i);
    const clockIn = new Date(date);
    clockIn.setHours(9 + (i % 2), 15, 0, 0);
    const clockOut = new Date(date);
    clockOut.setHours(17 + (i % 2), 30, 0, 0);
    await prisma.attendanceLog.create({
      data: {
        tenantId,
        employeeId: emp.id,
        shiftId,
        date,
        clockIn,
        clockOut,
        hours: 7.5 + (i % 2) * 0.5,
        status: attStatuses[i % attStatuses.length],
        source: i % 4 === 0 ? AttendanceSource.MOBILE : AttendanceSource.WEB,
        latitude: 24.8138,
        longitude: 67.0299,
      },
    });
  }

  // ─── 25 Onboarding progress records ───────────────────────────────────────
  for (let i = 0; i < 25; i++) {
    const emp = activeEmployees[i];
    const progress = await prisma.onboardingProgress.create({
      data: {
        tenantId,
        employeeId: emp.id,
        templateId,
        status: i < 20 ? 'in_progress' : 'completed',
        completedAt: i >= 20 ? new Date() : undefined,
        tasks: {
          create: templateTaskIds.map((taskId, ti) => ({
            taskId,
            status: ti < (i % 10) ? 'COMPLETED' : 'PENDING',
            completedAt: ti < (i % 10) ? new Date() : undefined,
          })),
        },
      },
    });
    void progress;
  }

  // ─── Payroll runs (25 months) ─────────────────────────────────────────────
  for (let i = 0; i < 25; i++) {
    const d = new Date(2024, 3 + i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const run = await prisma.payrollRun.create({
      data: {
        tenantId,
        period,
        status: i < 20 ? PayrollRunStatus.APPROVED : PayrollRunStatus.DRAFT,
        processedAt: i < 20 ? new Date() : undefined,
        approvedBy: i < 20 ? adminUserId : undefined,
      },
    });
    for (const emp of activeEmployees.filter((e) => e.baseSalary)) {
      const gross = Number(emp.baseSalary);
      const tax = Math.round(gross * 0.05);
      const eobi = 370;
      const pf = Math.round(gross * 0.08);
      const deductions = tax + eobi + pf;
      await prisma.payrollItem.create({
        data: {
          payrollRunId: run.id,
          employeeId: emp.id,
          grossSalary: gross,
          deductions,
          netSalary: gross - deductions,
          taxAmount: tax,
          eobiAmount: eobi,
          pfAmount: pf,
          breakdown: { gross, tax, eobi, pf },
          disbursed: i < 18,
        },
      });
    }
  }

  // ─── 25 Job postings + 25 applications ────────────────────────────────────
  const jobs = [];
  for (let i = 0; i < 25; i++) {
    const job = await prisma.jobPosting.create({
      data: {
        tenantId,
        title: JOB_TITLES[i],
        department: departments[i % departments.length].name,
        description: `We are hiring a ${JOB_TITLES[i]} to join our growing team in Karachi.`,
        requirements: '2+ years experience. Bachelor degree preferred.',
        status: i < 20 ? 'open' : 'closed',
      },
    });
    jobs.push(job);
  }
  const appStatuses: JobApplicationStatus[] = [
    'APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED',
  ];
  for (let i = 0; i < 25; i++) {
    await prisma.jobApplication.create({
      data: {
        tenantId,
        jobId: jobs[i % jobs.length].id,
        firstName: FIRST_NAMES[i],
        lastName: LAST_NAMES[i % LAST_NAMES.length],
        email: `candidate${i + 1}@email.com`,
        phone: `+92311${String(2000000 + i).slice(-7)}`,
        resumeUrl: `https://storage.matrixhr.com/resumes/candidate-${i + 1}.pdf`,
        source: i % 3 === 0 ? 'LinkedIn' : i % 3 === 1 ? 'Referral' : 'Website',
        status: appStatuses[i % appStatuses.length],
        score: 60 + (i % 40),
        notes: `Application #${i + 1}`,
      },
    });
  }

  // ─── Performance: 5 cycles + 25 goals ───────────────────────────────────
  const cycles = [];
  for (let i = 0; i < 5; i++) {
    const cycle = await prisma.reviewCycle.create({
      data: {
        tenantId,
        name: `Q${(i % 4) + 1} ${2025 + Math.floor(i / 4)} Review`,
        type: 'quarterly',
        startDate: new Date(2025 + Math.floor(i / 4), (i % 4) * 3, 1),
        endDate: new Date(2025 + Math.floor(i / 4), (i % 4) * 3 + 2, 28),
        status: i < 3 ? ReviewCycleStatus.ACTIVE : ReviewCycleStatus.COMPLETED,
      },
    });
    cycles.push(cycle);
  }
  for (let i = 0; i < 25; i++) {
    await prisma.goal.create({
      data: {
        tenantId,
        employeeId: activeEmployees[i % activeEmployees.length].id,
        cycleId: cycles[i % cycles.length].id,
        title: `Goal ${i + 1}: Deliver key initiative`,
        description: `Complete milestone ${i + 1} for the team`,
        weight: 1 + (i % 3),
        progress: (i * 4) % 100,
        status: i % 5 === 0 ? 'completed' : 'active',
        dueDate: new Date(2026, 11, 31),
      },
    });
  }

  // ─── 25 LMS Courses + enrollments ─────────────────────────────────────────
  const courses = [];
  for (let i = 0; i < 25; i++) {
    const course = await prisma.course.create({
      data: {
        tenantId,
        title: COURSE_TITLES[i],
        description: `Mandatory training module: ${COURSE_TITLES[i]}`,
        duration: 30 + i * 5,
        status: CourseStatus.PUBLISHED,
        isMandatory: i < 8,
        content: { modules: [{ title: 'Introduction', duration: 10 }, { title: 'Assessment', duration: 15 }] },
      },
    });
    courses.push(course);
  }
  for (let i = 0; i < 25; i++) {
    await prisma.courseEnrollment.create({
      data: {
        courseId: courses[i % courses.length].id,
        employeeId: activeEmployees[i % activeEmployees.length].id,
        progress: (i * 7) % 100,
        score: i % 4 === 0 ? 70 + (i % 30) : undefined,
        completedAt: i % 4 === 0 ? new Date() : undefined,
      },
    });
  }

  // ─── 25 Notifications ───────────────────────────────────────────────────
  const notifUsers = [adminUserId, hrUserId];
  for (let i = 0; i < 25; i++) {
    await prisma.notification.create({
      data: {
        tenantId,
        userId: notifUsers[i % notifUsers.length],
        title: `Notification #${i + 1}`,
        body: [
          'Leave request pending your approval',
          'New employee onboarding started',
          'Payroll run ready for review',
          'Attendance regularization submitted',
          'New job application received',
        ][i % 5],
        channel: i % 3 === 0 ? NotificationChannel.WHATSAPP : NotificationChannel.IN_APP,
        read: i % 4 === 0,
        metadata: { type: ['leave', 'onboarding', 'payroll', 'attendance', 'recruitment'][i % 5] },
      },
    });
  }

  // ─── 25 WhatsApp messages ─────────────────────────────────────────────────
  for (let i = 0; i < 25; i++) {
    await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        recipientPhone: activeEmployees[i % activeEmployees.length].phone || '+923001234567',
        templateName: ['leave_approved', 'leave_reminder', 'payslip_ready', 'clock_in_reminder', 'balance'][i % 5],
        body: `MatrixHR: Your ${['leave was approved', 'leave balance is 10 days', 'payslip for May is ready', 'please clock in', 'team is out today'][i % 5]}.`,
        status: i % 6 === 0 ? 'failed' : 'delivered',
        direction: i % 5 === 0 ? 'inbound' : 'outbound',
        metadata: { messageIndex: i + 1 },
      },
    });
  }

  // ─── 25 Employee documents ────────────────────────────────────────────────
  for (let i = 0; i < 25; i++) {
    const emp = activeEmployees[i % activeEmployees.length];
    await prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId: emp.id,
        type: ['CNIC', 'Degree', 'Contract', 'Experience Letter', 'NTN'][i % 5],
        name: `Document ${i + 1}`,
        fileUrl: `https://storage.matrixhr.com/docs/${emp.employeeCode}-${i + 1}.pdf`,
        verified: i % 3 !== 0,
      },
    });
  }

  // ─── 25 Holidays ──────────────────────────────────────────────────────────
  const extraHolidays = [
    'Eid ul-Fitr', 'Eid ul-Adha', 'Ashura', 'Mawlid', 'Christmas',
    'New Year', 'Kashmir Day', 'Youm-e-Takbeer', 'Muharram', 'Shab-e-Barat',
    'Basant', 'Holi', 'Guru Nanak Birthday', 'Good Friday', 'Easter',
    'Martyrs Day', 'Founders Day', 'Sports Day', 'Teachers Day', 'Children Day',
    'World Health Day', 'Environment Day', 'Unity Day', 'Culture Day', 'Innovation Day',
  ];
  for (let i = 0; i < 25; i++) {
    await prisma.holiday.create({
      data: {
        tenantId,
        name: extraHolidays[i],
        date: new Date(2026, i % 12, 1 + (i % 28)),
        country: 'PK',
        isOptional: i % 4 === 0,
      },
    }).catch(() => {});
  }

  return { employeeCount: activeEmployees.length };
}
