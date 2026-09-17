#!/usr/bin/env node
// Root also depends on the plain `playwright` package (for the raw-driver scripts in
// this folder), and it registers the same `playwright` bin name as `@playwright/test`.
// pnpm's node_modules/.bin/playwright can end up pointing at the wrong one of the two,
// which makes the test runner load two different @playwright/test instances and fail
// with "did not expect test.use() to be called here". Resolving the CLI explicitly
// sidesteps that ambiguity entirely.
const { execFileSync } = require('child_process');
const { join, dirname } = require('path');

const pkgJsonPath = require.resolve('@playwright/test/package.json');
const cli = join(dirname(pkgJsonPath), require('@playwright/test/package.json').bin.playwright);
execFileSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit' });
