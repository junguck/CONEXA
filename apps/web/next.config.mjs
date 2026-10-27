import withSerwistInit from '@serwist/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le paquet @conexa/ui est publié en TypeScript source dans le monorepo.
  transpilePackages: ['@conexa/ui'],
  poweredByHeader: false,
};

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Le service worker ne s'active qu'en production : en développement il
  // masquerait le rechargement à chaud et les erreurs de compilation.
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(nextConfig);
