import { Brand, resolveBrand, brandPrefix } from '@matrixhr/shared';

/** The deployment's brand. Read per call so tests (and ops) can change env without a rebuild. */
export const brand = (): Brand => resolveBrand(process.env as Record<string, string | undefined>);
export const brandName = () => brand().name;
export const docPrefix = () => brandPrefix(brand());
/** "Name <address>" for SMTP; the sender name follows the brand. */
export function brandFrom(address: string) {
  return `${brand().emailFromName} <${address}>`;
}
