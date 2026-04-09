import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const YTDLP_URL =
	'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token || token !== process.env.APP_SECRET) throw error(401, 'Unauthorized');

	const dest = join(process.env.HOME ?? '/tmp', 'yt-dlp');

	// Run update in background so the HTTP request doesn't time out on cron-job.org
	(async () => {
		try {
			await execFileAsync('curl', ['-L', YTDLP_URL, '-o', dest]);
			await execFileAsync('chmod', ['a+rx', dest]);
		} catch (e) {
			console.error('[update-ytdlp] update failed:', e);
		}
	})();

	return json({ ok: true, message: 'Update triggered in background', dest });
};
