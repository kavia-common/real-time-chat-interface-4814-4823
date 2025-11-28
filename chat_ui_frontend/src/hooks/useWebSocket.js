import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWsUrl } from "../utils/env";

/**
 * WebSocket connection status values.
 * - 'connecting' -> attempting to connect
 * - 'connected' -> open and ready
 * - 'disconnected' -> closed; will not reconnect unless reconnect is enabled
 */
const STATUS = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
};

/**
 * Compute delay with exponential backoff and jitter.
 * backoff = baseDelayMs * 2^(attempt - 1), clamped to maxDelayMs, with +/- 20% jitter.
 * @param {number} attempt 1-based attempt number
 * @param {number} baseDelayMs
 * @param {number} maxDelayMs
 * @returns {number} delay in ms
 */
function computeBackoffDelay(attempt, baseDelayMs, maxDelayMs) {
  const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)));
  const jitterFactor = 0.2;
  const jitter = exp * jitterFactor * (Math.random() * 2 - 1); // +/- 20%
  return Math.max(0, Math.min(maxDelayMs, Math.floor(exp + jitter)));
}

/**
 * Safely parse incoming WebSocket message data as JSON, falling back to raw text.
 * @param {any} data
 * @returns {{raw: any, json: any, text: string|null}}
 */
function safeParseInbound(data) {
  // Browser WS .data can be string, Blob, ArrayBuffer. We primarily handle string.
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return { raw: data, json: parsed, text: null };
    } catch {
      return { raw: data, json: null, text: data };
    }
  }
  // For non-string payloads, return as raw, and no json/text
  return { raw: data, json: null, text: null };
}

/**
 * PUBLIC_INTERFACE
 * useWebSocket
 * A reusable React hook to manage a WebSocket connection with reconnects.
 *
 * Options:
 * - url: string (optional) -> if not provided, uses getWsUrl()
 * - autoConnect: boolean (default true) -> connect on mount
 * - shouldReconnect: boolean (default true) -> whether to automatically reconnect on close/error
 * - maxRetries: number (default Infinity) -> maximum reconnection attempts
 * - backoff: { baseDelayMs?: number, maxDelayMs?: number } -> backoff tuning
 * - protocols: string | string[] (optional) -> optional WebSocket subprotocol(s)
 * - onMessage: function(eventObj) (optional) -> called with parsed message
 * - onOpen: function(event) (optional)
 * - onClose: function(event) (optional)
 * - onError: function(event) (optional)
 *
 * Returns:
 * {
 *   status: 'connecting' | 'connected' | 'disconnected',
 *   connected: boolean,
 *   connecting: boolean,
 *   disconnected: boolean,
 *   send: (msgObjOrString) => boolean, // returns true if queued/sent successfully
 *   connect: () => void,
 *   disconnect: (options?: { code?: number, reason?: string, preventReconnect?: boolean }) => void,
 *   lastMessage: any, // last parsed message payload (json if possible, else text/raw)
 *   lastEvent: MessageEvent | null, // original message event
 *   attempts: number, // current reconnect attempt number (0 when connected or initial)
 *   url: string, // resolved websocket URL
 * }
 */
export function useWebSocket(options = {}) {
  const {
    url: explicitUrl,
    autoConnect = true,
    shouldReconnect = true,
    maxRetries = Infinity,
    backoff = { baseDelayMs: 500, maxDelayMs: 15_000 },
    protocols,
    onMessage,
    onOpen,
    onClose,
    onError,
  } = options;

  const resolvedUrl = useMemo(() => explicitUrl || getWsUrl(), [explicitUrl]);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);
  const attemptsRef = useRef(0);
  const outboundQueueRef = useRef([]); // queue messages while connecting

  const [status, setStatus] = useState(STATUS.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const [attempts, setAttempts] = useState(0);

  const connecting = status === STATUS.CONNECTING;
  const connected = status === STATUS.CONNECTED;
  const disconnected = status === STATUS.DISCONNECTED;

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const cleanupSocket = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try {
      // Close gracefully if not already closed
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, "Client cleanup");
      }
    } catch {
      // ignore
    }
    wsRef.current = null;
  }, []);

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (outboundQueueRef.current.length > 0) {
      const payload = outboundQueueRef.current.shift();
      try {
        ws.send(payload);
      } catch {
        // If sending fails, stop flushing and re-queue the payload to the front
        outboundQueueRef.current.unshift(payload);
        break;
      }
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!shouldReconnect) return;
    if (manualCloseRef.current) return;

    const nextAttempt = attemptsRef.current + 1;
    if (nextAttempt > maxRetries) {
      setStatus(STATUS.DISCONNECTED);
      return;
    }

    attemptsRef.current = nextAttempt;
    setAttempts(nextAttempt);

    const baseDelay = backoff?.baseDelayMs ?? 500;
    const maxDelay = backoff?.maxDelayMs ?? 15000;
    const delay = computeBackoffDelay(nextAttempt, baseDelay, maxDelay);

    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => {
      connect(); // eslint-disable-line no-use-before-define
    }, delay);
  }, [shouldReconnect, maxRetries, backoff]);

  // PUBLIC_INTERFACE
  const connect = useCallback(() => {
    // Reset manualClose since this is a fresh connect
    manualCloseRef.current = false;

    // If an existing socket exists, clean it up before reconnecting
    cleanupSocket();
    clearReconnectTimer();

    setStatus(STATUS.CONNECTING);

    try {
      const ws = new WebSocket(resolvedUrl, protocols);
      wsRef.current = ws;

      ws.onopen = (event) => {
        attemptsRef.current = 0;
        setAttempts(0);
        setStatus(STATUS.CONNECTED);
        if (typeof onOpen === "function") {
          try { onOpen(event); } catch { /* ignore handler errors */ }
        }
        // flush queued messages
        flushQueue();
      };

      ws.onmessage = (event) => {
        const parsed = safeParseInbound(event.data);
        setLastEvent(event);
        setLastMessage(parsed.json ?? parsed.text ?? parsed.raw);
        if (typeof onMessage === "function") {
          try {
            onMessage({
              event,
              data: parsed.json ?? parsed.text ?? parsed.raw,
              parsed,
            });
          } catch {
            // ignore handler errors
          }
        }
      };

      ws.onerror = (event) => {
        if (typeof onError === "function") {
          try { onError(event); } catch { /* ignore handler errors */ }
        }
        // Note: onerror does not close the socket; wait for onclose or force reconnect
      };

      ws.onclose = (event) => {
        setStatus(STATUS.DISCONNECTED);
        if (typeof onClose === "function") {
          try { onClose(event); } catch { /* ignore handler errors */ }
        }
        cleanupSocket();

        // Decide about reconnect
        if (!manualCloseRef.current && shouldReconnect) {
          scheduleReconnect();
        }
      };
    } catch (err) {
      // Immediate failure creating the socket: schedule a reconnect
      setStatus(STATUS.DISCONNECTED);
      scheduleReconnect();
    }
  }, [resolvedUrl, protocols, onOpen, onMessage, onError, onClose, scheduleReconnect, cleanupSocket, flushQueue]);

  // PUBLIC_INTERFACE
  const disconnect = useCallback((opts = {}) => {
    const { code = 1000, reason = "Client disconnect", preventReconnect = true } = opts;
    manualCloseRef.current = !!preventReconnect; // prevent auto reconnect if true
    clearReconnectTimer();

    const ws = wsRef.current;
    if (ws) {
      try {
        ws.close(code, reason);
      } catch {
        // ignore
      }
    }
    cleanupSocket();
    setStatus(STATUS.DISCONNECTED);
  }, [cleanupSocket]);

  // PUBLIC_INTERFACE
  const send = useCallback((msg) => {
    const ws = wsRef.current;
    let payload;
    if (typeof msg === "string") {
      payload = msg;
    } else {
      try {
        payload = JSON.stringify(msg);
      } catch {
        // Non-serializable object - reject
        return false;
      }
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
        return true;
      } catch {
        // If sending fails while open, queue and try later
        outboundQueueRef.current.push(payload);
        return false;
      }
    }

    // Not open yet: queue the message for when we connect
    outboundQueueRef.current.push(payload);
    // Trigger connect if not already connecting/connected
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      if (!manualCloseRef.current) {
        connect();
      }
    }
    return false;
  }, [connect]);

  // Auto connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      // Cleanup on unmount
      clearReconnectTimer();
      manualCloseRef.current = true; // prevent reconnects on unmount
      cleanupSocket();
    };
    // We intentionally do not include connect in deps to avoid re-connecting on prop changes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, resolvedUrl, protocols]);

  return {
    status,
    connected,
    connecting,
    disconnected,
    send,
    connect,
    disconnect,
    lastMessage,
    lastEvent,
    attempts,
    url: resolvedUrl,
  };
}

export default useWebSocket;
