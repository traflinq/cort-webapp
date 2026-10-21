import { io, type Socket } from "socket.io-client";

let shared: Socket | null = null;
let shared_token: string | null = null;
let refs = 0;

/**
 * Ref-counted `/rides` socket shared by every admin consumer, so one tab keeps one websocket.
 * Callers attach their own listeners and must call `release` (and `socket.off` their handlers) on cleanup.
 */
export function acquireRidesSocket(token: string): { socket: Socket; release: () => void } {
  if (shared && shared_token !== token) {
    shared.disconnect();
    shared = null;
  }
  if (!shared) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    shared = io(`${apiUrl}/rides`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
    });
    shared_token = token;
  }
  refs += 1;
  const socket = shared;
  let released = false;
  return {
    socket,
    release: () => {
      if (released) return;
      released = true;
      refs -= 1;
      if (refs <= 0 && shared === socket) {
        socket.disconnect();
        shared = null;
        shared_token = null;
        refs = 0;
      }
    },
  };
}
