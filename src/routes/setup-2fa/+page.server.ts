import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/environment';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { verifyCsrf } from '$lib/csrf';

export const load: PageServerLoad = async ({ cookies }) => {
	let secret = cookies.get('setup_secret');
	if (!secret) {
		const generated = speakeasy.generateSecret({ length: 20 });
		secret = generated.base32;
		cookies.set('setup_secret', secret, {
			path: '/setup-2fa',
			httpOnly: true,
			secure: !dev,
			sameSite: 'strict',
			maxAge: 30 * 60
		});
	}

	const otpauth = speakeasy.otpauthURL({
		secret,
		label: 'me',
		issuer: 'Arco',
		encoding: 'base32'
	});
	const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 200 });

	return { qrDataUrl };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();

		if (!verifyCsrf(data.get('csrf_token'), cookies.get('csrf'))) {
			return fail(403, { error: 'Invalid request.' });
		}

		const secret = cookies.get('setup_secret');
		if (!secret) {
			return fail(400, { error: 'Setup session expired. Please refresh the page.' });
		}

		const code = String(data.get('code') ?? '').replace(/\D/g, '');

		const isValid = speakeasy.totp.verify({
			secret,
			encoding: 'base32',
			token: code,
			window: 1
		});

		if (!isValid) {
			return fail(401, { error: 'Invalid code. Make sure your app is synced and try again.' });
		}

		cookies.delete('setup_secret', { path: '/setup-2fa' });
		return { verified: true, secret };
	}
};
