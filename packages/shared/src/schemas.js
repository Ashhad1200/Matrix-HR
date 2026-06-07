"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clockInSchema = exports.leaveRequestSchema = exports.employeeCreateSchema = exports.loginSchema = exports.signUpSchema = void 0;
const zod_1 = require("zod");
exports.signUpSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase')
        .regex(/[a-z]/, 'Must contain lowercase').regex(/[0-9]/, 'Must contain number'),
    companyName: zod_1.z.string().min(2).max(100),
    subdomain: zod_1.z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
    tenantId: zod_1.z.string().optional(),
});
exports.employeeCreateSchema = zod_1.z.object({
    employeeCode: zod_1.z.string().min(1),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    cnic: zod_1.z.string().optional(),
    designationId: zod_1.z.string().optional(),
    departmentId: zod_1.z.string().optional(),
    managerId: zod_1.z.string().optional(),
    employmentType: zod_1.z.enum(['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN']).default('PERMANENT'),
    dateOfJoining: zod_1.z.string().optional(),
    baseSalary: zod_1.z.number().optional(),
});
exports.leaveRequestSchema = zod_1.z.object({
    policyId: zod_1.z.string(),
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
    isHalfDay: zod_1.z.boolean().default(false),
    halfDayPeriod: zod_1.z.enum(['morning', 'afternoon']).optional(),
    reason: zod_1.z.string().optional(),
});
exports.clockInSchema = zod_1.z.object({
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
});
//# sourceMappingURL=schemas.js.map