import Link from "next/link";
import ModelViewer from "./components/ModelViewer";
import { getPublicData } from "@/lib/cms";

function normalizedUrl(url: string | null) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default async function Home() {
  const { artists, events, siteContent } = await getPublicData();
  const today = new Date().toISOString().slice(0, 10);

  const upcomingEvents = events
    .filter((event) => (event.date ?? "9999-12-31") >= today)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const pastEvents = events
    .filter((event) => (event.date ?? "") < today)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const contentByKey = Object.fromEntries(
    siteContent.map((item) => [item.key, item.value ?? ""]),
  );

  return (
    <div className="mx-auto max-w-[1000px] flex min-h-screen flex-col p-2 font-sans dark:bg-zinc-950">
      <main className="md:flex-row flex-col w-full flex gap-8 border-b border-zinc-800 pb-4 mb-4">
        {/* A */}
        <ModelViewer />
        <section className="w-full md:m-w-[460px]">
          {/* BIO */}
          <p className="mt-3 whitespace-pre-wrap text-sm">
            {contentByKey.bio || "Bio coming soon."}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {contentByKey.contact_info || "Contact details coming soon."}
          </p>
          <div className="mt-2 flex flex-col gap-4">
            <Link
              href="/admin"
              className="cursor-pointer text-sm underline underline-offset-2"
            >
              Admin
            </Link>
            <Link
              href="/contact"
              className="cursor-pointer text-sm underline underline-offset-2"
            >
              Contact
            </Link>
          </div>
        </section>
        <section className="w-full md:max-w-[200px]">
          <h2 className="mt-3 text-sm">
            Artists
          </h2>
          {artists.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No artists yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {artists.map((artist) => (
                <li key={artist.id} className="text-sm">
                  {artist.url ? (
                    <a
                      href={normalizedUrl(artist.url) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {artist.name}
                    </a>
                  ) : (
                    <span>{artist.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <section className="w-full">
        <div className="mt-5 space-y-8">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider">
              Upcoming events
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm">
                No upcoming events.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-2 pr-4 font-medium">
                        Date
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        Artist
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        Venue
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        City
                      </th>
                      <th className="py-2 font-medium">
                        Tickets
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="border-y border-zinc-200 py-2 hover:cursor-pointer hover:bg-zinc-900 hover:text-white dark:border-zinc-800"
                      >
                        <td className="py-2 pr-4">{event.date ?? "TBD"}</td>
                        <td className="py-2 pr-4">{event.artist ?? "TBA"}</td>
                        <td className="py-2 pr-4">{event.venue ?? "Venue TBA"}</td>
                        <td className="py-2 pr-4">{event.city ?? "City TBA"}</td>
                        <td className="py-2">
                          {event.ticket_url ? (
                            <a
                              href={normalizedUrl(event.ticket_url) ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              TICKETS
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Past events
            </h3>
            {pastEvents.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No past events.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-500 dark:text-zinc-400">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-2 pr-4 font-medium">
                        Date
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        Artist
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        Venue
                      </th>
                      <th className="py-2 font-medium">
                        City
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastEvents.map((event) => (
                      <tr key={event.id} className="border-y border-zinc-200 dark:border-zinc-800">
                        <td className="py-2 pr-4">{event.date ?? "TBD"}</td>
                        <td className="py-2 pr-4">{event.artist ?? "TBA"}</td>
                        <td className="py-2 pr-4">{event.venue ?? "Venue TBA"}</td>
                        <td className="py-2">{event.city ?? "City TBA"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
