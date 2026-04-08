import { io, Socket } from 'socket.io-client';
import { getAdminSocketUrl } from './apiConfig';
import { getStoredAdminToken } from './authStorage';

const SOCKET_URL = getAdminSocketUrl();

let socket: Socket | null = null;

export function getAdminSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  const token = getStoredAdminToken();
  if (!token) return null;

  if (socket?.connected) return socket;

  if (socket && !socket.connected) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    // Polling first matches mobile app — works through more proxies than WS-only.
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Admin Socket] Connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[Admin Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Admin Socket] Connect error:', err.message);
  });

  return socket;
}

export function disconnectAdminSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Join a service request room for support chat oversight.
 * Admin can join any request:[id] room (backend allows admin role).
 * Returns a cleanup function that leaves the room and removes listeners; call it when closing the chat.
 */
export function joinRequestRoom(
  requestId: string,
  onMessage: (data: { requestId: string; text: string; sender: string; timestamp: string }) => void,
  onTyping?: (data: { requestId: string; userId: string; userName?: string; isTyping: boolean }) => void
): Promise<{ success: boolean; message?: string } | (() => void)> {
  const s = getAdminSocket();
  if (!s?.connected) {
    return Promise.resolve({ success: false, message: 'Not connected' });
  }

  return new Promise((resolve) => {
    const msgHandler = (data: { requestId?: string; text?: string; sender?: string; timestamp?: string }) => {
      if (data?.requestId === requestId && data?.text != null) {
        onMessage({
          requestId: data.requestId,
          text: data.text,
          sender: data.sender || '',
          timestamp: data.timestamp || new Date().toISOString(),
        });
      }
    };

    const typingHandler = onTyping
      ? (data: { requestId?: string; userId?: string; userName?: string; isTyping?: boolean }) => {
          if (data?.requestId === requestId) {
            onTyping({
              requestId: data.requestId || requestId,
              userId: data.userId || '',
              userName: data.userName,
              isTyping: Boolean(data.isTyping),
            });
          }
        }
      : undefined;

    s.on('new_message', msgHandler);
    if (typingHandler) s.on('is_typing', typingHandler);

    const cleanup = () => {
      s.off('new_message', msgHandler);
      if (typingHandler) s.off('is_typing', typingHandler);
      s.emit('leave_request_room', requestId);
    };

    s.emit('join_request_room', requestId, (ack: { success?: boolean; message?: string }) => {
      if (ack?.success) {
        resolve(cleanup);
      } else {
        s.off('new_message', msgHandler);
        if (typingHandler) s.off('is_typing', typingHandler);
        resolve({ success: false, message: ack?.message || 'Failed' });
      }
    });
  });
}
