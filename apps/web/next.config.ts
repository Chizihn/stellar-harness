import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@harness/agent',
    '@harness/chain',
    '@harness/schema',
    '@harness/stellar-tools',
    '@harness/storage',
  ],
  devIndicators: false,
};

export default nextConfig;
