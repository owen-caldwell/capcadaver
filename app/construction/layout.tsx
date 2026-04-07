import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CAPTAN CADAVER — Coming soon",
  description: "This site is temporarily unavailable while we work on something new.",
};

export default function ConstructionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
