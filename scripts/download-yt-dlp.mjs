#!/usr/bin/env node
/**
 * Downloads the yt-dlp Linux x64 static binary for use in Vercel serverless functions.
 * Run automatically as part of the Vercel build via the "vercel-build" npm script.
 */
import { createWriteStream, mkdirSync, chmodSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';

const OUTPUT_DIR = join(process.cwd(), 'bin');
const OUTPUT_PATH = join(OUTPUT_DIR, 'yt-dlp');
const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('Downloading yt-dlp Linux x64 binary...');
const resp = await fetch(DOWNLOAD_URL, { redirect: 'follow' });
if (!resp.ok) throw new Error(`Failed to download yt-dlp: HTTP ${resp.status}`);

await pipeline(resp.body, createWriteStream(OUTPUT_PATH));
chmodSync(OUTPUT_PATH, 0o755);
console.log(`yt-dlp downloaded to ${OUTPUT_PATH}`);
