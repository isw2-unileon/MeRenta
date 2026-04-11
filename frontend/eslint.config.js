import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // -----------------------
  // Ignore
  // -----------------------
  {
    ignores: ["dist", "node_modules", "coverage", "*.config.*", "**/*.d.ts"],
  },

  // -----------------------
  // Base config
  // -----------------------
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],

    files: ["**/*.{ts,tsx}"],

    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      // -----------------------
      // React
      // -----------------------
      ...reactHooks.configs.recommended.rules,

      "react/react-in-jsx-scope": "off",

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // -----------------------
      // TypeScript
      // -----------------------
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-floating-promises": "error",

      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],

      "@typescript-eslint/await-thenable": "error",

      "@typescript-eslint/no-unnecessary-condition": "warn",

      "@typescript-eslint/prefer-nullish-coalescing": "error",

      "@typescript-eslint/prefer-optional-chain": "warn",

      "@typescript-eslint/no-non-null-assertion": "warn",

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],

      // -----------------------
      // JavaScript base
      // -----------------------
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",

      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-alert": "error",

      "no-duplicate-imports": "error",

      // -----------------------
      // Style
      // -----------------------
      curly: ["error", "multi-line"],
    },
  }
);
