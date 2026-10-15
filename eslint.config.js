// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions roda no Deno (Edge Functions), fora do app
    ignores: ["dist/*", "supabase/functions/*"],
  }
]);
