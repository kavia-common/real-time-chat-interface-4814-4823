import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * useWebSocket handles the websocket lifecycle with:
 * - Auto-reconnect with backoff
 * - Send queueing while disconnected
 * - JSON event parsing and message subscription
 * Env:
 * - REACT_APP_WS_URL must be provided to enable WebSocket connectivity
 */
export function useWebSocket() {
  const url = process.env.REACT_APP_WS_URL;
  const [status, setStatus] = useState(url ? 'connecting' : 'disconnected');
  const wsRef = useRef(null);
  const sendQueueRef = useRef([]);
  const listenersRef = useRef(new Set());
  const backoffRef = useRef(500); // start 0.5s
  const reconnectTimerRef = useRef(null);
  const manualCloseRef = useRef(false);

  const notify = useCallback((evt) => {
    for (const cb of listenersRef.current) {
      try { cb(evt); } catch { /* noop */ }
    }
  }, []);

  const connect = useCallback(() => {
    if (!url) {
      setStatus('disconnected');
      return;
    }
    if (wsRef.current) return;
    manualCloseRef.current = false;
    try {
      setStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        backoffRef.current = 500; // reset backoff
        // flush queue
        const q = sendQueueRef.current.splice(0);
        q.forEach((item) => {
          try { ws.send(item); } catch { /* ignore */ }
        });
      };

      ws.onmessage = (ev) => {
        let data = null;
        try {
          data = JSON.parse(ev.data);
        } catch {
          data = { type: 'message/new', payload: { id: `s-${Date.now()}`, role: 'system', text: String(ev.data), createdAt: new Date().toISOString() } };
        }
        notify(data);
      };

      ws.onerror = () => {
        setStatus('error');
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (manualCloseRef.current) {
          setStatus('disconnected');
          return;
        }
        setStatus('disconnected');
        // schedule reconnect
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, 8000);
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => connect(), delay);
      };
    } catch {
      setStatus('error');
    }
  }, [notify, url]);

  useEffect(() => {
    connect();
    return () => {
      manualCloseRef.current = true;
      try { wsRef.current?.close(); } catch { /* noop */ }
      wsRef.current = null;
      clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  const send = useCallback(async (obj) => {
    const payload = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const ws = wsRef.current;
    if (status === 'connected' && ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
        return true;
      } catch {
        // fall through to queue
      }
    }
    // queue the payload, return false indicating not sent immediately
    sendQueueRef.current.push(payload);
    return false;
  }, [status]);

  const reconnect = useCallback(() => {
    manualCloseRef.current = false;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* noop */ }
    } else {
      connect();
    }
  }, [connect]);

  // PUBLIC_INTERFACE
  const onMessage = useCallback((cb) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  return {
    connectionStatus: status,
    status,
    send,
    onMessage,
    reconnect,
  };
}
