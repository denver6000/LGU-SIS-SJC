/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  outputFileTracingIncludes: {
    "/*": ["./node_modules/next/**/*"]
  }
};

export default nextConfig;
