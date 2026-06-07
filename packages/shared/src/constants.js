"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICING_TIERS = exports.DEFAULT_LEAVE_POLICIES = exports.EOBI_MIN_WAGE = exports.EOBI_EMPLOYER_RATE = exports.EOBI_EMPLOYEE_RATE = exports.PAKISTAN_TAX_SLABS_2025 = exports.ROLES = void 0;
exports.ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    HR_MANAGER: 'HR_MANAGER',
    MANAGER: 'MANAGER',
    EMPLOYEE: 'EMPLOYEE',
};
exports.PAKISTAN_TAX_SLABS_2025 = [
    { min: 0, max: 600000, rate: 0 },
    { min: 600001, max: 1200000, rate: 0.025 },
    { min: 1200001, max: 2200000, rate: 0.125 },
    { min: 2200001, max: 3200000, rate: 0.2 },
    { min: 3200001, max: 4100000, rate: 0.25 },
    { min: 4100001, max: Infinity, rate: 0.35 },
];
exports.EOBI_EMPLOYEE_RATE = 0.01;
exports.EOBI_EMPLOYER_RATE = 0.05;
exports.EOBI_MIN_WAGE = 37000;
exports.DEFAULT_LEAVE_POLICIES = [
    { code: 'annual', name: 'Annual Leave', daysPerYear: 14 },
    { code: 'casual', name: 'Casual Leave', daysPerYear: 10 },
    { code: 'sick', name: 'Sick Leave', daysPerYear: 8 },
];
exports.PRICING_TIERS = {
    starter: { name: 'Starter', pricePkr: 250 },
    growth: { name: 'Growth', pricePkr: 500 },
    pro: { name: 'Pro', pricePkr: 850 },
    enterprise: { name: 'Enterprise', pricePkr: null },
};
//# sourceMappingURL=constants.js.map