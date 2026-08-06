import { defineConfig } from "vitest/config";
import { resolve } from "path";

/* Node environment on purpose: these tests cover service logic, error mapping
   and identity keys — none of it touches the DOM, and none of it touches the
   database. Anything needing a real Postgres belongs in a separate suite with
   its own throwaway database, never the one in .env. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "trailer/**", ".claude/**", ".agents/**"],
  },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
