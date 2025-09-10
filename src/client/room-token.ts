export const initRoomTokenForm = ({
	onSubmit,
}: {
	onSubmit: (roomToken: string) => void;
}) => {
	document
		.querySelector("#roomTokenSubmit")
		?.addEventListener("click", async (e) => {
			e.preventDefault();
			const roomTokenInput = document.getElementById("roomToken");
			if (!(roomTokenInput instanceof HTMLInputElement)) {
				return;
			}
			if (!roomTokenInput.value) {
				roomTokenInput.value = "default_room_token";
			}

			roomTokenInput.disabled = true;
			document
				.querySelector("#roomTokenSubmit")
				?.setAttribute("disabled", "disabled");

			onSubmit(roomTokenInput.value);
		});
};
