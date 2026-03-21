<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type SuccessResult = { verified: true; secret: string };
	const success = $derived(
		form && 'verified' in form && form.verified ? (form as SuccessResult) : null
	);

	function stripNonDigits(e: Event) {
		const input = e.target as HTMLInputElement;
		input.value = input.value.replace(/\D/g, '').slice(0, 6);
	}
</script>

<svelte:head>
	<title>Set up 2FA — Bridge</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-md rounded-2xl border border-border bg-surface-raised p-8">
		{#if success}
			<div class="mb-3 text-center text-3xl">&#10003;</div>
			<h1 class="mb-2 text-center text-xl font-semibold text-text-primary">2FA verified!</h1>
			<p class="mb-4 text-sm text-text-secondary">
				Add this line to your <code class="rounded bg-surface-overlay px-1">.env</code> file (and to
				Vercel environment variables), then redeploy:
			</p>
			<pre
				class="select-all break-all rounded-lg border border-border bg-surface-overlay p-3 font-mono text-sm">TOTP_SECRET={success.secret}</pre>
			<p class="mt-3 text-xs text-text-muted">
				After adding it, every login will require your authenticator app.
			</p>
			<a
				href="/"
				class="mt-6 block text-center text-sm text-accent hover:text-accent-hover"
			>
				← Back to app
			</a>
		{:else}
			<h1 class="mb-1 text-xl font-semibold text-text-primary">Set up two-factor auth</h1>
			<p class="mb-5 text-sm text-text-secondary">
				Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
			</p>

			<div class="mb-6 flex justify-center">
				<img
					src={data.qrDataUrl}
					alt="2FA QR code"
					class="rounded-lg border border-border"
					width="200"
					height="200"
				/>
			</div>

			{#if form?.error}
				<div class="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
					{form.error}
				</div>
			{/if}

			<form method="POST" class="space-y-4">
				<input type="hidden" name="csrf_token" value={data.csrfToken} />
				<div>
					<label for="code" class="mb-1 block text-sm font-medium text-text-secondary">
						Verification code
					</label>
				<input
					id="code"
					name="code"
					type="text"
					inputmode="numeric"
					pattern="[0-9]{6}"
					maxlength="7"
					required
					placeholder="000000"
					oninput={stripNonDigits}
					class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-center font-mono text-xl tracking-widest text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
				/>
				</div>
				<button
					type="submit"
					class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover transition-colors"
				>
					Verify &amp; get secret
				</button>
			</form>
		{/if}
	</div>
</main>
