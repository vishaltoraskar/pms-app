import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the local Postgres used when there is no DATABASE_URL) ships WebAssembly, so let Node load it directly.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
