import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { createClient } from "@/lib/supabase/server";

const PROTECTED_COOKIE = "pah_protected_session";

function protectedSecret() {
  const value = process.env.PROTECTED_SESSION_SECRET;
  if (!value || value.length < 32) return null;
  return new TextEncoder().encode(value);
}

export async function getAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return user?.email?.toLowerCase() === adminEmail ? user : null;
}

export async function requireAdmin() {
  const user = await getAdmin();
  if (!user) redirect("/admin/login");
  return user;
}

export async function hasProtectedAccess() {
  const token = (await cookies()).get(PROTECTED_COOKIE)?.value;
  const secret = protectedSecret();
  if (!token || !secret) return false;
  try {
    const result = await jwtVerify(token, secret, { issuer: "personal-achievement-hub", audience: "protected-content" });
    return result.payload.scope === "protected";
  } catch { return false; }
}

export async function verifyProtectedPassword(password: string) {
  const hash = process.env.PROTECTED_CONTENT_PASSWORD_HASH;
  return Boolean(hash && await compare(password, hash));
}

export async function createProtectedSession() {
  const secret = protectedSecret();
  if (!secret) throw new Error("Protected session secret is not configured");
  const token = await new SignJWT({ scope: "protected" })
    .setProtectedHeader({ alg: "HS256" }).setIssuer("personal-achievement-hub")
    .setAudience("protected-content").setIssuedAt().setExpirationTime("8h").sign(secret);
  (await cookies()).set(PROTECTED_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
  });
}

export async function clearProtectedSession() { (await cookies()).delete(PROTECTED_COOKIE); }
