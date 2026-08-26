/**
 * Clinic Management System
 * Created by: Sudais Alam
 * GitHub: https://github.com/sudaisalamboy
 * License: MIT
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint configuration.
 *
 * Intentionally does NOT disable any rules — `next/core-web-vitals` +
 * `next/typescript` provide a sensible recommended baseline and CI must be
 * able to actually catch problems. If a rule is too noisy, narrow it for the
 * specific case rather than silencing it globally.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "playwright-report/**",
      "tests/.results/**",
      "examples/**",
      // Platform tooling that lives on disk but is not part of this project.
      "skills/**",
    ],
  },
];

export default eslintConfig;
