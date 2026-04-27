// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AdminSession } from "$lib/server/admin-auth";

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			admin: AdminSession | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
