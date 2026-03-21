declare global {
	namespace App {
		interface Locals {
			authenticated: boolean;
			csrfToken: string;
		}
		interface PageData {
			csrfToken: string;
		}
	}
}

export {};
