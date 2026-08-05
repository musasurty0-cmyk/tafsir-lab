import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint, restored.
 *
 * `npm run lint` was `next lint`, which Next 16 removed — it parsed "lint" as a
 * directory name and errored out, so nothing had been linted for some time and
 * no ESLint was even installed. That matters beyond tidiness: the rule that
 * catches stale closures and missing effect cleanup (react-hooks/exhaustive-deps)
 * is the one that would have flagged the fetch races fixed alongside this.
 *
 * The rules below are deliberately a floor, not a style guide — every one of
 * them catches a class of real bug rather than a preference, so a clean run
 * means something.
 */
const config = [
  {
    ignores: [
      ".next/**", "node_modules/**", "out/**", "public/**",
      // Its own toolchain, its own tsconfig — linted separately if at all.
      "trailer/**", "remotion/**",
      // Vendored skill fixtures: deliberately broken sample code.
      ".claude/**", ".agents/**",
      "scripts/**", "prisma/**",
      /* Design reference, not shipped code. Neither is imported anywhere and
         Next never builds them (app/ exists at the root, so src/ is not a
         route source). Between them they accounted for 284 of the 469 findings
         on the first run — all of it noise about code that cannot run. */
      "src/**", "design_extracted/**",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      /* Real-bug rules, kept at error. */
      "react-hooks/rules-of-hooks": "error",
      "no-constant-binary-expression": "error",
      "no-self-compare": "error",
      "no-unmodified-loop-condition": "error",
      "no-unreachable-loop": "error",
      "require-atomic-updates": "error",

      /* Warn: worth seeing, too noisy to block on in a codebase this size. */
      "react-hooks/exhaustive-deps": "warn",

      /* The React Compiler family, shipped at ERROR by eslint-config-next 16.
         This project does not enable the compiler, so these describe code that
         is not compiler-*optimisable* rather than code that is wrong — 145 of
         the first run's 185 findings, every one of them on working code. Left
         on as warnings so the signal survives if the compiler is ever turned
         on, but they must not be what makes `npm run lint` fail. */
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",

      /* Off: these fire constantly on correct code here and drown the signal. */
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",
      }],
      /* The editor and canvas layers legitimately use <img> for rasterised
         page images whose dimensions are only known at runtime. */
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
