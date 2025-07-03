// @ts-check
import { createLibp2p } from 'libp2p'
import { identify } from '@libp2p/identify'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { multiaddr } from '@multiformats/multiaddr'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { webRTC } from '@libp2p/webrtc'
import { enable, disable } from '@libp2p/logger'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { PUBSUB_PEER_DISCOVERY } from './constants'
import { update, getPeerTypes, getAddresses, getPeerDetails } from './utils'
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'

const App = async () => {
  const libp2p = await createLibp2p({
    // addresses: {
    //   listen: [
    //     // 👇 Required to create circuit relay reservations in order to hole punch browser-to-browser WebRTC connections
    //     '/p2p-circuit',
    //     // 👇 Listen for webRTC connection
    //     '/webrtc',
    //   ],
    // },
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
      denyDialMultiaddr: async () => false,
    },
    peerDiscovery: [
      // bootstrap({
      //   list: [''],
      // }),
      // pubsubPeerDiscovery({
      //   interval: 10_000,
      //   topics: [PUBSUB_PEER_DISCOVERY],
      // }),
    ],
    services: {
      // pubsub: gossipsub(),
      identify: identify(),
    },
  })

  globalThis.libp2p = libp2p

  const DOM = {
    nodePeerId: () => document.getElementById('output-node-peer-id'),
    nodeStatus: () => document.getElementById('output-node-status'),
    nodePeerCount: () => document.getElementById('output-peer-count'),
    nodePeerTypes: () => document.getElementById('output-peer-types'),
    nodePeerDetails: () => document.getElementById('output-peer-details'),
    nodeAddressCount: () => document.getElementById('output-address-count'),
    nodeAddresses: () => document.getElementById('output-addresses'),

    inputMultiaddr: () => document.getElementById('input-multiaddr'),
    connectButton: () => document.getElementById('button-connect'),
    loggingButtonEnable: () => document.getElementById('button-logging-enable'),
    loggingButtonDisable: () => document.getElementById('button-logging-disable'),
    outputQuery: () => document.getElementById('output'),
  }

  update(DOM.nodePeerId(), libp2p.peerId.toString())
  update(DOM.nodeStatus(), 'Online')

  libp2p.addEventListener('peer:connect', (event) => {})
  libp2p.addEventListener('peer:disconnect', (event) => {})

  setInterval(() => {
    update(DOM.nodePeerCount(), libp2p.getConnections().length)
    update(DOM.nodePeerTypes(), getPeerTypes(libp2p))
    update(DOM.nodeAddressCount(), libp2p.getMultiaddrs().length)
    update(DOM.nodeAddresses(), getAddresses(libp2p))
    update(DOM.nodePeerDetails(), getPeerDetails(libp2p))
  }, 1000)

  DOM.loggingButtonEnable().onclick = (e) => {
    enable('*,*:debug')
  }
  DOM.loggingButtonDisable().onclick = (e) => {
    disable()
  }

  DOM.connectButton().onclick = async (e) => {
    e.preventDefault()
    let maddr = multiaddr(DOM.inputMultiaddr().value)

    console.log(maddr)
    try {
      await libp2p.dial(maddr)
    } catch (e) {
      console.log(e)
    }
  }
}

App().catch((err) => {
  console.error(err) // eslint-disable-line no-console
})
