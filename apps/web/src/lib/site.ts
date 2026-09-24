/** Public origin for canonical URLs, Open Graph and the sitemap. Set NEXT_PUBLIC_SITE_URL in production. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
