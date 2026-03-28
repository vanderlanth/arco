<script lang="ts">
	import { Canvas } from '@threlte/core';
	import TextRingScene from './TextRingScene.svelte';

	let { text }: { text: string } = $props();
</script>

<div class="h-full w-full overflow-hidden rounded-xl bg-black" style="mix-blend-mode: difference;">
	<Canvas>
		<TextRingScene {text} />
	</Canvas>
</div>
