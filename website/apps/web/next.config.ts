import { withContentCollections } from "@content-collections/next";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/docs",
        destination: "/docs/introduction",
        permanent: true,
      },
      {
        source: "/gh",
        destination: "https://github.com/KartikLabhshetwar/lazycommit",
        permanent: true,
      },
      {
        source: "/npm",
        destination: "https://www.npmjs.com/package/lazycommitt",
        permanent: true,
      },
    ];
  },
};

export default withContentCollections(nextConfig);
