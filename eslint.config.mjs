import js from "@eslint/js";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "node_modules/**",
            "build/**",
            "dashboard/**",
            "public/**",
            "docs/**",
            "test-results/**",
        ],
        linterOptions: {
            reportUnusedDisableDirectives: false,
        },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ["**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2024,
                Bun: "readonly",
            },
        },
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-require-imports": "off",
            "no-empty": "off",
            "no-control-regex": "off",
            "no-useless-escape": "off",
            "prefer-const": "off",
            "preserve-caught-error": "off",
        },
    }
);
