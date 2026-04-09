import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { createHmac } from 'node:crypto';
import { APP_SECRET } from '$env/static/private';
import { dev } from '$app/environment';
import { generateCsrfToken } from '$lib/csrf';

export const SESSION_VALUE = 'authenticated';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years

export function makeSessionSig(secret: string): string {
	return createHmac('sha256', secret).update(SESSION_VALUE).digest('hex');
}

export function sessionCookieOptions(d: boolean) {
	return {
		path: '/',
		httpOnly: true as const,
		secure: !d,
		sameSite: 'lax' as const,
		maxAge: COOKIE_MAX_AGE
	};
}

export const handle: Handle = async ({ event, resolve }) => {
	let csrfToken = event.cookies.get('csrf');
	if (!csrfToken) {
		csrfToken = generateCsrfToken();
		event.cookies.set('csrf', csrfToken, {
			path: '/',
			httpOnly: true,
			secure: !dev,
			sameSite: 'strict',
			maxAge: COOKIE_MAX_AGE
		});
	}
	event.locals.csrfToken = csrfToken;

	const cookie = event.cookies.get('session');
	const isAuthenticated = cookie === makeSessionSig(APP_SECRET);

	event.locals.authenticated = isAuthenticated;

	const { pathname } = event.url;
	const isLoginRoute = pathname.startsWith('/login');
	const isLogoutRoute = pathname.startsWith('/logout');
	const isPublicApi = pathname === '/api/update-ytdlp';

	if (!isAuthenticated && !isLoginRoute && !isLogoutRoute && !isPublicApi) {
		throw redirect(303, '/login');
	}

	if (isAuthenticated && isLoginRoute) {
		throw redirect(303, '/');
	}

	if (isAuthenticated) {
		event.cookies.set('session', makeSessionSig(APP_SECRET), sessionCookieOptions(dev));
	}

	return resolve(event);
};
