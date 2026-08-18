import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import {
  generatePassword,
  generateUsername,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/crypto";
import type {
  AuthUser,
  PresenceStatus,
  PublicUser,
  StaffProfileId,
  UserRole,
} from "@/lib/auth/types";
import { supabaseCreateUser, supabaseVerifyPassword } from "@/lib/supabase/admin";

const COLLECTION = "users";

const PRESENCE: PresenceStatus[] = ["available", "away", "busy", "offline"];

export function normalizePresence(raw?: string | null): PresenceStatus {
  const v = String(raw || "").toLowerCase() as PresenceStatus;
  return PRESENCE.includes(v) ? v : "available";
}

export function toPublicUser(u: AuthUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email || `${u.username}@octivate.io`,
    displayName: u.displayName || u.username,
    role: u.role,
    staffProfileId: u.staffProfileId,
    createdAt: u.createdAt,
    disabled: u.disabled,
    avatarUrl: u.avatarExt
      ? `/api/auth/avatar?userId=${encodeURIComponent(u.id)}&v=${encodeURIComponent(u.avatarUpdatedAt || u.id)}`
      : null,
    description: u.description || "",
    presenceStatus: normalizePresence(u.presenceStatus),
  };
}

export async function listUsers(): Promise<AuthUser[]> {
  const users = await readCollection<AuthUser>(COLLECTION, []);
  // Migrate legacy rows missing email/displayName
  let dirty = false;
  for (const u of users) {
    if (!u.email) {
      u.email = `${u.username}@octivate.io`;
      dirty = true;
    }
    if (!u.displayName) {
      u.displayName = u.username;
      dirty = true;
    }
  }
  if (dirty) await writeCollection(COLLECTION, users);
  return users;
}

export async function findUserByUsername(username: string): Promise<AuthUser | null> {
  const users = await listUsers();
  const key = username.trim().toLowerCase();
  return (
    users.find(
      (u) =>
        u.username.toLowerCase() === key ||
        (u.email && u.email.toLowerCase() === key)
    ) ?? null
  );
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const users = await listUsers();
  const key = email.trim().toLowerCase();
  return users.find((u) => u.email?.toLowerCase() === key) ?? null;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const users = await listUsers();
  return users.find((u) => u.id === id) ?? null;
}

export async function findUserByStaffProfileId(
  profileId: StaffProfileId
): Promise<AuthUser | null> {
  const users = await listUsers();
  return users.find((u) => u.staffProfileId === profileId && !u.disabled) ?? null;
}

export async function saveUsers(users: AuthUser[]): Promise<void> {
  await writeCollection(COLLECTION, users);
}

/**
 * Autogenerate credentials. Plaintext password returned ONCE — never stored.
 */
export async function provisionUser(opts?: {
  role?: UserRole;
  username?: string;
  email?: string;
  displayName?: string;
  staffProfileId?: StaffProfileId;
  password?: string;
}): Promise<{ user: PublicUser; password: string }> {
  const users = await listUsers();
  let username = opts?.username?.trim() || generateUsername("oct");
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    username = generateUsername("oct");
  }
  const email =
    opts?.email?.trim().toLowerCase() || `${username}@members.octivate.io`;
  if (users.some((u) => u.email?.toLowerCase() === email)) {
    throw new Error("Email already registered");
  }
  const password = opts?.password || generatePassword();
  const { salt, hash } = hashPassword(password);

  let supabaseUserId: string | undefined;
  const sb = await supabaseCreateUser({
    email,
    password,
    displayName: opts?.displayName || username,
  });
  if (sb) supabaseUserId = sb.id;

  const user: AuthUser = {
    id: uid("usr"),
    username,
    email,
    displayName: opts?.displayName || username,
    role: opts?.role || "member",
    staffProfileId: opts?.staffProfileId,
    supabaseUserId,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeCollection(COLLECTION, users);
  return { user: toPublicUser(user), password };
}

export async function authenticateUser(
  usernameOrEmail: string,
  password: string
): Promise<AuthUser | null> {
  const user = await findUserByUsername(usernameOrEmail);
  if (!user || user.disabled) return null;

  const localOk = verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (localOk) return user;

  // Fallback: verify against Supabase if local hash fails (password rotated remotely)
  if (user.email) {
    const remoteOk = await supabaseVerifyPassword(user.email, password);
    if (remoteOk) {
      const { salt, hash } = hashPassword(password);
      const users = await listUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        users[idx] = { ...users[idx], passwordSalt: salt, passwordHash: hash };
        await writeCollection(COLLECTION, users);
        return users[idx];
      }
    }
  }
  return null;
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<AuthUser | null> {
  const users = await listUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], disabled };
  await writeCollection(COLLECTION, users);
  return users[idx];
}

export async function resetUserPassword(userId: string): Promise<string | null> {
  const users = await listUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  const password = generatePassword();
  const { salt, hash } = hashPassword(password);
  users[idx] = { ...users[idx], passwordSalt: salt, passwordHash: hash };
  await writeCollection(COLLECTION, users);
  return password;
}

export async function updateUserProfile(
  userId: string,
  patch: {
    displayName?: string;
    description?: string;
    avatarExt?: string | null;
    avatarUpdatedAt?: string | null;
    presenceStatus?: PresenceStatus;
  }
): Promise<AuthUser | null> {
  const users = await listUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  const next = { ...users[idx] };
  if (patch.displayName !== undefined) {
    const name = patch.displayName.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 64);
    if (name.length < 2) throw new Error("Display name must be at least 2 characters");
    next.displayName = name;
  }
  if (patch.description !== undefined) {
    next.description = patch.description;
  }
  if (patch.presenceStatus !== undefined) {
    next.presenceStatus = normalizePresence(patch.presenceStatus);
  }
  if (patch.avatarExt === null) {
    delete next.avatarExt;
    delete next.avatarUpdatedAt;
  } else if (typeof patch.avatarExt === "string") {
    next.avatarExt = patch.avatarExt;
    next.avatarUpdatedAt = patch.avatarUpdatedAt || new Date().toISOString();
  }
  users[idx] = next;
  await writeCollection(COLLECTION, users);
  return next;
}

/** Set password without requiring the current one (forgot-password flow). */
export async function setUserPasswordDirect(
  userId: string,
  newPassword: string
): Promise<AuthUser | null> {
  if (newPassword.length < 10) {
    throw new Error("New password must be at least 10 characters");
  }
  if (newPassword.length > 128) {
    throw new Error("New password is too long");
  }
  const users = await listUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  const { salt, hash } = hashPassword(newPassword);
  users[idx] = { ...users[idx], passwordSalt: salt, passwordHash: hash };
  await writeCollection(COLLECTION, users);
  return users[idx];
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<AuthUser | null> {
  const user = await findUserById(userId);
  if (!user || user.disabled) return null;
  if (!verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
    throw new Error("Current password is incorrect");
  }
  if (newPassword.length < 10) {
    throw new Error("New password must be at least 10 characters");
  }
  if (newPassword.length > 128) {
    throw new Error("New password is too long");
  }
  const { salt, hash } = hashPassword(newPassword);
  const users = await listUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], passwordSalt: salt, passwordHash: hash };
  await writeCollection(COLLECTION, users);
  return users[idx];
}

export async function countRegisteredUsers(): Promise<number> {
  const users = await listUsers();
  return users.filter((u) => !u.disabled).length;
}
