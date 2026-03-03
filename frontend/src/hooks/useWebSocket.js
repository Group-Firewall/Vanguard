/**
 * useWebSocket — generic auto-reconnecting WebSocket hook.
 *
 * Usage
 * -----
 *   const { lastMessage, readyState } = useWebSocket('/ws/packets')
 *
 * Props
 * -----
 * @param {string} path  - WebSocket path relative to the backend host,
 *                         e.g. '/ws/packets'.  A full ws:// URL is also accepted.
 * @param {Function} onMessage - Optional callback invoked with the parsed JSON
 *                               payload on every incoming message.
 *
 * Returns
 * -------
 * @returns {{ lastMessage: object|null, readyState: number }}
 *   lastMessage  - The most recently received parsed JSON object, or null.
 *   readyState   - One of the WebSocket readyState constants (0-3).
 */

import { useState, useEffect, useRef, useCallback } from "react";

// Back-off delays between reconnect attempts (ms)
const RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000];

/**
 * Build an absolute WebSocket URL from a path or full URL string.
 * Uses wss: when the page is served over https:.
 */
function buildWsUrl(path) {
  if (path.startsWith("ws://") || path.startsWith("wss://")) return path;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  return `${protocol}//${host}:8000${path}`;
}

function useWebSocket(path, onMessage) {
  const [lastMessage, setLastMessage] = useState(null);
  const [readyState, setReadyState] = useState(WebSocket.CONNECTING);

  // Persist refs across renders without triggering re-renders
  const wsRef = useRef(null);
  const attemptRef = useRef(0);
  const timeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const onMessageRef = useRef(onMessage);

  // Keep the callback ref up to date without causing reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const url = buildWsUrl(path);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      attemptRef.current = 0;
      setReadyState(WebSocket.OPEN);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        onMessageRef.current?.(data);
      } catch {
        // Non-JSON frames are silently ignored
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setReadyState(WebSocket.CLOSED);

      // Exponential back-off reconnect
      const delay =
        RECONNECT_DELAYS[
          Math.min(attemptRef.current, RECONNECT_DELAYS.length - 1)
        ];
      attemptRef.current += 1;
      timeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onerror is always followed by onclose, so reconnect happens there
      setReadyState(WebSocket.CLOSING);
    };

    setReadyState(WebSocket.CONNECTING);
  }, [path]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutRef.current);

      if (wsRef.current) {
        wsRef.current.onclose = null;
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close();
        }
      }
    };
  }, [connect]);

  return { lastMessage, readyState };
}

export default useWebSocket;
