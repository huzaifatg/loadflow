import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/schedule',
        destination: '/dispatch/calendar',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
