/** @type {import('next').NextConfig} */
const nextConfig = {
  if(dev) { config.optimization.splitChunks = { cacheGroups: { framework: { chunks: 'all', test: /[\\/]node_modules[\\/]/, name: 'framework', enforce: true, }, }, }; }
};


export default nextConfig;
