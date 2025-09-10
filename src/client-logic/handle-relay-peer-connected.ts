import type { Libp2p } from "libp2p";
import { attachChat } from "../utils/chat";

export function createHandlerRelayConnected({
	libp2p,
	roomToken,
}: {
	libp2p: Libp2p;
	roomToken: string;
}) {
	const handleRelayPeerConnected = async (peerIdStr: string) => {
		const chatApi = await attachChat(libp2p, peerIdStr, (message) => {
			console.log("Received message from attached chat:", message);
		});

		chatApi.sendJson({
			topic: `peer-discovery-room/${roomToken}`,
			action: "start",
		});
	};

	return {
		handleRelayPeerConnected,
	};
}
