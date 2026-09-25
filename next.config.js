/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
    Security audit F-03. This carried `remotePatterns: [{ hostname: '**' }]`,
    which turned /_next/image into an open proxy: it would fetch and process an
    attacker-supplied URL from any host on the internet, on the server that
    holds MAVAPAY_API_KEY, ANTHROPIC_API_KEY and OPENAI_API_KEY. That is the
    reachability condition for the image-optimiser RCEs.

    There is no allowlist here because there is nothing to allow — the app does
    not use next/image at all. Every image is a plain <img>, fetched by the
    browser directly, so nothing is proxied through our server. With no
    remotePatterns configured the optimiser refuses every remote URL.
  */
  webpack: (config, { isServer }) => {
    config.externals.push('pino-pretty', 'encoding');
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    if (!isServer) {
      config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm';
    }
    return config;
  },
};
module.exports = nextConfig;
