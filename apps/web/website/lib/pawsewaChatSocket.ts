import { io, Socket } from 'socket.io-client';
import { apiBaseIncludesNgrok, getSocketUrlFromApiBase } from './getSocketUrl';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function disconnectChatSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  currentToken = null;
}

/**
 * Singleton Socket.io client: JWT auth, websocket-only (ngrok-friendly), same origin as mobile.
 */
export function getOrCreateChatSocket(token: string): Socket {
  if (typeof window === 'undefined') {
    throw new Error('Socket is browser-only');
  }
  const url = getSocketUrlFromApiBase();
  if (socket && currentToken !== token) {
    disconnectChatSocket();
  }
  if (socket?.connected && currentToken === token) {
    return socket;
  }

  currentToken = token;
  socket?.disconnect();

  const useNgrokHeader = apiBaseIncludesNgrok();
  socket = io(url, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    timeout: 60_000,
    ...(useNgrokHeader
      ? { extraHeaders: { 'ngrok-skip-browser-warning': 'true' } }
      : {}),
  });

  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('[WEB-SYNC] Socket connected (transport=websocket).');
  });

  return socket;
}

export function getExistingSocket(): Socket | null {
  return socket;
}

export function joinRoom(
  s: Socket,
  conversationId: string,
  userId: string,
): Promise<{ success: boolean; threadType?: string; message?: string }> {
  return new Promise((resolve) => {
    s.emit('join_room', { conversationId }, (ack: Record<string, unknown>) => {
      const ok = ack?.success === true;
      if (ok) {
        // eslint-disable-next-line no-console
        console.log(`[WEB-SYNC] Socket connected. Room joined for User: ${userId}.`);
      }
      resolve({
        success: ok,
        threadType: typeof ack?.threadType === 'string' ? ack.threadType : undefined,
        message: typeof ack?.message === 'string' ? ack.message : undefined,
      });
    });
  });
}
