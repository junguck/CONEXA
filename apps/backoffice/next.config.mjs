/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le paquet @conexa/ui est publié en TypeScript source dans le monorepo.
  transpilePackages: ['@conexa/ui'],
  poweredByHeader: false,
};

export default nextConfig;
