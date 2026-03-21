<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function stripNonDigits(e: Event) {
		const input = e.target as HTMLInputElement;
		input.value = input.value.replace(/\D/g, '').slice(0, 6);
	}
</script>

<svelte:head>
	<title>Two-factor auth — Bridge</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-8">
		<h1 class="mb-1 text-2xl font-semibold text-text-primary">Two-factor auth</h1>
		<p class="mb-6 text-sm text-text-secondary">
			Enter the 6-digit code from your authenticator app.
		</p>

		{#if form?.error}
			<div class="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
				{form.error}
			</div>
		{/if}

		<form method="POST" class="space-y-4">
			<input type="hidden" name="csrf_token" value={data.csrfToken} />
			<input
				name="code"
				type="text"
				inputmode="numeric"
				maxlength="7"
				required
				placeholder="000000"
				autocomplete="one-time-code"
				oninput={stripNonDigits}
				class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-center font-mono text-2xl tracking-widest text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
			/>
			<button
				type="submit"
				class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover transition-colors"
			>
				Verify
			</button>
		</form>

		<div class="mt-4 text-center">
			<a href="/login" class="text-sm text-text-muted hover:text-text-secondary">← Back to login</a>
		</div>
	</div>
</main>
