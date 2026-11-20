import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Every path resolves from this script's own directory, never from the
// working directory: the grader runs `node /bot/main.ts` from an
// unrelated cwd, so cwd-relative paths would point at nothing.
const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, 'app');
const shotsDir = join(here, 'screenshots');
const outputDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : join(here, 'dist');

// The grader runs this as an unprivileged user on a read-only filesystem
// where /output is a volume mountpoint: removing the output directory
// itself fails with EPERM. Clear only its CONTENTS, never the directory.
function clearOutputContents(dir) {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

// Dotfiles and dot-directories are never copied into /output: the kit
// rejects them and a stray .gitkeep once failed a whole entry.
function isDotPath(src) {
  const base = src.split('/').pop();
  return base !== undefined && base.startsWith('.');
}

function handIn() {
  clearOutputContents(outputDir);
  cpSync(appDir, join(outputDir, 'app'), {
    recursive: true,
    filter: (src) => !isDotPath(src),
  });
  cpSync(shotsDir, join(outputDir, 'screenshots'), {
    recursive: true,
    filter: (src) => !isDotPath(src),
  });
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
