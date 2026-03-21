interface Attempt {
	count: number;
	lockedUntil: number;
}

const store = new Map<string, Attempt>();

const MAX_ATTEMPTS = 3;
const LOCK_MS = 4 * 60 * 60 * 1000; // 4 hours

export function isLocked(ip: string): { locked: boolean; remainingMs: number } {
	const entry = store.get(ip);
	if (!entry || entry.lockedUntil <= Date.now()) return { locked: false, remainingMs: 0 };
	return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
}

export function recordFailure(ip: string): void {
	const now = Date.now();
	const entry = store.get(ip) ?? { count: 0, lockedUntil: 0 };
	if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
		entry.count = 0;
		entry.lockedUntil = 0;
	}
	entry.count++;
	if (entry.count >= MAX_ATTEMPTS) {
		entry.lockedUntil = now + LOCK_MS;
	}
	store.set(ip, entry);
}

export function clearFailures(ip: string): void {
	store.delete(ip);
}
