/** @type {import('next').NextConfig} */
const basePath = '/role-assigner';

const nextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: basePath,
        permanent: false,
        basePath: false,
      },
    ];
  },
};

module.exports = nextConfig;
