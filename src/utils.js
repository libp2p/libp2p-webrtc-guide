import { WebRTC, WebSockets, WebSocketsSecure, WebTransport, Circuit } from '@multiformats/multiaddr-matcher'
import { protocols } from '@multiformats/multiaddr'
import { bootstrapPeers } from './constants'

export function getAddresses(libp2p) {
  return libp2p
    .getMultiaddrs()
    .map((ma) => {
      return `<li class="text-sm break-all"><button class="bg-teal-500 hover:bg-teal-700 text-white mx-2" onclick="navigator.clipboard.writeText('${ma.toString()}')">Copy</button>${ma.toString()}</li>`
    })
    .join('')
}
export function getPeerTypes(libp2p) {
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
export function getPeerDetails(libp2p) {
  return libp2p
    .getPeers()
    .map((peer) => {
      const peerConnections = libp2p.getConnections(peer)

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
      <span><code>${peer.toString()}</code>${nodeType.length > 0 ? `(${nodeType.join(', ')})` : ''}</span>
      <ul class="pl-6">${peerConnections
        .map((conn) => {
          return `<li class="break-all text-sm"><button class="bg-teal-500 hover:bg-teal-700 text-white px-2 mx-2 rounded focus:outline-none focus:shadow-outline" onclick="navigator.clipboard.writeText('${conn.remoteAddr.toString()}')">Copy</button>${conn.remoteAddr.toString()} </li>`
        })
        .join('')}</ul>
    </li>`
    })
    .join('')
}
export function update(element, newContent) {
  if (element.innerHTML !== newContent) {
    element.innerHTML = newContent
  }
}
