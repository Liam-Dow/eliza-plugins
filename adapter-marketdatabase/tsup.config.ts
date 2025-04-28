import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    dts: true,  // This line tells tsup to generate .d.ts files
    external: [
        "@ai16z/eliza",
        "better-sqlite3",
        "zod",
        "fs",
        "fs/promises",
        "path"
    ]
});