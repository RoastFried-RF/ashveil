import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default tseslint.config(
  // Preserve historical diagnostic programs as records, outside maintained runtime/tool lint.
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'test-results/**', 'output/**', 'docs/diagnostics/**', 'tools/art/**/history/**', 'tools/vendor/openai-web-game/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files:['mods/**/scripts/**/*.js'],
    languageOptions:{globals:{...Object.fromEntries([...Object.keys(globals.browser),...Object.keys(globals.node)].map(k=>[k,'off'])),defineMod:'readonly'}},
    rules:{'no-restricted-globals':['error','Date','performance','fetch','setTimeout','setInterval','SharedArrayBuffer','Atomics','eval']},
  },
  {
    // 코어는 결정론 유지: Math.random·초월함수 금지
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: '코어에서는 rng 스트림만 사용' },
        { object: 'Math', property: 'sin', message: '결정론: 초월함수 금지' },
        { object: 'Math', property: 'cos', message: '결정론: 초월함수 금지' },
        { object: 'Math', property: 'exp', message: '결정론: 초월함수 금지' },
        { object: 'Math', property: 'log', message: '결정론: 초월함수 금지' },
        { object: 'Math', property: 'pow', message: '결정론: 초월함수 금지 (정수 거듭제곱은 곱셈으로)' },
        { object: 'Math', property: 'atan2', message: '결정론: 초월함수 금지' },
        { object: 'Date', property: 'now', message: '코어는 실시간에 의존하지 않음' },
      ],
    },
  },
)
