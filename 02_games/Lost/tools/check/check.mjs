/**
 * Project check, run by `npm run check`: syntax of every script, unit tests, production build (written to a
 * temporary folder, `dist/` is left alone), scripted playthrough. Stops at the first failing step.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SYNTAX_DIRS = ['src', 'tools', 'tests'];
const SKIPPED_DIRS = new Set(['vendor', '.audio-env', '__pycache__']);
const NO_BROWSER = 2; // exit code of playthrough.mjs

function scripts(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : scripts(full, extension);
    return extension.test(entry.name) ? [full] : [];
  });
}

function run(command, args) {
  return spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' }).status;
}

function step(title, action) {
  console.log(`\n== ${title}`);
  const status = action();
  if (status !== 0) {
    console.error(`\nFAILED: ${title}`);
    process.exit(1);
  }
}

function checkSyntax() {
  const all = SYNTAX_DIRS.map((d) => path.join(ROOT, d)).filter((d) => fs.existsSync(d));
  const js = all.flatMap((d) => scripts(d, /\.m?js$/));
  for (const file of js) {
    const status = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }).status;
    if (status !== 0) return status;
  }
  const py = all.flatMap((d) => scripts(d, /\.py$/));
  const code = 'import sys\nfor f in sys.argv[1:]:\n    compile(open(f, encoding="utf-8").read(), f, "exec")\n';
  const status = spawnSync('python3', ['-B', '-c', code, ...py], { stdio: 'inherit' }).status;
  if (status === 0) console.log(`  ${js.length} JavaScript and ${py.length} Python files parse`);
  return status;
}

function build() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lost-build-'));
  const status = run(path.join('node_modules', '.bin', 'vite'), ['build', '--outDir', out, '--emptyOutDir', '--logLevel', 'warn']);
  fs.rmSync(out, { recursive: true, force: true });
  return status;
}

step('Syntax', checkSyntax);
step('Unit tests', () => run(path.join('node_modules', '.bin', 'vitest'), ['run', '--dir', 'tests']));
step('Production build', build);

console.log('\n== Scripted playthrough');
const playthrough = run(process.execPath, [path.join('tools', 'check', 'playthrough.mjs')]);
if (playthrough === NO_BROWSER) {
  console.log('\nSyntax, tests and build passed. Playthrough SKIPPED: no browser.');
  process.exit(0);
}
if (playthrough !== 0) {
  console.error('\nFAILED: Scripted playthrough');
  process.exit(1);
}
console.log('\nAll checks passed.');
