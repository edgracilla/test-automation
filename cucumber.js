// Cucumber profiles. Pick one with `--profile <name>`; extra CLI flags (e.g. --tags) are added on top.
const common = {
  import: ['src/**/*.js'],
  format: [
    'progress-bar',
    'html:reports/cucumber-report.html',
    'junit:reports/junit.xml',
  ],
  formatOptions: { snippetInterface: 'async-await' },
};

// Your own suites. Cucumber reads features/**/*.feature by default; paths given on the
// command line (`pnpm test features/users`) replace that default.
export default {
  ...common,
};

// The bundled examples, run against examples/mock-server.js by `pnpm test:example`.
export const example = {
  ...common,
  paths: ['examples/features/**/*.feature'],
};
