import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.expo/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Los ficheros de script sueltos corren en Node. En los .ts esto no hace
    // falta porque typescript-eslint ya desactiva no-undef y deja el trabajo al
    // compilador, pero en JavaScript plano si.
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    rules: {
      // SPEC.md: any esta prohibido. Si no conoces el tipo es unknown.
      "@typescript-eslint/no-explicit-any": "error",
      // SPEC.md: tipo de retorno explicito en todo lo exportado.
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
    },
  },
)
