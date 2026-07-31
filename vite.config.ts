import { defineConfig, type PluginOption } from 'vite';
import { PeerServer } from 'peer';

/**
 * Vite plugin that boots a self-hosted PeerServer (from the `peer` npm package)
 * as middleware on port 9000, alongside the Vite dev server on port 5173.
 *
 * This is the *signaling* server only — it brokers the initial WebRTC
 * offer/answer handshake between browsers. All real-time gameplay data
 * flows directly peer-to-peer over the WebRTC data channel. No internet
 * access required, LAN only.
 *
 * Integrating the PeerServer into Vite (rather than a separate process)
 * means a single `npm run dev` starts everything. The `npm run server`
 * script exists as a standalone fallback but is normally not needed.
 */
function peerServerPlugin(): PluginOption {
  return {
    name: 'hollowmere-peer-server',
    configureServer() {
      const peerServer = PeerServer({
        port: 9000,
        path: '/',
        key: 'hollowmere',
        cleanupOutMess: true,
        alive_timeout: 60000,
      });
      peerServer.on('connection', (client) => {
        console.log(`[PeerServer] peer connected: ${client.getId()}`);
      });
      peerServer.on('disconnect', (client) => {
        console.log(`[PeerServer] peer disconnected: ${client.getId()}`);
      });
      console.log('[PeerServer] signaling server listening on http://0.0.0.0:9000');
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [peerServerPlugin()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});