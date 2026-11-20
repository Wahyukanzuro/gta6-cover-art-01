// Vice State Cover Studio — graded entrypoint (Node 22, standard library only).
// Hands the app in: copies app/ and screenshots/ from beside this file into
// the output directory and writes /output/dossier.json with the vendored
// make.fun library, the summary the judge reads.
//
// Grader-proof hand-in: the grader runs `node /bot/main.ts` as user nobody
// on a read-only filesystem with an empty writable /output volume. Deleting
// the output directory itself fails there with EPERM, so this program only
// ever clears the directory's CONTENTS. Every path is resolved from this
// file's own directory (never the working directory), and dotfiles are
// never copied into the output.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Clear the output directory's contents only — never the directory itself.
function clearContents(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

// Copy a tree, skipping dotfiles and dot-directories at every level.
function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (entry.startsWith('.')) continue;
    const from = join(src, entry);
    const to = join(dest, entry);
    if (statSync(from).isDirectory()) {
      copyTree(from, to);
    } else {
      cpSync(from, to);
    }
  }
}

function handIn(): void {
  clearContents(outDir);
  copyTree(join(here, 'app'), join(outDir, 'app'));
  const shots = join(here, 'screenshots');
  if (existsSync(shots)) {
    copyTree(shots, join(outDir, 'screenshots'));
  }
  // The scorer's own caps (reference/gate.json): only text_max_bytes shapes
  // the bytes; the others refuse an entry the scorer would refuse (more than
  // 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB
  // of app files, in all, or a path under app/ over 1000 bytes).
  writeFileSync(
    join(outDir, 'dossier.json'),
    buildDossier(outDir, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      app_max_files: 993,
      app_max_bytes: 50331648,
      app_path_max_bytes: 1000,
    }),
  );
}

handIn();
