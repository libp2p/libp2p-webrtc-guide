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

let peerId;
let multiaddrs;

const dontAnnounceAsLocal = true;

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

	const connectedPeers = new Set();

	libp2p.addEventListener("peer:connect", (event) => {
		console.log("Peer connected:", event.detail);
		connectedPeers.add(event.detail);
		console.log("Connected peers:", connectedPeers);
	});

	libp2p.addEventListener("peer:disconnect", (event) => {
		console.log("Disconnected peer:", event.detail);
		connectedPeers.delete(event.detail);
		console.log("Connected peers:", connectedPeers);
	});

	// libp2p.services.pubsub.subscribe(PUBSUB_PEER_DISCOVERY);

	console.log("PeerID: ", peerId.toString());
	console.log(
		"Multiaddrs: ",
		multiaddrs.map((ma) => ma.toString()),
	);
}

const app = express();
app.use(cors());

app.get("/relay-addresses", (req, res) => {
  console.log(req.ip)
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
