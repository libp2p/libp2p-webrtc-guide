export function initMessageForm(onSubmit: (message: string) => void) {
	const form = document.getElementById("message-form") as HTMLFormElement;

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const formData = new FormData(form);
		const message = formData.get("message") as string;
		onSubmit(message);
		const input = document.getElementById("message-input") as HTMLInputElement;
		input.value = "";
		input.focus();
	});
}
