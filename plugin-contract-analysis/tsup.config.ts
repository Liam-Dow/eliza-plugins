import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    dts: true, // You need this for TypeScript declarations
    external: [
        "@ai16z/eliza",
        "better-sqlite3"
    ],
});
