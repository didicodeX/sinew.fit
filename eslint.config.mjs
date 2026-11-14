import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = [
  ...coreWebVitals,
  ...nextTypescript,
  {
    ignores: ["src/generated/**/*", ".next/**/*", "node_modules/**/*", ".vercel/**/*", "public/**/*", "next-env.d.ts"],
  },
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // The domain layer must stay UI- and framework-free so a native client (watchOS) can mirror it.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-*", "next", "next/*", "@prisma/*", "@lib/*", "@shared/*", "dexie"] },
      ],
    },
  },
];

export default eslintConfig;
