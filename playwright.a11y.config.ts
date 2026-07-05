import baseConfig from "./playwright.config";

const config = {
  ...baseConfig,
  testDir: "./tests/a11y",
};

export default config;
