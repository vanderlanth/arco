import { randomBytes } from 'node:crypto';

export function generateCsrfToken(): string {
	return randomBytes(32).toString('hex');
}

export function verifyCsrf(
	formToken: FormDataEntryValue | null,
	cookieToken: string | undefined
): boolean {
	if (!formToken || !cookieToken || typeof formToken !== 'string') return false;
	return formToken === cookieToken;
}
