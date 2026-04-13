let message = $state<string | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

export const snackbar = {
	get message() {
		return message;
	},
	show(msg: string, duration = 2500) {
		if (timer) clearTimeout(timer);
		message = msg;
		timer = setTimeout(() => {
			message = null;
			timer = null;
		}, duration);
	}
};
