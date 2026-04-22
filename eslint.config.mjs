import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  // Next.js recommended + TypeScript rules
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // VERY IMPORTANT: tell ESLint which files to lint
  {
    files: ["src/**/*.{js,jsx,ts,tsx}", "app/**/*.{js,jsx,ts,tsx}"],
  },

  // VERY IMPORTANT: ignore all heavy folders
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "node_modules/**",
    "public/**",
    "seeders/**",
    "migrations/**",
    "prisma/**",
  ]),
    {
    files: [
      "jest.config.js",
      "jest.config.cjs",
      "next.config.js",
      "next.config.mjs",
      "tailwind.config.js",
      "postcss.config.js",
      "*.config.js",
      "*.config.cjs",
    ],
    languageOptions: {
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/no-commonjs": "off",
    },
  },

]);
