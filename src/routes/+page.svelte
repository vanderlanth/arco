<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: PageData } = $props();

	const imported = $derived(page.url.searchParams.get('imported'));

	let showNewForm = $state(false);
	let newName = $state('');
	let creating = $state(false);

	async function createPlaylist() {
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		try {
			const res = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) throw new Error('Failed to create playlist');
			const playlist = await res.json();
			showNewForm = false;
			newName = '';
			await invalidateAll();
			goto(`/playlist/${playlist.slug}`);
		} finally {
			creating = false;
		}
	}

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return '';
		}
	}
</script>

<svelte:head>
	<title>Bridge</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-6">
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-text-primary">Bridge</h1>
		<div class="flex items-center gap-3">
			<button
				onclick={() => (showNewForm = !showNewForm)}
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay transition-colors"
			>
				New playlist
			</button>
			<a
				href="/import"
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay transition-colors"
			>
				Import
			</a>
			<a
				href="/setup-2fa"
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay transition-colors"
			>
				2FA
			</a>
			<a
				href="/logout"
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay transition-colors"
			>
				Logout
			</a>
		</div>
	</header>

	{#if showNewForm}
		<form
			onsubmit={(e) => { e.preventDefault(); createPlaylist(); }}
			class="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface-raised p-3"
		>
			<input
				bind:value={newName}
				placeholder="Playlist name"
				class="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
				autofocus
			/>
			<button
				type="submit"
				disabled={!newName.trim() || creating}
				class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface hover:bg-accent-hover transition-colors disabled:opacity-50"
			>
				{creating ? 'Creating...' : 'Create'}
			</button>
			<button
				type="button"
				onclick={() => { showNewForm = false; newName = ''; }}
				class="rounded-md px-2 py-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
			>
				Cancel
			</button>
		</form>
	{/if}

	{#if imported}
		<div class="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
			Successfully imported {imported} tracks.
		</div>
	{/if}

	{#if data.playlists.length === 0}
		<div class="py-20 text-center">
			<p class="mb-2 text-lg text-text-secondary">No playlists yet</p>
			<p class="mb-6 text-sm text-text-muted">Import your songs from Spotify to get started.</p>
			<a
				href="/import"
				class="inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover transition-colors"
			>
				Import from Spotify
			</a>
		</div>
	{:else}
		<div class="mb-3">
			<p class="text-xs text-text-muted">
				{data.playlists.length} playlist{data.playlists.length !== 1 ? 's' : ''}
			</p>
		</div>

		<div class="space-y-2">
			{#each data.playlists as playlist (playlist.id)}
				<a
					href="/playlist/{playlist.slug}"
					class="flex items-center gap-4 rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:bg-surface-overlay"
				>
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
						<Icon name="music" size={20} />
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-text-primary">{playlist.name}</p>
						<p class="text-xs text-text-muted">
							{playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
							{#if playlist.createdAt}
								<span class="mx-1">·</span>
								{formatDate(playlist.createdAt)}
							{/if}
						</p>
					</div>
					<span class="shrink-0 text-text-muted"><Icon name="chevron-right" size={16} /></span>
				</a>
			{/each}
		</div>
	{/if}
</main>
