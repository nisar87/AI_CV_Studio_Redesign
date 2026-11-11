import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // Serverless Chromium ships a compressed binary that must stay on disk, not be bundled.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/health': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // CV preview documents run in a sandboxed (opaque-origin) iframe and load fonts cross-origin.
      { source: '/fonts/:path*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
    ];
  },
};

export default nextConfig;
