import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Set explicit workspace root to silence parent directory lockfile warnings
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
