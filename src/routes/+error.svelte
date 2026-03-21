<script lang="ts">
	import { page } from '$app/state';
</script>

<main class="flex min-h-screen items-center justify-center p-4">
	<div class="text-center">
		<h1 class="text-6xl font-bold text-text-muted">{page.status}</h1>
		<p class="mt-4 text-lg text-text-secondary">{page.error?.message ?? 'Something went wrong'}</p>
		<a
			href="/"
			class="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover transition-colors"
		>
			Go home
		</a>
	</div>
</main>
