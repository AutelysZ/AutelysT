/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      // Stub out Node.js modules for 7z-wasm in browser
      module: "./lib/stubs/empty-module.js",
    },
  },
  webpack: (config, { isServer }) => {
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    if (!isServer) {
      // 7z-wasm has optional Node.js dependencies that aren't needed in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        path: false,
      }
    }
    return config
  },
}

export default nextConfig
