<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign in — Arco</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-8">
		<h1 class="mb-6 text-2xl font-semibold text-text-primary">Sign in</h1>

		{#if form?.error}
			<div class="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
				{form.error}
			</div>
		{/if}

		<form method="POST" class="space-y-4">
			<input type="hidden" name="csrf_token" value={data.csrfToken} />
			<div style="position:absolute;left:-9999px;top:-9999px" aria-hidden="true">
				<label for="website">Website</label>
				<input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm font-medium text-text-secondary">
					Password
				</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
				/>
			</div>

			<button
				type="submit"
				class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface transition-colors"
			>
				Sign in
			</button>
		</form>
	</div>
</main>
