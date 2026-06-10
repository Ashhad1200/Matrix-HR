export const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// In-memory session token. Cleared on app restart; swap for
// expo-secure-store persistence when shipping to production.
let accessToken: string | null = null;

export function isAuthenticated() {
  return accessToken !== null;
}

export function signOut() {
  accessToken = null;
}

export async function signIn(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Invalid email or password');
  const data = await res.json();
  accessToken = data.accessToken;
  return data;
}

export function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
