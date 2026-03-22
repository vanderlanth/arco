<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type ImportMethod = 'exportify' | 'json';

	let method = $state<ImportMethod>('exportify');
	let importing = $state(false);
	let dragOver = $state(false);
	let selectedFile = $state<File | null>(null);
	let fileError = $state<string | null>(null);

	const acceptedExt = $derived(method === 'exportify' ? '.csv' : '.json');
	const expectedLabel = $derived(method === 'exportify' ? 'CSV' : 'JSON');

	const playlistName = $derived(
		selectedFile
			? selectedFile.name.replace(/\.(csv|json)$/i, '').trim() || 'Untitled Playlist'
			: ''
	);

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) validateAndSetFile(file);
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) validateAndSetFile(file);
	}

	function validateAndSetFile(file: File) {
		fileError = null;
		if (!file.name.endsWith(acceptedExt)) {
			fileError = `Please select a ${expectedLabel} file.`;
			return;
		}
		selectedFile = file;
	}

	function switchMethod(m: ImportMethod) {
		method = m;
		selectedFile = null;
		fileError = null;
	}

	async function handleUpload() {
		if (!selectedFile) return;
		importing = true;
		fileError = null;

		try {
			const text = await selectedFile.text();

			if (method === 'json') {
				const json = JSON.parse(text);
				if (!json.tracks || !Array.isArray(json.tracks)) {
					fileError = 'This doesn\'t look like a Spotify YourLibrary.json file. It should contain a "tracks" array.';
					importing = false;
					return;
				}
			}

			const formData = new FormData();
			formData.append('csrf_token', data.csrfToken);
			formData.append('tracks_json', text);
			formData.append('file_format', method === 'exportify' ? 'csv' : 'json');
			formData.append('playlist_name', playlistName);

			const res = await fetch('/import?/upload', {
				method: 'POST',
				body: formData
			});

			const result = await res.json();

			if (result.type === 'failure') {
				fileError = result.data?.error ?? 'Import failed';
			} else {
				const slug = result.data?.slug;
				window.location.href = slug
					? `/playlist/${slug}?imported=${result.data?.count ?? 0}`
					: `/?imported=${result.data?.count ?? 0}`;
			}
		} catch {
			fileError = method === 'exportify'
				? 'Failed to read the file. Make sure it\'s a CSV exported from Exportify.'
				: 'Failed to read or parse the file. Make sure it\'s the YourLibrary.json from your Spotify data export.';
		} finally {
			importing = false;
		}
	}
</script>

<svelte:head>
	<title>Import — Arco</title>
</svelte:head>

<main class="mx-auto max-w-lg px-4 py-12">
	<a href="/" class="mb-8 inline-block text-sm text-text-muted hover:text-text-secondary">← Back</a>

	<h1 class="mb-2 text-2xl font-semibold text-text-primary">Import from Spotify</h1>
	<p class="mb-8 text-text-secondary">
		Import your songs using Exportify or a Spotify data export.
	</p>

	{#if data.trackCount > 0}
		<div class="mb-6 rounded-lg border border-border bg-surface-raised p-4 text-sm text-text-secondary">
			You already have <strong class="text-text-primary">{data.trackCount}</strong> tracks in your
			library. Importing again will skip duplicates.
		</div>
	{/if}

	{#if form?.success}
		<div class="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
			Imported {form.count} tracks from Spotify.
		</div>
	{/if}

	{#if fileError}
		<div class="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
			{fileError}
		</div>
	{/if}

	<!-- Method toggle -->
	<div class="mb-6 flex gap-2 rounded-lg border border-border bg-surface-raised p-1">
		<button
			onclick={() => switchMethod('exportify')}
			class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {method === 'exportify' ? 'bg-accent text-surface' : 'text-text-secondary hover:text-text-primary'}"
		>
			Exportify (instant)
		</button>
		<button
			onclick={() => switchMethod('json')}
			class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {method === 'json' ? 'bg-accent text-surface' : 'text-text-secondary hover:text-text-primary'}"
		>
			Spotify data export
		</button>
	</div>

	<!-- Instructions -->
	{#if method === 'exportify'}
		<div class="mb-6 rounded-lg border border-border bg-surface-raised p-5">
			<h2 class="mb-3 text-sm font-semibold text-text-primary">How to export with Exportify</h2>
			<ol class="space-y-2 text-sm text-text-secondary">
				<li>
					<span class="mr-2 font-semibold text-accent">1.</span>
					Go to <a href="https://exportify.net/" target="_blank" rel="noopener" class="text-accent hover:underline">exportify.net</a> and sign in with Spotify
				</li>
				<li><span class="mr-2 font-semibold text-accent">2.</span>Find the playlist you want (or your Liked Songs)</li>
				<li><span class="mr-2 font-semibold text-accent">3.</span>Click <strong class="text-text-primary">Export</strong> to download a <code class="rounded bg-surface-overlay px-1.5 py-0.5 text-text-primary">.csv</code> file</li>
				<li><span class="mr-2 font-semibold text-accent">4.</span>Upload that file below</li>
			</ol>
			<p class="mt-3 text-xs text-text-muted">
				Available instantly — no waiting for Spotify to prepare your data.
			</p>
		</div>
	{:else}
		<div class="mb-6 rounded-lg border border-border bg-surface-raised p-5">
			<h2 class="mb-3 text-sm font-semibold text-text-primary">How to get your data</h2>
			<ol class="space-y-2 text-sm text-text-secondary">
				<li>
					<span class="mr-2 font-semibold text-accent">1.</span>
					Go to <a href="https://www.spotify.com/account/privacy" target="_blank" rel="noopener" class="text-accent hover:underline">spotify.com/account/privacy</a>
				</li>
				<li><span class="mr-2 font-semibold text-accent">2.</span>Scroll to "Download your data"</li>
				<li><span class="mr-2 font-semibold text-accent">3.</span>Request <strong class="text-text-primary">Account data</strong></li>
				<li><span class="mr-2 font-semibold text-accent">4.</span>Spotify will email you a download link (usually 1–5 days)</li>
				<li><span class="mr-2 font-semibold text-accent">5.</span>Download the ZIP, unzip it, and upload <code class="rounded bg-surface-overlay px-1.5 py-0.5 text-text-primary">YourLibrary.json</code> below</li>
			</ol>
		</div>
	{/if}

	<!-- File drop zone -->
	<div
		class="relative mb-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors {dragOver ? 'border-accent bg-accent/5' : 'border-border'}"
		ondragover={(e) => { e.preventDefault(); dragOver = true; }}
		ondragleave={() => { dragOver = false; }}
		ondrop={handleDrop}
		role="region"
		aria-label="File upload area"
	>
		{#if selectedFile}
			<div class="mb-2 text-3xl">✓</div>
			<p class="text-sm font-medium text-text-primary">{selectedFile.name}</p>
			<p class="mt-1 text-xs text-text-muted">
				{(selectedFile.size / 1024).toFixed(1)} KB
			</p>
			<button
				onclick={() => { selectedFile = null; }}
				class="mt-3 text-xs text-text-muted hover:text-text-secondary"
			>
				Remove
			</button>
		{:else}
			<div class="mb-2 text-3xl text-text-muted">📁</div>
			<p class="text-sm text-text-secondary">
				{#if method === 'exportify'}
					Drag & drop your Exportify <code class="rounded bg-surface-overlay px-1.5 py-0.5 text-text-primary">.csv</code> here
				{:else}
					Drag & drop your <code class="rounded bg-surface-overlay px-1.5 py-0.5 text-text-primary">YourLibrary.json</code> here
				{/if}
			</p>
			<p class="mt-2 text-xs text-text-muted">or</p>
			<label class="mt-2 inline-block cursor-pointer rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay transition-colors">
				Browse files
				<input
					type="file"
					accept={acceptedExt}
					onchange={handleFileSelect}
					class="hidden"
				/>
			</label>
		{/if}
	</div>

	{#if selectedFile}
		<div class="mb-4 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-secondary">
			Playlist name: <strong class="text-text-primary">{playlistName}</strong>
		</div>
	{/if}

	<button
		onclick={handleUpload}
		disabled={importing || !selectedFile}
		class="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-surface hover:bg-accent-hover disabled:opacity-50 transition-colors"
	>
		{importing ? 'Importing...' : 'Import my songs'}
	</button>
</main>
