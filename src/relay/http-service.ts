import type { Multiaddr } from "@multiformats/multiaddr";
import cors from "cors";
import express from "express";

const app = express();
app.use(cors());

let peerId: { toString: () => string };
let multiaddrs: Multiaddr[] | undefined;

export const setInfoForHttpService = (info: {
	peerId: { toString: () => string };
	multiaddrs: Multiaddr[];
}) => {
	peerId = info.peerId;
	multiaddrs = info.multiaddrs;
};

export const initHttpService = ({ port = 3001 }: { port?: number }) => {
	app.get("/relay-addresses", (_req, res) => {
		if (!peerId) {
			res.status(404).send("Peer ID not set");
		} else {
			res.json({
				peerId: peerId.toString(),
				multiaddrs: multiaddrs?.map((ma) => ma.toString()) ?? [],
			});
		}
	});

	app.listen(port, "0.0.0.0", () => {
		console.log(`Relay server's http service is listening on port ${port}`);
	});
};
