import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const FUNCTIONS_DIR = path.join('src', 'functions');
const OUT_DIR = 'dist';

function findEntryPoints(dir: string): string[] {
  const entries: string[] = [];

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      entries.push(...findEntryPoints(fullPath));
    } else if (item.name.endsWith('.ts') && !item.name.endsWith('.test.ts')) {
      entries.push(fullPath);
    }
  }

  return entries;
}

async function build() {
  const entryPoints = findEntryPoints(FUNCTIONS_DIR);

  if (entryPoints.length === 0) {
    console.log('No Lambda entry points found in', FUNCTIONS_DIR);
    return;
  }

  console.log(`Building ${entryPoints.length} Lambda function(s)...`);

  // Clean dist directory
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }

  // Build each function into its own subdirectory so archive_file can zip it.
  // e.g. src/functions/players/getPlayers.ts -> dist/players/getPlayers/getPlayers.js
  for (const ep of entryPoints) {
    const rel = path.relative(FUNCTIONS_DIR, ep);
    const parsed = path.parse(rel);
    const group = path.dirname(rel);        // e.g. "players" or "data-sync"
    const funcName = parsed.name;            // e.g. "getPlayers"
    const outdir = path.join(OUT_DIR, group, funcName);

    console.log(`  ${rel} → ${outdir}/`);

    await esbuild.build({
      entryPoints: [ep],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outdir,
      format: 'cjs',
      sourcemap: true,
      minify: false,
      external: ['pg-native'],
    });
  }

  console.log(`\nBuild complete → ${OUT_DIR}/`);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
