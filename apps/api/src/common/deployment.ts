/**
 * SINGLE_COMPANY_MODE=true: one company runs its own copy (a customer who bought the source). Every module is on, there are
 * no plans, trial, billing, payment screens, credits or platform operator pages, and public sign-up is closed once the
 * company exists.
 */
export const singleCompanyMode = () => process.env.SINGLE_COMPANY_MODE === 'true';
