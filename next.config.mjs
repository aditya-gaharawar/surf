/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "code.webspaceai.in",
        pathname: "/lovable-uploads/**",
      },
    ],
  },
};

export default nextConfig;
