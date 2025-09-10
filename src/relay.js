// @ts-check

import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { autoNAT } from "@libp2p/autonat";
import { circuitRelayServer } from "@libp2p/circuit-relay-v2";
import { identify } from "@libp2p/identify";
import { tcp } from "@libp2p/tcp";
import { webSockets } from "@libp2p/websockets";
import cors from "cors";
import express from "express";
import { createLibp2p } from "libp2p";
import { attachChat, handleChatProto } from "./utils/chat.ts";
import { initRoomRegistrationProtocol } from "./utils/room-registration-protcol.ts";

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

	const connectedPeers = new Set();
	const peerState = new Map();

	libp2p.addEventListener("peer:connect", (event) => {
		console.log("Peer connected:", event.detail);
		connectedPeers.add(event.detail.toString());
		console.log("Connected peers:", connectedPeers);
		registerHandlers(event.detail.toString());
		peerState.set(event.detail.toString(), {});
	});

	libp2p.addEventListener("peer:disconnect", (event) => {
		console.log("Disconnected peer:", event.detail.toString());
		connectedPeers.delete(event.detail.toString());
		console.log("Connected peers:", connectedPeers);
		peerState.delete(event.detail.toString());
	});

	console.log("PeerID: ", peerId.toString());
	console.log(
		"Multiaddrs: ",
		multiaddrs.map((ma) => ma.toString()),
	);

	handleChatProto(libp2p, (message, peerId) => {
		console.log(
			`Received message in handleChatProto from peer: ${peerId}:`,
			message,
		);
		peerState.get(peerId).chatApi.sendText(`Hello from the peer relay!`);
	});

	async function registerHandlers(peerIdStr) {
		console.log("chat api handler registerd for ", peerIdStr);
		const chatApi = await attachChat(libp2p, peerIdStr, (message) => {
			console.log("Received message in attach chat:", message);
			chatApi.sendText(`Hello from the peer ${peerIdStr}`);
		});
		peerState.get(peerIdStr).chatApi = chatApi;
	}
}

const app = express();
app.use(cors());

app.get("/relay-addresses", (_req, res) => {
	if (!peerId) {
		res.status(404).send("Peer ID not set");
	} else {
		res.json({
			peerId: peerId.toString(),
			multiaddrs: multiaddrs.map((ma) => ma.toString()),
		});
	}
});

const port = 3001;
app.listen(port, "0.0.0.0", () => {
	console.log(`Relay server's http service is listening on port ${port}`);
});

main();
