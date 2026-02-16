import nextConfig from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/", ".next/", "drizzle/"],
  },
];

export default eslintConfig;
