import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase').regex(/[0-9]/, 'Must contain number'),
  companyName: z.string().min(2).max(100),
  subdomain: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().optional(),
});

export const employeeCreateSchema = z.object({
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  cnic: z.string().optional(),
  designationId: z.string().optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  employmentType: z.enum(['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN']).default('PERMANENT'),
  dateOfJoining: z.string().optional(),
  baseSalary: z.number().optional(),
});

export const leaveRequestSchema = z.object({
  policyId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isHalfDay: z.boolean().default(false),
  halfDayPeriod: z.enum(['morning', 'afternoon']).optional(),
  reason: z.string().optional(),
});

export const clockInSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;
