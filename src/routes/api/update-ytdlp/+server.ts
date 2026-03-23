import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { APP_SECRET } from '$env/static/private';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const YTDLP_URL =
	'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token || token !== APP_SECRET) throw error(401, 'Unauthorized');

	const dest = join(process.env.HOME ?? '/tmp', 'yt-dlp');

	// Download
	const resp = await fetch(YTDLP_URL);
	if (!resp.ok || !resp.body) throw error(502, `Download failed: ${resp.status}`);

	await pipeline(resp.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
	await chmod(dest, 0o755);

	// Get new version
	const { stdout } = await execFileAsync(dest, ['--version']);
	const version = stdout.trim();

	return json({ ok: true, version, dest });
};
