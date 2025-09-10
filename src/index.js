// @ts-check

import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { identify } from "@libp2p/identify";
import { disable, enable } from "@libp2p/logger";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { webRTC } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { multiaddr } from "@multiformats/multiaddr";
import { createLibp2p } from "libp2p";
import {
	getAddresses,
	getPeerDetails,
	getPeerTypes,
	update,
} from "./client/drawiding-utils.js";
import { PersistingDialer } from "./client/persisting-dialer";
import { initRoomTokenForm } from "./client/room-token.ts";
import { initChatProtocol} from "./common/chat.ts";
import { initRoomRegistrationProtocol } from "./common/room-registration-protocol.ts";

const RELAT_SERVER_URL = "http://127.0.0.1:3001";

const App = async (roomToken) => {
	const bootstrapAddresses = await getBootstrapAddresses();
	console.log(bootstrapAddresses);
	console.log("Room token:", roomToken);
	const relayPeerIdStr = bootstrapAddresses.peerId;

	const libp2p = await createLibp2p({
		addresses: {
			listen: [
				// 👇 Required to create circuit relay reservations in order to hole punch browser-to-browser WebRTC connections
				"/p2p-circuit",
				// 👇 Listen for webRTC connection
				"/webrtc",
			],
		},
		transports: [
			webSockets(),
			webTransport(),
			webRTC(),
			circuitRelayTransport(),
		],
		connectionEncrypters: [noise()],
		streamMuxers: [yamux()],
		connectionGater: {
			denyDialMultiaddr: async (ma) => {
				if (ma.toString().startsWith("/ip4/127.0.0.1")) {
					return false;
				}
				return false;
			},
		},
		peerDiscovery: [
			bootstrap({
				list: [
					...(bootstrapAddresses.multiaddrs.filter(
						(ma) => !ma.toString().startsWith("/ip4/127.0.0.1"),
					) ?? []),
				],
			}),
			pubsubPeerDiscovery({
				interval: 10_000,
				topics: [roomToken],
			}),
		],
		services: {
			pubsub: gossipsub(),
			identify: identify(),
		},
	});

	let connectedRelayPeerIdStr;

	const roomRegistrationProt = initRoomRegistrationProtocol(libp2p);
	await roomRegistrationProt.start();

	const chatProtocol = initChatProtocol(libp2p, {
		onMessage: (msg, peerIdStr) => {
			console.log(
				`Received chat message in handleChatProto from ${peerIdStr}:`,
				msg,
			);
		}
	});
	chatProtocol.start();

	libp2p.addEventListener("peer:connect", async (evt) => {
		const peerIdStr = evt.detail.toString();
		console.log("Peer connected:", peerIdStr);
		console.log("Relay peer id:", relayPeerIdStr);

		if (peerIdStr === relayPeerIdStr) {
			connectedRelayPeerIdStr = peerIdStr;
			await askRelayToRegisterPubSubRoom(roomToken);
			await sendWelcomeMessage(peerIdStr, "Hello dear Relay node!");
		} else {
			console.log("Non-relay peer connected. Sending hello message");
			await sendWelcomeMessage(peerIdStr);
		}
	});

	async function askRelayToRegisterPubSubRoom(roomToken) {
		try {
			const { registerRoom } = await roomRegistrationProt.attachOngoingStream(
				connectedRelayPeerIdStr,
			);
			console.log("Relay node found, asking to register room", roomToken);
			registerRoom(roomToken);
		} catch (error) {
			console.error("Error registering room:", error);
		}
	}

	async function sendWelcomeMessage(peerIdStr, customMessage = "") {
		const chatControls = await chatProtocol.attachChat(peerIdStr);
		chatControls.sendJson({ type: "hello", message: !!customMessage ? customMessage : "Hello roomie!" });
	}

	const persistingDialer = new PersistingDialer(libp2p, {
		onSuccessfullyDialedPeer: async (peerIdStr) => {
			console.log(`Successfully dialed peer ${peerIdStr}`);
			await sendWelcomeMessage(peerIdStr);
		},
	});

	// 👇 Dial peers discovered via pubsub
	libp2p.addEventListener("peer:discovery", async (evt) => {
		// Encapsulate the multiaddrs with the peer ID to ensure correct dialing
		// Should be fixed when https://github.com/libp2p/js-libp2p/issues/3239 is resolved.
		// console.log("peer-discovery", evt);
		const discoveredPeerIdStr = evt.detail.id.toString();
		const maddrs = evt.detail.multiaddrs.map((ma) =>
			ma.encapsulate(`/p2p/${discoveredPeerIdStr}`),
		);

		if (discoveredPeerIdStr === relayPeerIdStr) {
			console.log("Dialing relay peer");
		} else {
			console.log("Dialing non-relay peer");
		}
		if (maddrs.length === 0) {
			console.log("No multiaddrs to dial");
			persistingDialer.add(discoveredPeerIdStr);
			return;
		}
		try {
			await libp2p.dial(maddrs); // dial the new peer
		} catch (err) {
			persistingDialer.add(discoveredPeerIdStr);
			console.error(`Failed to dial peer (${evt.detail.id.toString()}):`, err);
		}
	});

	globalThis.libp2p = libp2p;

	const DOM = {
		nodePeerId: () => document.getElementById("output-node-peer-id"),
		nodeStatus: () => document.getElementById("output-node-status"),
		nodePeerCount: () => document.getElementById("output-peer-count"),
		nodePeerTypes: () => document.getElementById("output-peer-types"),
		nodePeerDetails: () => document.getElementById("output-peer-details"),
		nodeAddressCount: () => document.getElementById("output-address-count"),
		nodeAddresses: () => document.getElementById("output-addresses"),

		inputMultiaddr: () => document.getElementById("input-multiaddr"),
		connectButton: () => document.getElementById("button-connect"),
		loggingButtonEnable: () => document.getElementById("button-logging-enable"),
		loggingButtonDisable: () =>
			document.getElementById("button-logging-disable"),
		outputQuery: () => document.getElementById("output"),
	};

	update(DOM.nodePeerId(), libp2p.peerId.toString());
	update(DOM.nodeStatus(), "Online");

	setInterval(() => {
		update(DOM.nodePeerCount(), libp2p.getConnections().length);
		update(DOM.nodePeerTypes(), getPeerTypes(libp2p));
		update(DOM.nodeAddressCount(), libp2p.getMultiaddrs().length);
		update(DOM.nodeAddresses(), getAddresses(libp2p));
		update(DOM.nodePeerDetails(), getPeerDetails(libp2p));
	}, 1000);

	DOM.loggingButtonEnable().onclick = (_e) => {
		enable("*,*:debug");
	};
	DOM.loggingButtonDisable().onclick = (_e) => {
		disable();
	};

	DOM.connectButton().onclick = async (e) => {
		e.preventDefault();
		const maddr = multiaddr(DOM.inputMultiaddr().value);

		console.log(maddr);
		try {
			await libp2p.dial(maddr);
		} catch (e) {
			console.log(e);
		}
	};
};

function getBootstrapAddresses() {
	return fetch(`${RELAT_SERVER_URL}/relay-addresses`).then((response) =>
		response.json(),
	);
}

initRoomTokenForm({
	onSubmit: (roomToken) => {
		App(roomToken);
	},
});
