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
	if (found.length > 0) {
		try {
			const { stdout } = await run(found[0], ['--version']);
			version = stdout.trim();
		} catch (e) {
			versionError = String(e);
		}
	}

	return json({
		platform: process.platform,
		cwd: process.cwd(),
		candidates,
		found,
		version,
		versionError
	});
};
