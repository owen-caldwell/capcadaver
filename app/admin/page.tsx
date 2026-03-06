import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createArtistAction,
  createEventAction,
  deleteArtistAction,
  deleteEventAction,
  signOutAction,
  updateSiteContentAction,
} from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminProfile } from "@/lib/adminAuth";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const profile = await getAdminProfile(supabase, user);

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <main className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-lg font-semibold">No admin access</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Your account is signed in but does not have an admin/editor role in
            `profiles`.
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Signed-in user: {user.email ?? "no-email"} ({user.id})
          </p>
          <div className="mt-4 flex items-center gap-4">
            <form action={signOutAction}>
              <button
                type="submit"
                className="cursor-pointer text-sm underline underline-offset-2"
              >
                Sign out
              </button>
            </form>
            <Link href="/" className="text-sm underline underline-offset-2">
              Back to site
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const [{ data: events }, { data: artists }, { data: content }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, venue, artist, city, ticket_url, notes")
        .order("date", { ascending: false, nullsFirst: false }),
      supabase
        .from("artists")
        .select("id, name, url, sort_order, is_active")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("site_content").select("key, value"),
    ]);

  const contentByKey = Object.fromEntries(
    (content ?? []).map((item) => [item.key, item.value ?? ""]),
  );

  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Admin
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Signed in as {profile.email ?? user.email} ({profile.role})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm underline underline-offset-2">
              View site
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="cursor-pointer text-sm underline underline-offset-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Site content</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Update bio and contact details rendered on the public site.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <form action={updateSiteContentAction} className="space-y-2">
              <input type="hidden" name="key" value="bio" />
              <label
                htmlFor="bio"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Bio
              </label>
              <textarea
                id="bio"
                name="value"
                rows={6}
                defaultValue={contentByKey.bio ?? ""}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
              <button
                type="submit"
                className="cursor-pointer text-sm underline underline-offset-2"
              >
                Save bio
              </button>
            </form>

            <form action={updateSiteContentAction} className="space-y-2">
              <input type="hidden" name="key" value="contact_info" />
              <label
                htmlFor="contact-info"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Contact info
              </label>
              <textarea
                id="contact-info"
                name="value"
                rows={6}
                defaultValue={contentByKey.contact_info ?? ""}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
              <button
                type="submit"
                className="cursor-pointer text-sm underline underline-offset-2"
              >
                Save contact info
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Add artist</h2>
          <form action={createArtistAction} className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="artist-name"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Name
              </label>
              <input
                id="artist-name"
                name="name"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label
                htmlFor="artist-url"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                URL
              </label>
              <input
                id="artist-url"
                name="url"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label
                htmlFor="sort-order"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Sort order
              </label>
              <input
                id="sort-order"
                name="sort_order"
                type="number"
                defaultValue={0}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <button
              type="submit"
              className="cursor-pointer text-left text-sm underline underline-offset-2 md:col-span-3"
            >
              Add artist
            </button>
          </form>

          <ul className="mt-6 space-y-2">
            {(artists ?? []).map((artist) => (
              <li
                key={artist.id}
                className="flex items-center justify-between gap-3 border-b border-zinc-200 py-2 text-sm dark:border-zinc-800"
              >
                <span className="min-w-0 flex-1 truncate">
                  {artist.name}
                  {artist.url ? ` - ${artist.url}` : ""}
                </span>
                <form action={deleteArtistAction}>
                  <input type="hidden" name="id" value={artist.id} />
                  <button
                    type="submit"
                    className="cursor-pointer underline underline-offset-2"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
            {(artists ?? []).length === 0 ? (
              <li className="text-sm text-zinc-500 dark:text-zinc-400">
                No artists yet.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Add event</h2>
          <form action={createEventAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor="event-date"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Date
              </label>
              <input
                id="event-date"
                name="date"
                type="date"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label
                htmlFor="event-venue"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Venue
              </label>
              <input
                id="event-venue"
                name="venue"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label
                htmlFor="event-artist"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Artist
              </label>
              <input
                id="event-artist"
                name="artist"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label
                htmlFor="event-city"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                City
              </label>
              <input
                id="event-city"
                name="city"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label
                htmlFor="event-ticket-url"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Ticket URL
              </label>
              <input
                id="event-ticket-url"
                name="ticket_url"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <div>
              <label
                htmlFor="event-notes"
                className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                Notes
              </label>
              <input
                id="event-notes"
                name="notes"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
            <button
              type="submit"
              className="cursor-pointer text-left text-sm underline underline-offset-2 md:col-span-2"
            >
              Add event
            </button>
          </form>

          <ul className="mt-6 space-y-2">
            {(events ?? []).map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 border-b border-zinc-200 py-2 text-sm dark:border-zinc-800"
              >
                <span className="min-w-0 flex-1 truncate">
                  {[event.date, event.artist, event.venue, event.city]
                    .filter(Boolean)
                    .join(" - ") || "Untitled event"}
                </span>
                <form action={deleteEventAction}>
                  <input type="hidden" name="id" value={event.id} />
                  <button
                    type="submit"
                    className="cursor-pointer underline underline-offset-2"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
            {(events ?? []).length === 0 ? (
              <li className="text-sm text-zinc-500 dark:text-zinc-400">
                No events yet.
              </li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}
