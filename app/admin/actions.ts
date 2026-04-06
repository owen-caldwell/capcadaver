"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toNullable } from "@/lib/cms";
import { getAdminProfile } from "@/lib/adminAuth";

const idSchema = z.string().uuid();

const artistSchema = z.object({
  name: z.string().trim().min(1),
  url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  image_url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  sort_order: z.coerce.number().int().default(0),
});

const eventSchema = z.object({
  date: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  venue: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  artist: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  city: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  ticket_url: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

async function requireEditor() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const profile = await getAdminProfile(supabase, user);
  if (!profile) {
    throw new Error("No profile found for this user");
  }

  return { supabase, user, role: profile.role };
}

export async function createArtistAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const parsed = artistSchema.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    image_url: formData.get("image_url"),
    sort_order: formData.get("sort_order"),
  });

  const { error } = await supabase.from("artists").insert({
    name: parsed.name,
    url: parsed.url,
    image_url: parsed.image_url,
    sort_order: parsed.sort_order,
    is_active: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteArtistAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = idSchema.parse(formData.get("id"));

  const { error } = await supabase.from("artists").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function createEventAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const parsed = eventSchema.parse({
    date: formData.get("date"),
    venue: formData.get("venue"),
    artist: formData.get("artist"),
    city: formData.get("city"),
    ticket_url: formData.get("ticket_url"),
    notes: formData.get("notes"),
  });

  const { error } = await supabase.from("events").insert(parsed);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteEventAction(formData: FormData) {
  const { supabase } = await requireEditor();
  const id = idSchema.parse(formData.get("id"));

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updateSiteContentAction(formData: FormData) {
  const { supabase } = await requireEditor();

  const key = z.string().trim().min(1).parse(formData.get("key"));
  // site_content.value is currently NOT NULL in this project schema.
  // Persist blank input as empty string instead of null.
  const value = toNullable(formData.get("value")) ?? "";

  const { error } = await supabase
    .from("site_content")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/admin");
  redirect("/admin/login");
}
