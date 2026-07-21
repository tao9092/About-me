"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginSchema, protectedPasswordSchema } from "@/lib/validation";
import {
  clearProtectedSession,
  createProtectedSession,
  verifyProtectedPassword,
} from "@/lib/auth";
export async function loginAction(_: unknown, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Replace the placeholder URL and anon key in .env.local." };
  }
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`login:${ip}`, 5).allowed)
    return { error: "Too many attempts. Try again later." };
  if (
    parsed.data.email.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()
  )
    return { error: "This account is not the site owner." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Sign in failed. Check your credentials." };
  redirect("/admin");
}
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
export async function unlockProtectedAction(_: unknown, formData: FormData) {
  const parsed = protectedPasswordSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return { error: "Enter the access password." };
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`protected:${ip}`, 8).allowed)
    return { error: "Too many attempts. Try again later." };
  if (!(await verifyProtectedPassword(parsed.data.password)))
    return { error: "Incorrect access password." };
  await createProtectedSession();
  return { success: true };
}
export async function exitProtectedAction() {
  await clearProtectedSession();
  redirect("/");
}
