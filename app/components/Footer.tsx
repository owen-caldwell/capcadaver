"use client";

import { useEffect, useState } from "react";

const BROOKLYN_TZ = "America/New_York";

function formatDateTime(date: Date) {
  const dateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: BROOKLYN_TZ,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: BROOKLYN_TZ,
    timeStyle: "short",
  }).format(date);
  return `${dateStr} ${timeStr}`;
}

export default function Footer() {
  const [dateTime, setDateTime] = useState<string>("");

  useEffect(() => {
    const update = () => setDateTime(formatDateTime(new Date()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        {dateTime} — Brooklyn, NY
      </p>
    </footer>
  );
}
