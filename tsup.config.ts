import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: {
    resolve: true,
    compilerOptions: {
      incremental: false,
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "next"],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
  async onSuccess() {
    mkdirSync("dist/styles", { recursive: true });
    copyFileSync("src/styles/feedback.css", "dist/styles/feedback.css");
  },
});
