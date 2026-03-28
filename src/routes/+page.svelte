<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';

	let { data }: { data: PageData } = $props();

	const imported = $derived(page.url.searchParams.get('imported'));

	const RANDOM_EMOJIS = [
		'🎵','🎶','🎸','🎹','🎺','🎻','🥁','🎤','🎧','🎼','🎷','🪕','🪗','🪘',
		'🔥','⚡','🌊','🌙','☀️','⭐','💫','🌈','🌸','🌺','🌿','🌴','🍀','🌻',
		'💎','👑','🎯','🎭','🎬','🦋','🐬','🦅','🦁','❤️','💙','💜','✨','🎉'
	];

	function randomEmoji() {
		return RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
	}

	// Create modal state
	let showCreateModal = $state(false);
	let newName = $state('');
	let newEmoji = $state('');
	let creating = $state(false);
	let showMoreMenu = $state(false);

	function openCreateModal() {
		newName = '';
		newEmoji = randomEmoji();
		showCreateModal = true;
	}

	async function createPlaylist() {
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		try {
			const res = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, emoji: newEmoji || null })
			});
			if (!res.ok) throw new Error('Failed to create playlist');
			const playlist = await res.json();
			showCreateModal = false;
			newName = '';
			newEmoji = '';
			await invalidateAll();
			goto(`/playlist/${playlist.slug}`);
		} finally {
			creating = false;
		}
	}

	let deletingRadioId = $state<number | null>(null);

	async function deleteRadio(id: number) {
		if (deletingRadioId) return;
		deletingRadioId = id;
		try {
			const res = await fetch(`/api/radio?id=${id}`, { method: 'DELETE' });
			if (res.ok) await invalidateAll();
		} finally {
			deletingRadioId = null;
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
	<title>Arco</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-6">
	<header class="mb-6 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<img src="/favicon.svg" alt="" class="h-7 w-7" />
			<h1 class="text-2xl font-bold text-text-primary">Arco</h1>
		</div>
		<div class="flex items-center gap-3">
			<button
				onclick={openCreateModal}
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay transition-colors"
			>
				New playlist
			</button>
			<div class="relative">
				<button
					onclick={() => (showMoreMenu = !showMoreMenu)}
					class="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-surface-overlay transition-colors"
					aria-label="More actions"
				>
					<Icon name="overflow-menu" size={16} />
				</button>
				{#if showMoreMenu}
					<div class="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-border bg-surface-raised py-1 shadow-xl">
						<a href="/add" onclick={() => (showMoreMenu = false)} class="block px-3 py-2 text-sm text-text-primary hover:bg-surface-overlay">Add song</a>
						<a href="/import" onclick={() => (showMoreMenu = false)} class="block px-3 py-2 text-sm text-text-primary hover:bg-surface-overlay">Import</a>
						<a href="/setup-2fa" onclick={() => (showMoreMenu = false)} class="block px-3 py-2 text-sm text-text-primary hover:bg-surface-overlay">2FA</a>
						<div class="my-1 border-t border-border"></div>
						<a href="/logout" class="block px-3 py-2 text-sm text-red-400 hover:bg-surface-overlay">Logout</a>
					</div>
					<button onclick={() => (showMoreMenu = false)} class="fixed inset-0 z-20" aria-label="Close menu"></button>
				{/if}
			</div>
		</div>
	</header>

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
					class="flex items-center gap-4 rounded-xl border border-border bg-surface-raised py-1 pl-1 pr-4 transition-colors hover:bg-surface-overlay"
				>
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#111] text-accent">
						{#if playlist.emoji}
							<span class="text-[16px] leading-none">{playlist.emoji}</span>
						{:else}
							<Icon name="music" size={20} />
						{/if}
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
					</a>
			{/each}
		</div>
	{/if}

	{#if data.recentRadios && data.recentRadios.length > 0}
		<section class="mt-8">
			<h2 class="mb-3 text-sm font-semibold text-text-secondary">Recent radios</h2>
			<div class="space-y-2">
			{#each data.recentRadios as radio (radio.id)}
				<div class="flex items-center gap-4 rounded-xl border border-border bg-surface-raised py-1 pl-1 pr-4 transition-colors hover:bg-surface-overlay">
					<a href="/radio/{radio.id}" class="flex min-w-0 flex-1 items-center gap-4">
						{#if radio.seedAlbumArt}
							<img
								src={radio.seedAlbumArt}
								alt=""
								class="h-12 w-12 shrink-0 rounded-lg object-cover"
							/>
						{:else}
							<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#111] text-accent">
								<span class="text-[16px] leading-none">📻</span>
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-text-primary">
								{radio.seedArtist} — {radio.seedTitle}
							</p>
							<p class="text-xs text-text-muted">
								{radio.trackCount} track{radio.trackCount !== 1 ? 's' : ''}
								{#if radio.createdAt}
									<span class="mx-1">·</span>
									{formatDate(radio.createdAt)}
								{/if}
							</p>
						</div>
						</a>
					<button
						onclick={() => deleteRadio(radio.id)}
						disabled={deletingRadioId === radio.id}
						class="shrink-0 rounded-lg p-1.5 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
						title="Delete radio"
					>
						<Icon name="trash" size={14} />
					</button>
				</div>
			{/each}
			</div>
		</section>
	{/if}
</main>

<!-- Create playlist modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div class="absolute inset-0 bg-black/60" onclick={() => { showCreateModal = false; }}></div>
		<div class="relative w-full max-w-sm rounded-xl border border-border bg-surface-raised p-6 shadow-2xl">
			<h2 class="mb-4 text-base font-semibold text-text-primary">New playlist</h2>

			<!-- Emoji preview + picker -->
			<div class="mb-4">
				<div class="mb-2 flex items-center gap-3">
					<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#111] text-accent">
						{#if newEmoji}
							<span class="text-3xl leading-none">{newEmoji}</span>
						{:else}
							<Icon name="music" size={24} />
						{/if}
					</div>
					<p class="text-xs text-text-muted">Pick a cover emoji</p>
				</div>
				<EmojiPicker onselect={(e) => (newEmoji = e)} />
			</div>

			<!-- Name input -->
			<form
				onsubmit={(e) => { e.preventDefault(); createPlaylist(); }}
			>
				<input
					bind:value={newName}
					placeholder="Playlist name"
					class="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
					autofocus
					onkeydown={(e) => { if (e.key === 'Escape') showCreateModal = false; }}
				/>
				<div class="flex justify-end gap-2">
					<button
						type="button"
						onclick={() => { showCreateModal = false; }}
						class="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!newName.trim() || creating}
						class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface hover:bg-accent-hover transition-colors disabled:opacity-50"
					>
						{creating ? 'Creating...' : 'Create'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
