import { peerIdFromString } from "@libp2p/peer-id";
import { byteStream } from "it-byte-stream";
import type { Libp2p } from "libp2p";
import { fromString as u8FromString } from "uint8arrays/from-string";
import { toString as u8ToString } from "uint8arrays/to-string";
import z, { type ZodSchema } from "zod";
import { de } from "zod/v4/locales";

export type ChatMessage = string | Record<string, unknown>;

export const ROOM_REGISTRATION_PROTOCOL = "/myapp/room-registration/1.0.0";

type Callbacks = {
	onRegisterRoom: (roomName: string) => void;
	onUnregisterRoom: (roomName: string) => void;
};

export function initRoomRegistrationProtocol(
	libp2p: Libp2p,
	callbacks?: Callbacks,
) {
	const messageHandler = callbacks
		? createMessageHandler(callbacks)
		: undefined;

	const localAttachOngoingStream = async (peerIdStr: string) => {
		const { close, sendJson } = await attachOngoingStream(
			libp2p,
			peerIdStr,
			() => {},
		);

		return {
			close,
			registerRoom: async (roomName: string) => {
				sendJson({
					type: "register-room",
					roomName,
				} satisfies Messages["registerRoom"]);
			},
			unregisterRoom: async (roomName: string) => {
				sendJson({
					type: "unregister-room",
					roomName,
				} satisfies Messages["unregisterRoom"]);
			},
		};
	};

	const start = (): Promise<void> => {
		return registerProtoHandle(libp2p, (message) => {
			const json = parseJsonSafely(message);
			if (!json) return;
			messageHandler?.processMessage(json);
		});
	};

	const close = () => {
		libp2p.unhandle(ROOM_REGISTRATION_PROTOCOL);
	};

	return {
		start,
		attachOngoingStream: localAttachOngoingStream,
		close,
	};
}

function registerProtoHandle(
	libp2p: Libp2p,
	onMessage: (message: string, peerIdStr: string) => void,
) {
	return libp2p.handle(
		ROOM_REGISTRATION_PROTOCOL,
		async ({ stream, connection }) => {
			const chatStream = byteStream(stream);

			while (true) {
				const buf = await chatStream.read();
				if (!buf) break;
				const message = u8ToString(buf.subarray());
				onMessage(message, connection.remotePeer.toString());
			}
		},
	);
}

async function attachOngoingStream(
	libp2p: Libp2p,
	peerIdStr: string,
	onResponseMessage: (msg: ChatMessage) => void,
) {
	let chatStream: ReturnType<typeof byteStream>;

	try {
		const peerId = peerIdFromString(peerIdStr);
		const stream = await libp2p.dialProtocol(
			peerId,
			ROOM_REGISTRATION_PROTOCOL,
		);
		let keepListening = true;
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
				onResponseMessage(message);
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

const parseJsonSafely = (
	jsonString: string,
): Record<string, unknown> | null => {
	try {
		return JSON.parse(jsonString);
	} catch (error) {
		console.error("Failed to parse JSON:", error);
		return null;
	}
};

const zodMessages = {
	registerRoom: z.object({
		type: z.literal("register-room"),
		roomName: z.string().min(1).max(100),
	}),
	unregisterRoom: z.object({
		type: z.literal("unregister-room"),
		roomName: z.string().min(1).max(100),
	}),
};

type Messages = {
	registerRoom: z.infer<typeof zodMessages.registerRoom>;
	unregisterRoom: z.infer<typeof zodMessages.unregisterRoom>;
};

class MessageHandler {
	private readonly handlers: {
		schema: z.ZodSchema;
		handler: (data: z.infer<ZodSchema>) => void;
	}[] = [];

	registerHandler<T extends ZodSchema>(
		schema: T,
		handler: (data: z.infer<T>) => void,
	) {
		this.handlers.push({
			schema,
			handler: handler as (data: z.infer<ZodSchema>) => void,
		});
	}

	processMessage(parsedMessage: Record<string, unknown>) {
		for (const { schema, handler } of this.handlers) {
			const result = schema.safeParse(parsedMessage);
			if (result.success) {
				handler(result.data);
				return true; // Indicate successful processing
			}
		}
		return false; // No handler matched
	}
}

const createMessageHandler = (callbacks: Callbacks) => {
	const messageHandler = new MessageHandler();
	messageHandler.registerHandler(zodMessages.registerRoom, (data) => {
		console.log("Registering room:", data.roomName);
		callbacks.onRegisterRoom(data.roomName);
	});
	messageHandler.registerHandler(zodMessages.unregisterRoom, (data) => {
		console.log("Unregistering room:", data.roomName);
		callbacks.onUnregisterRoom(data.roomName);
	});
	return messageHandler;
};
