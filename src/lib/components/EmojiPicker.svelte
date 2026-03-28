<script lang="ts">
	import { onMount } from 'svelte';

	let {
		onselect
	}: {
		onselect?: (emoji: string) => void;
	} = $props();

	let container: HTMLDivElement;

	onMount(async () => {
		const { Picker } = await import('emoji-mart');
		const data = (await import('@emoji-mart/data')).default;

		const picker = new Picker({
			data,
			onEmojiSelect: (e: { native: string }) => {
				onselect?.(e.native);
			},
			theme: 'dark',
			set: 'native',
			previewPosition: 'none',
			skinTonePosition: 'none',
			maxFrequentRows: 2,
			perLine: 9
		});

		container.appendChild(picker as unknown as Node);
	});
</script>

<div bind:this={container} class="emoji-mart-wrap"></div>

<style>
	.emoji-mart-wrap :global(em-emoji-picker) {
		width: 100%;
		max-height: 340px;
		--border-radius: 0.5rem;
		--color-border: var(--color-border, #2a2a2a);
		--background-rgb: 18, 18, 18;
		--rgb-background: 18, 18, 18;
		--rgb-input: 30, 30, 30;
		--rgb-color: 230, 230, 230;
		--rgb-accent: 99, 102, 241;
	}
</style>
