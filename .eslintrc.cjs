module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script",
  },
  ignorePatterns: [
    "dist/**",
    "data/**",
    "public/**",
    "tools/node/**",
    "node_modules/**",
  ],
  rules: {
    "no-console": "off",
    "no-empty": ["error", { "allowEmptyCatch": true }],
  },
};
