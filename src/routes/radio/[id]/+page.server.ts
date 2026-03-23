import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { radios, radioTracks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const [radio] = await db
		.select()
		.from(radios)
		.where(eq(radios.id, Number(params.id)))
		.limit(1);

	if (!radio) throw error(404, 'Radio not found');

	const tracks = await db
		.select()
		.from(radioTracks)
		.where(eq(radioTracks.radioId, radio.id))
		.orderBy(radioTracks.position);

	return { radio, tracks };
};
