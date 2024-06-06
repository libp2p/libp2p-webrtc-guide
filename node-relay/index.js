// @ts-check
import { createLibp2p } from 'libp2p'
import { autoNAT } from '@libp2p/autonat'
import { identify } from '@libp2p/identify'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { multiaddr } from '@multiformats/multiaddr'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { webSockets } from '@libp2p/websockets'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { tcp } from '@libp2p/tcp'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { enable, disable } from '@libp2p/logger'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
// import { update, getPeerTypes, getAddresses, getPeerDetails } from './utils'
import { bootstrap } from '@libp2p/bootstrap'

async function main() {
  // enable('*')
  const libp2p = await createLibp2p({
    addresses: {
      listen: [
        '/ip4/0.0.0.0/tcp/9001/ws',
        '/ip4/0.0.0.0/tcp/9002/',
        '/webrtc'
      ],
    },
    transports: [
      webSockets(),
      tcp(),
      circuitRelayTransport({
        discoverRelays: 2
      }),
      webRTC({
        rtcConfiguration: {
          iceServers: [
            {
              // STUN servers help the browser discover its own public IPs
              urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'],
            },
          ],
        },
      }),
    ],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      // Allow private addresses for local testing
      denyDialMultiaddr: async () => false,
    },
    services: {
      identify: identify(),
      autoNat: autoNAT(),
    },
  })

  libp2p.addEventListener('self:peer:update', (event) => console.log(event.detail.peer.addresses))
  console.log(libp2p.peerId.toString())
  console.log(libp2p.getMultiaddrs())
}

main()
