import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';

const APP_SECRET = process.env.APP_SECRET!;
const TOTP_SECRET = process.env.TOTP_SECRET;
import { createHmac } from 'node:crypto';
import speakeasy from 'speakeasy';
import { makeSessionSig, sessionCookieOptions } from '../../../hooks.server';
import { verifyCsrf } from '$lib/csrf';

const PENDING_VALUE = 'pending_2fa';

function hasPendingCookie(cookie: string | undefined): boolean {
	if (!cookie) return false;
	const expected = createHmac('sha256', APP_SECRET).update(PENDING_VALUE).digest('hex');
	return cookie === expected;
}

export const load: PageServerLoad = async ({ cookies }) => {
	if (!hasPendingCookie(cookies.get('pending_2fa'))) {
		throw redirect(303, '/login');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();

		if (!verifyCsrf(data.get('csrf_token'), cookies.get('csrf'))) {
			return fail(403, { error: 'Invalid request.' });
		}

		if (!hasPendingCookie(cookies.get('pending_2fa'))) {
			throw redirect(303, '/login');
		}
		if (!TOTP_SECRET) {
			throw redirect(303, '/login');
		}

		const code = String(data.get('code') ?? '').replace(/\D/g, '');

		const isValid = speakeasy.totp.verify({
			secret: TOTP_SECRET,
			encoding: 'base32',
			token: code,
			window: 1
		});

		if (!isValid) {
			return fail(401, { error: 'Invalid code. Please try again.' });
		}

		cookies.delete('pending_2fa', { path: '/' });
		cookies.set('session', makeSessionSig(APP_SECRET), sessionCookieOptions(dev));

		throw redirect(303, '/');
	}
};
