package main

import (
	"context"
	"log"

	"github.com/libp2p/go-libp2p"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	relayv2 "github.com/libp2p/go-libp2p/p2p/protocol/circuitv2/relay"
	quicTransport "github.com/libp2p/go-libp2p/p2p/transport/quic"
	webrtc "github.com/libp2p/go-libp2p/p2p/transport/webrtc"
	webtransport "github.com/libp2p/go-libp2p/p2p/transport/webtransport"
)

// Topic used to broadcast browser WebRTC addresses
const PubSubDiscoveryTopic string = "browser-peer-discovery"

func main() {

	ctx := context.Background()

	// load our private key to generate the same peerID each time
	privk, err := LoadIdentity("identity.key")
	if err != nil {
		panic(err)
	}

	var opts []libp2p.Option

	opts = append(opts,
		libp2p.Identity(privk),
		libp2p.Transport(quicTransport.NewTransport),
		libp2p.Transport(webtransport.New),
		libp2p.Transport(webrtc.New),
		libp2p.ListenAddrStrings("/ip4/0.0.0.0/udp/9095/quic-v1", "/ip4/0.0.0.0/udp/9095/quic-v1/webtransport"),
		// 👇 webrtc-direct cannot listen on the same port as QUIC or WebTransport
		libp2p.ListenAddrStrings("/ip4/0.0.0.0/udp/9096/webrtc-direct"),
		// libp2p.ListenAddrStrings("/ip6/::/udp/9095/quic-v1", "/ip6/::/udp/9095/quic-v1/webtransport"),
	)

	// libp2p.New constructs a new libp2p Host. Other options can be added
	// here.
	host, err := libp2p.New(opts...)
	if err != nil {
		panic(err)
	}

	_, err = relayv2.New(host)
	if err != nil {
		panic(err)
	}

	// create a new PubSub service using the GossipSub router
	ps, err := pubsub.NewGossipSub(ctx, host)
	if err != nil {
		panic(err)
	}

	// join the pubsub chatTopic
	discoveryTopic, err := ps.Join(PubSubDiscoveryTopic)
	if err != nil {
		panic(err)

	}
	_, err = discoveryTopic.Subscribe()
	if err != nil {
		panic(err)
	}

	log.Printf("PeerID: %s", host.ID().String())

	for _, addr := range host.Addrs() {
		log.Printf("Listening on: %s/p2p/%s\n", addr.String(), host.ID())
	}

	select {}

}
