import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  throw new Error('Supabase Vite env nedostaje: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

/**
 * DEV-only debug: potvrđuje da URL i ANON key pripadaju ISTOM Supabase projektu.
 * Ne loguje kompletan key (samo fingerprint + decoded JWT metadata).
 */
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return atob(base64 + pad);
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

type JwtPayload = {
  aud?: string;
  role?: string;
  iss?: string;
  ref?: string;
  exp?: number;
  iat?: number;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payloadStr = base64UrlDecode(parts[1] ?? '');
  return safeJsonParse<JwtPayload>(payloadStr);
}

function fingerprint(token: string): string {
  const start = token.slice(0, 8);
  const end = token.slice(-6);
  return `${start}…${end}`;
}

function getProjectRefFromUrl(u: string): string | null {
  try {
    const host = new URL(u).hostname; // <ref>.supabase.co
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

function devAssertSupabaseConfigMatchesProject() {
  if (!import.meta.env.DEV) return;

  const refFromUrl = getProjectRefFromUrl(url);
  const payload = decodeJwtPayload(anon);

  const debug = {
    urlPresent: Boolean(url),
    anonPresent: Boolean(anon),
    urlHost: (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return 'INVALID_URL';
      }
    })(),
    projectRefFromUrl: refFromUrl,
    anonFingerprint: fingerprint(anon),
    anonJwt: payload
      ? {
          aud: payload.aud,
          role: payload.role,
          iss: payload.iss,
          ref: payload.ref,
          exp: payload.exp,
          iat: payload.iat,
        }
      : null,
  };

  // @ts-expect-error - debug aid
  (globalThis as any).__padrinoSupabaseDebug = debug;

  // eslint-disable-next-line no-console
  console.info('[Padrino][Supabase Debug]', debug);

  const refFromToken = payload?.ref;
  const iss = payload?.iss ?? '';
  const refMatches =
    !!refFromUrl &&
    (!!refFromToken ? refFromToken === refFromUrl : iss.includes(refFromUrl));

  if (!refMatches) {
    // eslint-disable-next-line no-console
    console.error(
      '[Padrino][Supabase Debug] MISMATCH: VITE_SUPABASE_URL projekat i VITE_SUPABASE_ANON_KEY nisu isti. ' +
        'Provjeri da key pripada projektu iz URL-a.'
    );
    throw new Error(
      'Supabase env mismatch: VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY nisu iz istog projekta (vidi console log).'
    );
  }
}

devAssertSupabaseConfigMatchesProject();

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});
