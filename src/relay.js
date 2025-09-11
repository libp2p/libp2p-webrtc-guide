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

const expressPort = process.env.RELAY_EXPRESS_PORT
	? parseInt(process.env.RELAY_EXPRESS_PORT, 10)
	: 9101;
const relayPort = process.env.RELAY_PORT
	? parseInt(process.env.RELAY_PORT, 10)
	: 9001;
const announce = process.env.RELAY_ANNOUNCE ? [process.env.RELAY_ANNOUNCE] : [];

if (announce.length > 0) {
	console.log(`Announcing on ${announce.join(", ")}`);
}
const listenAddr = [`/ip4/0.0.0.0/tcp/${relayPort}/ws`];

console.log("Relays libp2p node listens on ", listenAddr);

async function main() {
	const libp2p = await createLibp2p({
		addresses: {
			listen: listenAddr,
			announce: [...(announce ?? []), ...listenAddr],
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
			sendText(`Bouncing your message: '${message}'`);
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
initHttpService({ port: expressPort });
