import type { NextConfig } from "next";

// The same frontend is used by the Vercel download site and by the local Electron app.
const config: NextConfig = {
  poweredByHeader: false,
  // Separate dev caches when the Vercel preview and desktop run together.
  distDir: process.env.POKESTREAM_LOCAL === "1" && process.env.NODE_ENV !== "production"
    ? ".next-local"
    : ".next",
  output: "standalone",
  outputFileTracingExcludes: { "/*": [".env*", "public/downloads/**/*", "desktop/**/*", ".artifacts/**/*"] },
  images: {
    remotePatterns: [{protocol:"https",hostname:"raw.githubusercontent.com",pathname:"/PokeAPI/sprites/**"}],
  },
  async headers() {
    return [{source:"/:path*",headers:[
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"Referrer-Policy",value:"same-origin"},
      {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
      {key:"X-Frame-Options",value:"SAMEORIGIN"},
    ]}];
  },
};
export default config;
