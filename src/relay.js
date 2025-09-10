// @ts-check

import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { circuitRelayServer } from "@libp2p/circuit-relay-v2";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { webSockets } from "@libp2p/websockets";
import { createLibp2p } from "libp2p";
import { initChatProtocol } from "./common/chat.ts";
import { initRoomRegistrationProtocol } from "./common/room-registration-protocol.ts";
import {
	initHttpService,
	setInfoForHttpService,
} from "./relay/http-service.ts";

let peerId;
let multiaddrs;

const _dontAnnounceAsLocal = true;

async function main() {
	const libp2p = await createLibp2p({
		addresses: {
			listen: ["/ip4/0.0.0.0/tcp/9001/ws", "/ip4/0.0.0.0/tcp/9002"],
			noAnnounce: ["/ip4/127.0.0.1/tcp/9001/ws"],
		},
		transports: [webSockets(), tcp()],
		connectionEncrypters: [noise()],
		streamMuxers: [yamux()],
		services: {
			identify: identify(),
			autoNat: autoNAT(),
			relay: circuitRelayServer(),
			pubsub: gossipsub(),
		},
	});

	peerId = libp2p.peerId;
	multiaddrs = libp2p.getMultiaddrs();

	setInfoForHttpService({
		peerId,
		multiaddrs,
	});
	const registeredRooms = new Set();

	const roomRegistrationProt = initRoomRegistrationProtocol(libp2p, {
		onRegisterRoom: (roomName) => {
			console.log(`Room registered: ${roomName}`);
			libp2p.services.pubsub.subscribe(roomName);
			registeredRooms.add(roomName);
		},
		onUnregisterRoom: (roomName) => {
			console.log(`Room registered: ${roomName}`);
			libp2p.services.pubsub.unsubscribe(roomName);
			registeredRooms.delete(roomName);
		},
	});
	await roomRegistrationProt.start();

	const chatProtocol = initChatProtocol(libp2p, {
		onMessage: async (message, peerId) => {
			console.log(
				`Received message in handleChatProto from peer: ${peerId}:`,
				message,
			);
			const { sendText } = await chatProtocol.attachChat(peerId);
			sendText("Hello from relay server!");
		},
	});

	chatProtocol.start();

	const connectedPeers = new Set();

	libp2p.addEventListener("peer:connect", (event) => {
		console.log("Peer connected:", event.detail);
		connectedPeers.add(event.detail.toString());
		console.log("Connected peers:", connectedPeers);
	});

	libp2p.addEventListener("peer:disconnect", (event) => {
		console.log("Disconnected peer:", event.detail.toString());
		connectedPeers.delete(event.detail.toString());
		console.log("Connected peers:", connectedPeers);
	});

	console.log("PeerID: ", peerId.toString());
	console.log(
		"Multiaddrs: ",
		multiaddrs.map((ma) => ma.toString()),
	);
}

main();
initHttpService();
