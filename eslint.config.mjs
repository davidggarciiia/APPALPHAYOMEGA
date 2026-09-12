import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.expo/**", "**/coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Los ficheros de configuracion y los scripts sueltos corren en Node, fuera
    // del codigo de la aplicacion. En los .ts esto no hace falta porque
    // typescript-eslint desactiva no-undef y deja el trabajo al compilador, pero
    // en JavaScript plano si.
    files: ["**/*.mjs", "**/*.js", "**/*.cjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        module: "writable",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "writable",
      },
    },
    rules: {
      // Estos ficheros los carga Node como CommonJS, no la aplicacion.
      "@typescript-eslint/no-require-imports": "off",
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
