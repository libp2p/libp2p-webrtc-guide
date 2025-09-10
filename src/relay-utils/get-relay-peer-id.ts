import { promises as fs } from "node:fs";
import {
	createEd25519PeerId,
	createFromProtobuf,
	exportToProtobuf,
} from "@libp2p/peer-id-factory";

const KEY_PATH = "./relay-peerid.bin";

export async function getRelayPeerId() {
	try {
		const bytes = await fs.readFile(KEY_PATH);
		return await createFromProtobuf(bytes);
	} catch {
		const peerId = await createEd25519PeerId();
		await fs.writeFile(KEY_PATH, exportToProtobuf(peerId)); // contains privKey
		await fs.chmod(KEY_PATH, 0o600); // lock down permissions
		return peerId;
	}
}
