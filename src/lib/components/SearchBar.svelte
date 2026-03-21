<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		value?: string;
		onsearch?: (query: string) => void;
		onclear?: () => void;
		placeholder?: string;
	}

	let { value = $bindable(''), onsearch, onclear, placeholder = 'Search your library...' }: Props = $props();

	let debounceTimer: ReturnType<typeof setTimeout>;

	function handleInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			onsearch?.(value);
		}, 200);
	}

	function clear() {
		value = '';
		onclear?.();
	}
</script>

<div class="relative">
	<div class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
		<Icon name="search" size={18} />
	</div>

	<input
		type="search"
		bind:value
		oninput={handleInput}
		{placeholder}
		class="w-full rounded-lg border border-border bg-surface-raised py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
	/>

	{#if value}
		<button
			onclick={clear}
			class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
			aria-label="Clear search"
		>
			<Icon name="close" size={16} />
		</button>
	{/if}
</div>
