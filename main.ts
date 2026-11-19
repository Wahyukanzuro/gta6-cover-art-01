// main.ts — Vice State Cover Studio entrypoint (Node 22, stdlib only).
// Hands the app in: copies app/ and screenshots/ from this repository
// into the output directory and writes dossier.json with buildDossier
// from vendor/makefun-app.ts, exactly as the gate rebuilds it.
// Deterministic: the same repository writes the same bytes every run.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { buildDossier } from './vendor/makefun-app.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root: the directory holding this file. */
const repoRoot = dirname(fileURLToPath(import.meta.url));

/** The output directory: the grader's /output, or MAKEFUN_OUTPUT_DIR. */
const outputDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

/** Copy a directory tree from the repo into the output, whole. */
function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  if (!existsSync(from)) throw new Error(`main.ts: ${name}/ is missing from the repository`);
  cpSync(from, to, { recursive: true });
}

/** The gate's caps for this bounty, passed to buildDossier whole: the
 *  dossier text cap, the screenshot caps and the app tree caps. */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
} as const;

/** Build the entry: a clean output, app/ + screenshots/ copied in,
 *  dossier.json written from them. */
function handIn(): void {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  copyTree('app');
  copyTree('screenshots');
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
