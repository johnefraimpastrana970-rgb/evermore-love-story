import type { SupabaseClient } from '@supabase/supabase-js';
import { GameState, migrate } from '../core/state';

/*
 * Optional cloud sync (Supabase). Disabled unless VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
 * in a .env file. Only the public anon/publishable key is ever used in the client — never a service-role key.
 * Security is enforced by Row Level Security (see supabase/migrations).
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Prefer the new publishable key; the legacy anon key also works. NEVER put a service-role / secret key here.
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
if (KEY && /service_role|^sb_secret_/.test(KEY)) throw new Error('Refusing to start: a secret Supabase key was put in the client config.');
const BUCKET = 'memories';

let client: SupabaseClient | null = null;
let email: string | null = null;

async function sb(): Promise<SupabaseClient> {
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await client.auth.getSession();
    email = data.session?.user.email ?? null;
    client.auth.onAuthStateChange((_e, session) => { email = session?.user.email ?? null; });
  }
  return client;
}

const urlCache = new Map<string, { url: string; exp: number }>();

export const cloud = {
  configured: !!(URL_ && KEY),

  async init() {
    if (this.configured) await sb().catch((e) => console.warn('[cloud] init failed', e));
  },

  userEmail(): string | null {
    return email;
  },

  async signIn(addr: string): Promise<string | null> {
    const c = await sb();
    const { error } = await c.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false } });
    return error?.message ?? null;
  },

  async signOut() {
    const c = await sb();
    await c.auth.signOut();
    email = null;
  },

  /** Upload the current save. Returns an error message or null. */
  async push(state: GameState): Promise<string | null> {
    const c = await sb();
    const { data: u } = await c.auth.getUser();
    if (!u.user) return 'Not signed in';
    const { error } = await c.from('saves').upsert({ user_id: u.user.id, data: state, updated_at: new Date(state.updatedAt).toISOString() });
    return error?.message ?? null;
  },

  /** Download the cloud save. Returns state, null (none) or an error string. */
  async pull(): Promise<GameState | null | string> {
    const c = await sb();
    const { data: u } = await c.auth.getUser();
    if (!u.user) return 'Not signed in';
    const { data, error } = await c.from('saves').select('data').eq('user_id', u.user.id).maybeSingle();
    if (error) return error.message;
    if (!data) return null;
    try {
      return migrate(data.data);
    } catch (e) {
      return (e as Error).message;
    }
  },

  /** Short-lived signed URL for a private photo ("cloud:<path>"). */
  async signedUrl(path: string): Promise<string | null> {
    if (!this.configured) return null;
    const hit = urlCache.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    const c = await sb();
    const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data) {
      console.warn('[cloud] signed url failed', error);
      return null;
    }
    urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  },
};
