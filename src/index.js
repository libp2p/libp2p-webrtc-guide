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
import { PUBSUB_PEER_DISCOVERY } from "./constants";
import { getAddresses, getPeerDetails, getPeerTypes, update } from "./utils";

const RELAT_SERVER_URL = "http://192.168.88.186:3001";

const App = async () => {
	const bootstrapAddresses = await getBootstrapAddresses();
	console.log(bootstrapAddresses);

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
			// Allow private addresses for local testing
			denyDialMultiaddr: async (ma) => {
				console.log("denyDialMultiaddr", ma.toString());
				if (ma.toString().startsWith("/ip4/127.0.0.1")) {
					console.log("deny!");
					return true;
				}
				return false;
			},
		},
		peerDiscovery: [
			bootstrap({
				list: [
					// '/ip4/192.168.88.176/tcp/9001/ws/p2p/12D3KooWBZbeJ7ki3eppesMrnSC4W2qeEAPfZACsQHSFFPfP9fRS'
					...(bootstrapAddresses.multiaddrs.filter(
						(ma) => !ma.toString().startsWith("/ip4/127.0.0.1"),
					) ?? []),
				],
			}),
			pubsubPeerDiscovery({
				interval: 10_000,
				topics: [PUBSUB_PEER_DISCOVERY],
			}),
		],
		services: {
			pubsub: gossipsub(),
			identify: identify(),
		},
	});

	// 👇 Dial peers discovered via pubsub
	libp2p.addEventListener("peer:discovery", async (evt) => {
		// Encapsulate the multiaddrs with the peer ID to ensure correct dialing
		// Should be fixed when https://github.com/libp2p/js-libp2p/issues/3239 is resolved.
		console.log("peer:discovery", evt.detail);
		const maddrs = evt.detail.multiaddrs.map((ma) =>
			ma.encapsulate(`/p2p/${evt.detail.id.toString()}`),
		);
		console.log(
			`Discovered new peer (${evt.detail.id.toString()}). Dialling:`,
			maddrs.map((ma) => ma.toString()),
		);
		try {
			await libp2p.dial(maddrs); // dial the new peer
		} catch (err) {
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

	libp2p.addEventListener("peer:connect", (_event) => {});
	libp2p.addEventListener("peer:disconnect", (_event) => {});

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

App().catch((err) => {
	console.error(err); // eslint-disable-line no-console
});

function getBootstrapAddresses() {
	return fetch(`${RELAT_SERVER_URL}/relay-addresses`).then((response) =>
		response.json(),
	);
}
