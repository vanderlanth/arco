#!/usr/bin/env node
/**
 * Copies the yt-dlp Linux binary into every Vercel function bundle.
 * Runs after vite build as part of vercel-build.
 * At Lambda runtime, process.cwd() = /var/task, so bin/yt-dlp lands at /var/task/bin/yt-dlp.
 */
import { readdirSync, copyFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BINARY_SRC = join(process.cwd(), 'bin', 'yt-dlp');
const FUNC_ROOT = join(process.cwd(), '.vercel', 'output', 'functions');

if (!existsSync(BINARY_SRC)) {
	console.error('yt-dlp binary not found at', BINARY_SRC);
	process.exit(1);
}

function findFuncDirs(dir) {
	const results = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const full = join(dir, entry.name);
		if (entry.name.endsWith('.func')) {
			results.push(full);
		} else {
			results.push(...findFuncDirs(full));
		}
	}
	return results;
}

const funcDirs = findFuncDirs(FUNC_ROOT);
console.log(`Injecting yt-dlp into ${funcDirs.length} function bundle(s)...`);

for (const funcDir of funcDirs) {
	const binDir = join(funcDir, 'bin');
	const dest = join(binDir, 'yt-dlp');
	mkdirSync(binDir, { recursive: true });
	copyFileSync(BINARY_SRC, dest);
	chmodSync(dest, 0o755);
	console.log(`  -> ${dest}`);
}

console.log('Done.');
