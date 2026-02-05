import { defineConfig } from "vitest/config";
export default defineConfig({
    define: {
        SKIP_EXPENSIVE_TESTS: JSON.stringify(process.env.CI || process.env.SKIP_EXPENSIVE_TESTS),
    },
    test: {
        coverage: {
            exclude: ["**/__test__/**", "./coverage/**", "**/dist/**", "./eslint.config.mts"]
        },
        pool: "vmThreads",
    }
})