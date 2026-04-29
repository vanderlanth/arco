import { error } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import type { RequestHandler } from './$types';
import { getBinary, getAudioUrl, searchYouTube } from '$lib/server/youtube';
import { db } from '$lib/server/db';
import { tracks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Pipes yt-dlp audio output directly to the response, avoiding Node.js outbound
// fetch (which is blocked on shared hosting). Used by the client-side preloader
// to download blobs for background/lock-screen playback.
export const GET: RequestHandler = async ({ url, request }) => {
	const videoIdParam = url.searchParams.get('videoId');
	const trackId = url.searchParams.get('id');
	const searchQuery = url.searchParams.get('q');

	let videoId = videoIdParam;

	if (!videoId && searchQuery) {
		const results = await searchYouTube(searchQuery, 1);
		if (results.length === 0) throw error(404, 'No YouTube match found');
		videoId = results[0].videoId;
	}

	if (!videoId && trackId) {
		const track = await db.query.tracks.findFirst({
			where: eq(tracks.id, Number(trackId))
		});
		if (!track) throw error(404, 'Track not found');

		videoId = track.youtubeId;

		if (!videoId) {
			const query = `${track.artist} - ${track.title}`;
			const results = await searchYouTube(query, 1);
			if (results.length === 0) throw error(404, 'No YouTube match found');
			videoId = results[0].videoId;
			await db.update(tracks).set({ youtubeId: videoId }).where(eq(tracks.id, track.id));
		}
	}

	if (!videoId) throw error(400, 'Missing videoId or id');

	// Get mimeType from cached URL info (fast, doesn't re-invoke yt-dlp if cached)
	let mimeType = 'audio/webm';
	try {
		const audio = await getAudioUrl(videoId);
		mimeType = audio.mimeType;
	} catch {
		// ignore — proceed with default mimeType, pipe will still work
	}

	const binary = getBinary();

	// Check if client aborted before spawning
	if (request.signal.aborted) throw error(499, 'Cancelled');

	const child = spawn(binary, [
		'--no-warnings',
		'--no-playlist',
		'-f', 'bestaudio/best',
		'-o', '-',
		'--extractor-args', 'youtube:player_client=android,tv_embedded',
		`https://www.youtube.com/watch?v=${videoId}`
	]);

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			child.stdout.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
			child.stdout.on('end', () => controller.close());
			child.on('error', (err) => controller.error(err));
			child.on('close', (code) => {
				if (code !== 0 && code !== null) {
					controller.error(new Error(`yt-dlp exited with code ${code}`));
				}
			});
		},
		cancel() {
			child.kill('SIGTERM');
		}
	});

	// Kill yt-dlp if the client disconnects
	request.signal.addEventListener('abort', () => child.kill('SIGTERM'), { once: true });

	return new Response(stream, {
		headers: {
			'Content-Type': mimeType,
			'Cache-Control': 'no-store'
		}
	});
};
