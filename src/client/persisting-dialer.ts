import { peerIdFromString } from "@libp2p/peer-id";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { Libp2p } from "libp2p";

export class PersistingDialer {
	private peersToDial: Map<
		string,
		{
			isCurrentlyDialing: boolean;
		}
	> = new Map();
	private queuedPeersToDialByIds: string[] = [];

	constructor(
		private libp2p: Libp2p,
		private options: {
			onSuccessfullyDialedPeer?: (peerIdStr: string) => void;
		} = {},
	) {
		libp2p.addEventListener("peer:update", async (evt) => {
			const peerIdStr = evt.detail.peer.id.toString();
			const peerToDial = this.peersToDial.get(peerIdStr);

			if (!peerToDial) {
				return;
			}

			if (peerToDial.isCurrentlyDialing) {
				this.queuedPeersToDialByIds.push(peerIdStr);
				return;
			}

			await this.dial(
				peerIdStr,
				evt.detail.peer.addresses.map((a) => a.multiaddr),
			);
		});
	}

	add(peerId: string) {
		if (this.peersToDial.has(peerId)) {
			return;
		}

		this.peersToDial.set(peerId, { isCurrentlyDialing: false });
	}

	private async triggerDialFromQueue(peerIdStr: string) {
		if (this.queuedPeersToDialByIds.length === 0) {
			return;
		}

		const index = this.queuedPeersToDialByIds.indexOf(peerIdStr);
		if (index !== -1) {
			this.queuedPeersToDialByIds.splice(index, 1);
		}

		await this.dial(peerIdStr);
	}

	private async dial(peerIdStr: string, multiAddrs?: Multiaddr[]) {
		const peerToDial = this.peersToDial.get(peerIdStr);

		if (!peerToDial) {
			throw new Error(`Peer ${peerIdStr} not found`);
		}

		if (peerToDial.isCurrentlyDialing) {
			console.log(`Peer ${peerIdStr} is already being dialed`);
			return;
		}

		peerToDial.isCurrentlyDialing = true;

		try {
			if (!multiAddrs) {
				const peerId = peerIdFromString(peerIdStr);
				console.log(`Trying to dial peer by id ${peerIdStr}`);
				await this.libp2p.dial(peerId);
			} else {
				const encodedMultiAddrs = multiAddrs.map((multiaddr) =>
					multiaddr.encapsulate(`/p2p/${peerIdStr}`),
				);
				console.log(
					`Trying to dial peer by address`,
					encodedMultiAddrs.map((multiaddr) => multiaddr.toString()),
				);
				await this.libp2p.dial(encodedMultiAddrs);
			}
			console.log(`Successfully dialed peer ${peerIdStr}`);
			this.options.onSuccessfullyDialedPeer?.(peerIdStr);
			this.peersToDial.delete(peerIdStr);
		} catch (error) {
			peerToDial.isCurrentlyDialing = false;
			if (this.queuedPeersToDialByIds.includes(peerIdStr)) {
				await this.triggerDialFromQueue(peerIdStr);
			}
			console.error(`Failed to dial peer ${peerIdStr}: ${error}`);
		}
	}
}
