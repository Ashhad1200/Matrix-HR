import Constants from 'expo-constants';

/** Brand baked into the build by app.config.js. Never hard-code the product name in a screen. */
export const brand: { whiteLabel: boolean; name: string; primaryColor: string | null; logoUrl: string | null } =
  (Constants.expoConfig?.extra as any)?.brand ?? { whiteLabel: false, name: 'MatrixHR', primaryColor: null, logoUrl: null };
