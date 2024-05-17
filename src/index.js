// @ts-check
import { WebRTC, WebSockets, WebSocketsSecure, WebTransport, Circuit } from '@multiformats/multiaddr-matcher'
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { createLibp2p } from 'libp2p'
import { identify } from '@libp2p/identify'
import { peerIdFromString } from '@libp2p/peer-id'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
// import { Multiaddr } from '@multiformats/multiaddr'
import { sha256 } from 'multiformats/hashes/sha2'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { protocols } from '@multiformats/multiaddr'
import prettyMs from 'pretty-ms'

// peer ids of known bootstrap nodes
const bootstrapPeers = [
  'QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  'QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
  'QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
  'QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
  'QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
  'QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp',
]

// let queryController = new AbortController()

const App = async () => {
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
    // queryButton: () => document.getElementById('button-run-query'),
    outputQuery: () => document.getElementById('output-query'),
  }

  const libp2p = await createLibp2p({
    addresses: {
      listen: [
        // 👇 Listen for webRTC connection
        // '/webrtc',
      ],
    },
    transports: [
      webSockets(),
      webTransport(),
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
      // 👇 Required to create circuit relay reservations in order to hole punch browser-to-browser WebRTC connections
      circuitRelayTransport({
        // When set to >0, this will look up the rendezvous CID in order to discover circuit relay peers it can create a reservation with
        discoverRelays: 0,
      }),
    ],
    connectionManager: {
      maxConnections: 30,
      minConnections: 5,
    },
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    peerDiscovery: [
      // pubsubPeerDiscovery({
      //   interval: 10_000,
      //   topics: [PUBSUB_PEER_DISCOVERY],
      //   listenOnly: false,
      // }),
      bootstrap({
      //   // The app-specific go and rust bootstrappers use WebTransport and WebRTC-direct which have ephemeral multiadrrs
      //   // that are resolved above using the delegated routing API
        list: [
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
      //     '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
        ],
      }),
    ],
    services: {
      pubsub: gossipsub({
        allowPublishToZeroTopicPeers: true,
        ignoreDuplicatePublishError: true,
      }),
      // // Delegated routing helps us discover the ephemeral multiaddrs of the dedicated go and rust bootstrap peers
      // // This relies on the public delegated routing endpoint https://docs.ipfs.tech/concepts/public-utilities/#delegated-routing
      // delegatedRouting: () => delegatedClient,
      identify: identify(),
    },
  })

  update(DOM.nodePeerId(), libp2p.peerId.toString())
  update(DOM.nodeStatus(), 'Starting')



  // libp2p.addEventListener('peer:connect', (event) => { })
  // libp2p.addEventListener('peer:disconnect', (event) => { })

  DOM.nodeStatus().innerText = 'Online'

  setInterval(() => {
    update(DOM.nodePeerCount(), libp2p.getConnections().length)
    update(DOM.nodePeerTypes(), getPeerTypes(libp2p))
    update(DOM.nodeAddressCount(), libp2p.getMultiaddrs().length)
    update(DOM.nodeAddresses(), getAddresses(libp2p))
    update(DOM.nodePeerDetails(), getPeerDetails(libp2p))
  }, 1000)

  DOM.connectButton().onclick = async (e) => {
    e.preventDefault()
    const multiaddr = DOM.inputMultiaddr().value

    libp2p.dial(multiaddr)
    
  }
}

App().catch((err) => {
  console.error(err) // eslint-disable-line no-console
})

function getAddresses(libp2p) {
  return libp2p
    .getMultiaddrs()
    .map(
      (ma) =>
        `<li>${ma.toString()} <button onclick="navigator.clipboard.writeText('${ma.toString()}')">Copy</button></li>`,
    )
    .join('')
}

function getPeerTypes(libp2p) {
  const types = {
    'Circuit Relay': 0,
    WebRTC: 0,
    WebSockets: 0,
    'WebSockets (secure)': 0,
    WebTransport: 0,
    Other: 0,
  }

  libp2p
    .getConnections()
    .map((conn) => conn.remoteAddr)
    .forEach((ma) => {
      if (WebRTC.exactMatch(ma) || ma.toString().includes('/webrtc/')) {
        types['WebRTC']++
      } else if (WebSockets.exactMatch(ma)) {
        types['WebSockets']++
      } else if (WebSocketsSecure.exactMatch(ma)) {
        types['WebSockets (secure)']++
      } else if (WebTransport.exactMatch(ma)) {
        types['WebTransport']++
      } else if (Circuit.exactMatch(ma)) {
        types['Circuit Relay']++
      } else {
        types['Other']++
        console.info('wat', ma.toString())
      }
    })

  return Object.entries(types)
    .map(([name, count]) => `<li>${name}: ${count}</li>`)
    .join('')
}

function getPeerDetails(libp2p) {
  return libp2p
    .getPeers()
    .map((peer) => {
      const ping = pings[peer.toString()]
      let pingOutput = 'Ping RTT: ...measuring<br/>Last measured: 0s ago'

      if (ping != null && ping.latency > -1) {
        pingOutput = `Ping RTT: ${ping.latency}ms<br/>Last measured: ${Math.round(
          (Date.now() - ping.lastPing) / 1000,
        )}s ago`
      }

      const peerConnections = libp2p.getConnections(peer)

      pingOutput += `<br>Connection age: ${prettyMs(Date.now() - peerConnections[0].timeline.open)}`

      let nodeType = []

      // detect if this is a bootstrap node
      if (bootstrapPeers.includes(peer.toString())) {
        nodeType.push('bootstrap')
      }

      const relayMultiaddrs = libp2p.getMultiaddrs().filter((ma) => Circuit.exactMatch(ma))
      const relayPeers = relayMultiaddrs.map((ma) => {
        return ma
          .stringTuples()
          .filter(([name, _]) => name === protocols('p2p').code)
          .map(([_, value]) => value)[0]
      })

      // detect if this is a relay we have a reservation on
      if (relayPeers.includes(peer.toString())) {
        nodeType.push('relay')
      }

      return `<li>
      <h4>${peer.toString()} <button onclick="navigator.clipboard.writeText('${peer.toString()}')">Copy</button> ${
        nodeType.length > 0 ? `(${nodeType.join(', ')})` : ''
      }</h4>
      <p>${pingOutput}</p>
      <ul>${peerConnections
        .map((conn) => {
          return `<li>${conn.remoteAddr.toString()} <button onclick="navigator.clipboard.writeText('${conn.remoteAddr.toString()}')">Copy</button></li>`
        })
        .join('')}</ul>
    </li>`
    })
    .join('')
}

function update(element, newContent) {
  if (element.innerHTML !== newContent) {
    element.innerHTML = newContent
  }
}
