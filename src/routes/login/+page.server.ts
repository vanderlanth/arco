import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { APP_PASSWORD, APP_SECRET, TOTP_SECRET } from '$env/static/private';
import { dev } from '$app/environment';
import { createHmac } from 'node:crypto';
import { isLocked, recordFailure, clearFailures } from '$lib/rateLimit';
import { makeSessionSig, sessionCookieOptions } from '../../hooks.server';
import { verifyCsrf } from '$lib/csrf';

const PENDING_VALUE = 'pending_2fa';

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies, getClientAddress } = event;
		const data = await request.formData();

		if (!verifyCsrf(data.get('csrf_token'), event.cookies.get('csrf'))) {
			return fail(403, { error: 'Invalid request.' });
		}

		if (data.get('website')) {
			await new Promise((r) => setTimeout(r, 800));
			throw redirect(303, '/');
		}

		const ip = getClientAddress();
		const { locked, remainingMs } = isLocked(ip);
		if (locked) {
			const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
			return fail(429, { error: `Too many attempts. Try again in ${hours} hour(s).` });
		}

		const password = data.get('password');
		if (!password || password !== APP_PASSWORD) {
			recordFailure(ip);
			const { locked: nowLocked } = isLocked(ip);
			if (nowLocked) {
				return fail(429, { error: 'Too many failed attempts. Locked for 4 hours.' });
			}
			return fail(401, { error: 'Incorrect password.' });
		}

		clearFailures(ip);

		if (TOTP_SECRET) {
			const sig = createHmac('sha256', APP_SECRET).update(PENDING_VALUE).digest('hex');
			cookies.set('pending_2fa', sig, {
				path: '/',
				httpOnly: true,
				secure: !dev,
				sameSite: 'strict',
				maxAge: 5 * 60
			});
			throw redirect(303, '/login/verify');
		}

		cookies.set('session', makeSessionSig(APP_SECRET), sessionCookieOptions(dev));
		throw redirect(303, '/');
	}
};
