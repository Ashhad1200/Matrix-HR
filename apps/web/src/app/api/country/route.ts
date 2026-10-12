import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { detectCountry } from '@/lib/geo';

export const dynamic = 'force-dynamic';

/** The visitor's country as far as the edge or geo-IP can tell (used to pre-select the sign-up form). */
export async function GET() {
  return NextResponse.json({ country: await detectCountry(headers()) });
}
