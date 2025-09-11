const LOCAL_STORAGE_KEY = "libp2p-guide-input-form";

export const initRoomTokenForm = ({
	onSubmit,
}: {
	onSubmit: (args: { roomToken: string; relayAddress: string }) => void;
}) => {
	const form = document.querySelector<HTMLFormElement>("#input-form");

	if (!form) {
		throw new Error("Form not found");
	}

	form.addEventListener("submit", (e) => {
		e.preventDefault();
		const formData = new FormData(form);
		const roomToken = formData.get("roomToken") as string;
		const relayAddress = formData.get("relayServerAddress") as string;
		localStorage.setItem(
			LOCAL_STORAGE_KEY,
			JSON.stringify({ roomToken, relayAddress }),
		);
		onSubmit({ roomToken, relayAddress });
		form.querySelector("button")?.setAttribute("disabled", "true");
	});

	const item = localStorage.getItem(LOCAL_STORAGE_KEY);

	if (item) {
		const roomTokenInput =
			document.querySelector<HTMLInputElement>("#roomToken");
		const relayAddressInput = document.querySelector<HTMLInputElement>(
			"#relayServerAddress",
		);

		if (!roomTokenInput || !relayAddressInput) {
			console.log("Inputs not found");
			return;
		}

		try {
			const json = JSON.parse(item);
			roomTokenInput.value = json.roomToken;
			relayAddressInput.value = json.relayAddress;
		} catch (e) {
			console.error("Error parsing JSON", e);
		}
	}
};
