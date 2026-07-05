const commitlintConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-line-length": [0],
  },
};

export default commitlintConfig;
