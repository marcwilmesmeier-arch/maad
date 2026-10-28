// ESLint prüft das zusammengesetzte Skript (dist/bundle.js), weil alle Quelldateien
// einen gemeinsamen globalen Gültigkeitsbereich teilen. tools/lint.mjs ordnet die
// Meldungen anschließend wieder den Dateien unter src/js zu.
import globals from 'globals';

export default [
  {
    files: ['dist/bundle.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        THREE: 'readonly', // three.js (CDN)
        maplibregl: 'readonly', // MapLibre GL (CDN)
        pdfjsLib: 'readonly', // pdf.js (bei Bedarf nachgeladen)
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      // Fehler: brechen das Verhalten oder verdecken Fehler
      'no-undef': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-self-assign': 'error',
      'no-dupe-else-if': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      // Hinweise: beim Bearbeiten einer Datei mit aufräumen
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
      'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
  },
];
