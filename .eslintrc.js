module.exports = {
  root: true,
  env: {
    browser: true,
    node: true
  },
  parserOptions: {
    parser: 'babel-eslint'
  },
  extends: [
    '@nuxtjs',
    'prettier',
    'prettier/vue',
    'plugin:prettier/recommended',
    'plugin:nuxt/recommended'
  ],
  plugins: ['prettier'],
  // add your custom rules here
  rules: {
    'spaced-comment': 'warn',
    'prettier/prettier': 'warn',
    'no-unused-vars': 'warn',
    'object-shorthand': 'off',
    'no-useless-return': 'warn',
    'vue/no-v-html': 'off',
    "no-unreachable": "warn",
  },
  overrides: [
    {
      files: ['*/*gridui/web/js/**'],
      rules: {
        strict: 'off'
      }
    }
  ]
}
