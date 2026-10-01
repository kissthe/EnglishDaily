import type {NextConfig} from "next";
const config:NextConfig={distDir:process.env.NEXT_BUILD_DIR||'.next',output:"standalone",serverExternalPackages:["node:sqlite"],experimental:{cpus:2}};
export default config;
