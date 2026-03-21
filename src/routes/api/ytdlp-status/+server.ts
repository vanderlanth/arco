import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const run = promisify(execFile);

export const GET: RequestHandler = async () => {
	const candidates = ['/var/task/bin/yt-dlp', join(process.cwd(), 'bin', 'yt-dlp'), '/tmp/yt-dlp'];
	const found = candidates.filter(existsSync);

	let version: string | null = null;
	let versionError: string | null = null;
	let audioUrl: string | null = null;
	let audioExt: string | null = null;
	let urlFetchStatus: number | null = null;
	let urlError: string | null = null;

	if (found.length > 0) {
		try {
			const { stdout: v } = await run(found[0], ['--version']);
			version = v.trim();
		} catch (e) {
			versionError = String(e);
		}

		// Test getting an actual audio URL
		try {
			const { stdout } = await run(found[0], [
				'--no-warnings',
				'--no-playlist',
				'-f', 'bestaudio',
				'--get-url',
				'--print', '%(ext)s',
				'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
			]);
			const lines = stdout.trim().split('\n');
			audioExt = lines[0]?.trim() ?? null;
			audioUrl = lines[1]?.trim() ?? null;

			if (audioUrl) {
				const resp = await fetch(audioUrl, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
				urlFetchStatus = resp.status;
			}
		} catch (e) {
			urlError = String(e);
		}
	}

	return json({
		platform: process.platform,
		cwd: process.cwd(),
		found,
		version,
		versionError,
		audioExt,
		audioUrl: audioUrl ? audioUrl.slice(0, 80) + '...' : null,
		urlFetchStatus,
		urlError
	});
};
