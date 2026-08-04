import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;
let anon: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      process.env.SUPABASE_ANON_KEY?.trim()
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (!admin) {
    admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return admin;
}

export function getSupabaseAnon(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (!anon) {
    anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return anon;
}

export async function supabaseCreateUser(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ id: string } | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  const { data, error } = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName || input.email },
  });
  if (error || !data.user) {
    // If already exists, try to find by email
    if (error?.message?.toLowerCase().includes("already")) {
      const listed = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
      const hit = listed.data.users.find(
        (u) => u.email?.toLowerCase() === input.email.toLowerCase()
      );
      if (hit) return { id: hit.id };
    }
    return null;
  }
  return { id: data.user.id };
}

export async function supabaseVerifyPassword(
  email: string,
  password: string
): Promise<boolean> {
  const client = getSupabaseAnon();
  if (!client) return false;
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return false;
  // Sign out server-side session immediately; we use Octivate cookies.
  await client.auth.signOut();
  return true;
}

export async function supabaseDisableUser(supabaseUserId: string): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  await client.auth.admin.updateUserById(supabaseUserId, { ban_duration: "876600h" });
}

export async function supabaseCountUsers(): Promise<number | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) return null;
  // listUsers doesn't always return total; fall back to paging
  let total = data.users.length;
  let page = 1;
  while (data.users.length === 1000 || page === 1) {
    const batch = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (page > 1) total += batch.data.users.length;
    else total = batch.data.users.length;
    if (batch.data.users.length < 200) break;
    page += 1;
    if (page > 50) break;
  }
  return total;
}
