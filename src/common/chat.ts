import { peerIdFromString } from "@libp2p/peer-id";
import { byteStream } from "it-byte-stream";
import type { Libp2p } from "libp2p";
import { fromString as u8FromString } from "uint8arrays/from-string";
import { toString as u8ToString } from "uint8arrays/to-string";

export type ChatMessage = string | Record<string, unknown>;

export const CHAT_PROTO = "/myapp/chat/1.0.0";

type Callbacks = {
	onMessage: (msg: ChatMessage, peerId: string) => void;
};

export function initChatProtocol(libp2p: Libp2p, callbacks: Callbacks) {
	const start = () => {
		handleChatProto(libp2p, callbacks.onMessage);
	};

	const attachChat = async (peerIdStr: string) => {
		return attachChatToPeer(libp2p, peerIdStr, callbacks.onMessage);
	};

	return {
		start,
		attachChat,
	};
}

function handleChatProto(
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

async function attachChatToPeer(
	libp2p: Libp2p,
	peerIdStr: string,
	onMessage: (msg: ChatMessage, peerId: string) => void,
) {
	const peerId = peerIdFromString(peerIdStr);
	const stream = await libp2p.dialProtocol(peerId, CHAT_PROTO);
	let chatStream: ReturnType<typeof byteStream>;

	try {
		chatStream = byteStream(stream);

		Promise.resolve().then(async () => {
			while (true) {
				const buf = await chatStream.read();
				if (!buf) {
					break;
				}
				const message = u8ToString(buf.subarray());
				onMessage(message, peerIdStr);
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

	return {
		sendText,
		sendJson,
	};
}
