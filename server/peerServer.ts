/**
 * Tiny self-hosted PeerServer bootstrap for HOLLOWMERE's LAN-only signaling.
 *
 * Runs a PeerServer (from the `peer` npm package) on port 9000. This is the
 * *signaling* server only — it brokers the initial WebRTC offer/answer
 * handshake between two browsers. All real-time gameplay data flows
 * directly peer-to-peer over the WebRTC data channel once connected;
 * no game data touches this server.
 *
 * Run via:  npm run server
 * (The Vite dev server also starts one internally via vite.config.ts,
 *  so you usually don't need to run this separately during development.)
 */
import { PeerServer } from 'peer';

const PORT = 9000;

const peerServer = PeerServer({
  port: PORT,
  path: '/',
  // Keep everything local/LAN — no public cloud broker, no key management.
  key: 'hollowmere',
  cleanupOutMess: true,
  alive_timeout: 60000,
});

peerServer.on('connection', (client) => {
  // eslint-disable-next-line no-console
  console.log(`[PeerServer] peer connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  // eslint-disable-next-line no-console
  console.log(`[PeerServer] peer disconnected: ${client.getId()}`);
});

// eslint-disable-next-line no-console
console.log(`[PeerServer] signaling server listening on http://0.0.0.0:${PORT}`);