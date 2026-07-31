import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  // Do not set output:'standalone' for Vercel — it can break App Router API routes.
  transpilePackages: ['motion'],
  // Keep firebase-admin (and its transitive jose/jwks-rsa deps) out of the
  // webpack bundle. Bundling them mangles jose's ESM-only build and causes
  // "ERR_REQUIRE_ESM" at runtime on Vercel. Native node_modules resolution
  // handles the ESM/CJS interop correctly.
  serverExternalPackages: ['firebase-admin', 'google-auth-library', 'jwks-rsa', 'jose', 'gcp-metadata'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
