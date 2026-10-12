'use client';

import { createContext, useContext } from 'react';
import { resolveBrand, type Brand } from '@matrixhr/shared';

const BrandContext = createContext<Brand>(resolveBrand({}));

export function BrandProvider({ brand, children }: { brand: Brand; children: React.ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

/** The deployment's brand (product name, logo, support email…). Never hard-code the product name in the UI. */
export const useBrand = () => useContext(BrandContext);

/** ".host" shown after a company-address field; empty when a white-label deployment has no website to derive it from. */
export function useDomainSuffix(): string {
  const b = useBrand();
  if (!b.whiteLabel) return '.matrixhr.com';
  try { return b.websiteUrl ? `.${new URL(b.websiteUrl).hostname.replace(/^www\./, '')}` : ''; } catch { return ''; }
}
