'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { GA_DISABLE, GA_ID, track } from '@/lib/analytics';

// The Google tag, as on treevoxa.com (cookie_domain 'auto' shares sessions across *.treevoxa.com), plus one
// delegated listener: any link or button with data-cta="<location>" sends click_cta for this product.
// Leaving the marketing pages by client-side navigation (to sign-in or the app) sets Google's opt-out flag,
// so the tag that is already loaded sends nothing from logged-in screens.
export function GoogleAnalytics({ product }: { product: string }) {
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w[GA_DISABLE] = false;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-cta]');
      if (el) void track('click_cta', { product, location: el.getAttribute('data-cta') });
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      w[GA_DISABLE] = true;
    };
  }, [product]);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
