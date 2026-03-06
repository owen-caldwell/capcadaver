import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";

const roleSchema = z.enum(["admin", "editor"]);

export type AdminProfile = {
  id: string;
  email: string | null;
  role: "admin" | "editor";
};

export async function getAdminProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<AdminProfile | null> {
  const byIdResult = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (byIdResult.data) {
    const roleResult = roleSchema.safeParse(byIdResult.data.role);
    if (!roleResult.success) return null;
    return { ...byIdResult.data, role: roleResult.data };
  }

  if (!user.email) return null;

  const byEmailResult = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("email", user.email)
    .maybeSingle();

  if (!byEmailResult.data) return null;

  const roleResult = roleSchema.safeParse(byEmailResult.data.role);
  if (!roleResult.success) return null;

  return { ...byEmailResult.data, role: roleResult.data };
}
