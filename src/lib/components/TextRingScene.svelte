<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Text } from '@threlte/extras';
	import { MeshTransmissionMaterial } from '@pmndrs/vanilla';
	import { Group, Mesh as ThreeMesh, WebGLRenderTarget, Color } from 'three';

	let { text }: { text: string } = $props();

	let groupRef = $state<Group | undefined>(undefined);
	let midGroupRef = $state<Group | undefined>(undefined);
	let innerGroupRef = $state<Group | undefined>(undefined);
	let glassMeshRef = $state<ThreeMesh | undefined>(undefined);

	const RADIUS = 2;
	const RADIUS_MID = 1.6;
	const RADIUS_INNER = 1.2;
	const HEIGHT = 4;
	const SEGMENTS = 32;

	const chars = $derived(text.split(''));
	const angleStep = $derived((2 * Math.PI) / chars.length);
	const innerAngleStep = $derived((2 * Math.PI) / chars.length);

	const material = new MeshTransmissionMaterial({
		samples: 20,
		thickness: 2,
		chromaticAberration: 0.05,
		anisotropicBlur: 0.1,
		roughness: 0,
		transmissionSampler: false
	});

	const fbo = new WebGLRenderTarget(1024, 1024);
	const { renderer, camera, scene } = useThrelte();

	scene.background = new Color(0x000000);

	useTask((delta) => {
		if (!groupRef || !glassMeshRef) return;

		groupRef.rotation.y += 0.005;
		groupRef.rotation.x += 0.001;
		groupRef.rotation.z += 0.002;

		if (midGroupRef) {
			midGroupRef.rotation.y -= 0.005;
			midGroupRef.rotation.x += 0.01;
			midGroupRef.rotation.z -= 0.002;
		}

		if (innerGroupRef) {
			innerGroupRef.rotation.y -= 0.002;
			innerGroupRef.rotation.x -= 0.005;
			innerGroupRef.rotation.z -= 0.004;
		}

		material.time += delta;

		// Render scene without glass mesh → this becomes the refraction buffer
		const savedTarget = renderer.getRenderTarget();
		glassMeshRef.visible = false;
		renderer.setRenderTarget(fbo);
		renderer.render(scene, camera.current);
		glassMeshRef.visible = true;
		renderer.setRenderTarget(savedTarget);

		material.buffer = fbo.texture;
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />

<T.Group bind:ref={groupRef}>
	<T.Mesh bind:ref={glassMeshRef}>
		<T.CylinderGeometry args={[RADIUS, RADIUS, HEIGHT, SEGMENTS]} />
		<T is={material} attach="material" />
	</T.Mesh>

	{#each chars as char, i}
		{@const angle = i * angleStep}
		{@const x = RADIUS * Math.cos(angle)}
		{@const z = RADIUS * Math.sin(angle)}
		{@const rotY = -angle }
		<Text
			text={char}
			position={[x, 0, z]}
			rotation={[0, rotY, 0]}
			fontSize={0.3}
			letterSpacing={0.02}
			color="white"
			anchorX="center"
			anchorY="middle"
		/>
	{/each}

</T.Group>

<!-- Mid ring — independent rotation -->
<T.Group bind:ref={midGroupRef}>
	{#each chars as char, i}
		{@const angle = i * angleStep + Math.PI / (chars.length * 2)}
		{@const x = RADIUS_MID * Math.cos(angle)}
		{@const z = RADIUS_MID * Math.sin(angle)}
		{@const rotY = -angle}
		<Text
			text={char}
			position={[x, 0, z]}
			rotation={[0, rotY, 0]}
			fontSize={0.25}
			letterSpacing={0.02}
			color="white"
			anchorX="center"
			anchorY="middle"
		/>
	{/each}
</T.Group>

<!-- Inner ring — independent rotation -->
<T.Group bind:ref={innerGroupRef}>
	{#each chars as char, i}
		{@const angle = i * innerAngleStep + Math.PI / chars.length}
		{@const x = RADIUS_INNER * Math.cos(angle)}
		{@const z = RADIUS_INNER * Math.sin(angle)}
		{@const rotY = -angle}
		<Text
			text={char}
			position={[x, 0, z]}
			rotation={[0, rotY, 0]}
			fontSize={0.2}
			letterSpacing={0.02}
			color="white"
			anchorX="center"
			anchorY="middle"
		/>
	{/each}
</T.Group>
