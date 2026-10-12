// Dynamic Expo config. With no WL_* variables this is exactly app.json (the platform's own app).
// For a white-label build set WL_PRODUCT_NAME (and optionally WL_PRIMARY_COLOR, WL_LOGO_URL, WL_FAVICON_URL,
// WL_APP_ID, WL_SUPPORT_EMAIL, WL_WEBSITE_URL) before running `eas build` / `expo prebuild`.
module.exports = ({ config }) => {
  const env = process.env;
  const name = (env.WL_PRODUCT_NAME || '').trim();
  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
  const color = /^#[0-9a-fA-F]{6}$/.test(env.WL_PRIMARY_COLOR || '') ? env.WL_PRIMARY_COLOR : null;
  const brand = {
    whiteLabel: !!name,
    name: name || 'MatrixHR',
    primaryColor: color,
    logoUrl: (env.WL_LOGO_URL || '').trim() || null,
    supportEmail: (env.WL_SUPPORT_EMAIL || '').trim() || null,
    websiteUrl: (env.WL_WEBSITE_URL || '').trim() || null,
  };
  if (!name) return { ...config, extra: { ...(config.extra || {}), brand } };
  const appId = (env.WL_APP_ID || `com.${slugify(name).replace(/-/g, '')}.app`).trim();
  const icon = (env.WL_FAVICON_URL || '').trim();
  return {
    ...config,
    name,
    slug: slugify(name),
    scheme: slugify(name).replace(/-/g, ''),
    ...(icon && /^\.?\.?\//.test(icon) ? { icon } : {}),
    splash: { ...(config.splash || {}), backgroundColor: color || (config.splash || {}).backgroundColor },
    ios: { ...(config.ios || {}), bundleIdentifier: appId },
    android: { ...(config.android || {}), package: appId, adaptiveIcon: { ...((config.android || {}).adaptiveIcon || {}), backgroundColor: color || undefined } },
    extra: { ...(config.extra || {}), brand },
  };
};
