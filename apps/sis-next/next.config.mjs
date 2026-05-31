/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.APP_ENV ?? "production"
  }
};

export default nextConfig;
