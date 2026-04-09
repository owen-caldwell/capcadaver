import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => [
    {
      source: "/:path*",
      destination:
        "https://www.eventbrite.com/e/captain-cadaver-the-empty-bottle-o-rum-tickets-1986387372102?aff=oddtdtcreator",
      permanent: false,
    },
  ],
};

export default nextConfig;
