import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { APP_SECRET } from '$env/static/private';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const YTDLP_URL =
	'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token || token !== APP_SECRET) throw error(401, 'Unauthorized');

	const dest = join(process.env.HOME ?? '/tmp', 'yt-dlp');

	try {
		await execFileAsync('curl', ['-L', YTDLP_URL, '-o', dest]);
		await execFileAsync('chmod', ['a+rx', dest]);
		const { stdout } = await execFileAsync(dest, ['--version']);
		return json({ ok: true, version: stdout.trim(), dest });
	} catch (e) {
		const err = e as { message?: string; stderr?: string };
		const detail = err.stderr?.trim() || err.message || String(e);
		throw error(500, `Update failed: ${detail}`);
	}
};
