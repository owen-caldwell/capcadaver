import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ArtistRecord = {
  id: string;
  name: string;
  url: string | null;
  /** Mugshot / primary image URL (optional column on `artists`). */
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type EventRecord = {
  id: string;
  date: string | null;
  venue: string | null;
  artist: string | null;
  city: string | null;
  ticket_url: string | null;
  notes: string | null;
};

export type SiteContentRecord = {
  key: string;
  value: string | null;
};

export function toNullable(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function getPublicData() {
  const supabase = await createSupabaseServerClient();

  const [{ data: events }, { data: artists }, { data: siteContent }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, venue, artist, city, ticket_url, notes")
        .order("date", { ascending: true }),
      supabase
        .from("artists")
        .select("id, name, url, image_url, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("site_content").select("key, value"),
    ]);

  return {
    events: (events ?? []) as EventRecord[],
    artists: (artists ?? []) as ArtistRecord[],
    siteContent: (siteContent ?? []) as SiteContentRecord[],
  };
}
