import HologramPage from "./components/HologramPage";
import { getPublicData } from "@/lib/cms";

export default async function Home() {
  const { artists, events, siteContent } = await getPublicData();
  const today = new Date().toISOString().slice(0, 10);

  const sortedUpcomingCandidates = events
    .filter((event) => (event.date ?? "9999-12-31") >= today)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  // Product rule: exactly one event is treated as upcoming (the nearest one).
  const upcomingEvent = sortedUpcomingCandidates[0] ?? null;
  const pastEvents = events
    .filter((event) => event.id !== upcomingEvent?.id)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const contentByKey = Object.fromEntries(
    siteContent.map((item) => [item.key, item.value ?? ""]),
  );

  return (
    <HologramPage
      artists={artists}
      upcomingEvent={upcomingEvent}
      pastEvents={pastEvents}
      bio={contentByKey.bio || "Bio coming soon."}
      contactInfo={contentByKey.contact_info || "Contact details coming soon."}
      contentByKey={contentByKey}
    />
  );
}
