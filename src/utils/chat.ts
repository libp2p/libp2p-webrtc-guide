import { peerIdFromString } from "@libp2p/peer-id";
import { byteStream } from "it-byte-stream";
import type { Libp2p } from "libp2p";
import { fromString as u8FromString } from "uint8arrays/from-string";
import { toString as u8ToString } from "uint8arrays/to-string";

export type ChatMessage = string | Record<string, unknown>;

export const CHAT_PROTO = "/myapp/chat/1.0.0";

type Stream = Awaited<ReturnType<Libp2p["dialProtocol"]>>;

export function handleChatProto(
	libp2p: Libp2p,
	onMessage: (msg: ChatMessage, peerId: string) => void,
) {
	libp2p.handle(CHAT_PROTO, async ({ stream, connection }) => {
		const chatStream = byteStream(stream);

		while (true) {
			const buf = await chatStream.read();
			if (!buf) break;
			const message = u8ToString(buf.subarray());
			onMessage(message, connection.remotePeer.toString());
		}
	});
}

export async function attachChat(
	libp2p: Libp2p,
	peerIdStr: string,
	onMessage: (msg: ChatMessage) => void,
) {
	const peerId = peerIdFromString(peerIdStr);
	const stream = await libp2p.dialProtocol(peerId, CHAT_PROTO);
	let chatStream: ReturnType<typeof byteStream>;
	let keepListening = true;

	try {
		chatStream = byteStream(stream);

		Promise.resolve().then(async () => {
			while (keepListening) {
				const buf = await chatStream.read();
				if (!buf) {
					console.log("❌ No buffer received, ending read loop");
					keepListening = false;
					break;
				}
				const message = u8ToString(buf.subarray());
				console.log("📨 Received response:", message);
				onMessage(message);
			}
		});
	} catch (err) {
		console.error(err);
	}

	const sendText = (text: string) => {
		chatStream.write(u8FromString(text));
	};
	const sendJson = (obj: Record<string, unknown>) => {
		sendText(JSON.stringify(obj));
	};

	const close = () => {
		keepListening = false;
	};

	return {
		sendText,
		sendJson,
		close,
	};
}
