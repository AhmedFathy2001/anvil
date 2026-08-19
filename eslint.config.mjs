import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import clanScope from "./eslint-rules/clan-scope.mjs";
import noViewWrites from "./eslint-rules/no-view-writes.mjs";
import clanPrefix from "./eslint-rules/clan-prefix.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Multi-clan safety: a query that forgets clan_id returns another clan's rows and nothing
    // errors. Enforced here rather than by review because we already shipped one of these — see
    // the rule's own header. Tests and scripts are exempt: they seed fixtures across clans on
    // purpose, and the harness creates the clans it queries.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: {
      "clan-scope": {
        rules: {
          "require-clan-filter": clanScope,
          "no-view-writes": noViewWrites,
          "clan-prefix": clanPrefix,
        },
      },
    },
    rules: {
      "clan-scope/require-clan-filter": "warn",
      // An error, not a warning: unlike a missing clan filter this has no gradient of correctness —
      // the statement simply never runs, and one of the four we shipped failed silently inside a
      // try/catch. There are zero violations left, so it can be held at zero.
      "clan-scope/no-view-writes": "error",
      // Warn while the codemod runs. Goes to error once the count is zero — a missed prefix on a
      // fetch is silent (the route answers with no clan), which is exactly what a build gate is for.
      "clan-scope/clan-prefix": "warn",
    },
  },
  {
    // React-compiler diagnostics (react-hooks v6): ~13 pre-existing hits, each needing a
    // per-component refactor (setState-in-effect restructuring, purity fixes). Kept visible as
    // warnings so new code sees them, but not errors — lint is a required PR check and these
    // shouldn't block unrelated changes. Fix a component, and its warnings disappear.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
]);

export default eslintConfig;
