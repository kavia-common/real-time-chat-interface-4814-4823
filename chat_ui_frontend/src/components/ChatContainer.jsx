import React, { useEffect, useMemo, useRef, useState } from 'react';
import ConnectionStatus from './ConnectionStatus';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { getHistory, healthcheck } from '../services/api';

/**
 * PUBLIC_INTERFACE
 * ChatContainer composes the chat UI:
 * - Header with title and connection status
 * - Scrollable message list with auto-scroll and jump-to-latest control
 * - Input area supporting Enter-to-send and Shift+Enter for newline
 * It integrates with WebSocket for realtime messages and optional REST for initial history and health.
 */
export default function ChatContainer() {
  const [messages, setMessages] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingMap, setPendingMap] = useState({}); // messageId -> pending/failed
  const listRef = useRef(null);

  const {
    status,
    send,
    reconnect,
    onMessage,
  } = useWebSocket();

  // Auto-scroll hook for message list
  const { atBottom, setListRef, scrollToBottom, onUserScroll } = useAutoScroll();

  // Attach ref to hook
  useEffect(() => {
    if (listRef.current) setListRef(listRef.current);
  }, [setListRef]);

  // Optional initial history fetch
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const hist = await getHistory();
        if (!cancelled && Array.isArray(hist)) {
          setMessages(hist.slice(-200)); // keep last 200
          // Scroll after initial render
          setTimeout(() => scrollToBottom(true), 0);
        }
      } catch (err) {
        // Non-fatal
        console.warn('History fetch failed:', err?.message);
      }
      try {
        // Optional health check
        await healthcheck();
      } catch (_err) { /* ignore */ }
    };
    load();
    return () => { cancelled = true; };
  }, [scrollToBottom]);

  // Handle incoming websocket events
  useEffect(() => {
    return onMessage((evt) => {
      try {
        if (!evt) return;
        if (evt.type === 'message/new' || evt.type === 'message') {
          const msg = evt.payload || evt.message || evt;
          setMessages(prev => {
            const next = prev.concat(msg);
            return next.slice(-200);
          });
          if (atBottom) scrollToBottom(false);
        } else if (evt.type === 'ack') {
          const ackId = evt.id || evt.messageId || evt.payload?.id;
          if (ackId) {
            setPendingMap(prev => {
              const cp = { ...prev };
              delete cp[ackId];
              return cp;
            });
          }
        } else if (evt.type === 'typing') {
          // placeholder for typing indicator, not rendered for now
        }
      } catch (e) {
        console.warn('WS event handling error', e);
      }
    });
  }, [onMessage, atBottom, scrollToBottom]);

  const connectionError = useMemo(() => {
    if (status === 'error') return 'Connection error. Please try reconnecting.';
    return '';
  }, [status]);

  useEffect(() => {
    setErrorMsg(connectionError);
  }, [connectionError]);

  const handleSend = async (text) => {
    // Optimistic message
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = {
      id,
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };
    setMessages(prev => prev.concat(optimistic).slice(-200));
    setPendingMap(prev => ({ ...prev, [id]: 'pending' }));

    const ok = await send({ type: 'message/new', payload: { id, text } });
    if (!ok) {
      // mark failed
      setPendingMap(prev => ({ ...prev, [id]: 'failed' }));
      setErrorMsg('Failed to send message. You may be offline.');
    } else {
      // leave pending until ack arrives
    }
    if (atBottom) scrollToBottom(false);
  };

  return (
    <div className="container">
      <div className="chat-shell" role="application" aria-label="Chat Interface">
        <div className="chat-header">
          <div className="chat-title" aria-label="Chat Header">
            <span className="accent" aria-hidden="true"></span>
            <div>
              <div>Ocean Chat</div>
              <div className="chat-subtitle">Real-time conversation</div>
            </div>
          </div>
          <div className="status-area">
            <ConnectionStatus status={status} onReconnect={reconnect} />
          </div>
        </div>

        {errorMsg ? (
          <div className="error-bar" role="status" aria-live="polite">
            {errorMsg}
          </div>
        ) : null}

        <div className="chat-body">
          <MessageList
            ref={listRef}
            messages={messages}
            pendingMap={pendingMap}
            atBottom={atBottom}
            onScroll={onUserScroll}
            onJumpToLatest={() => scrollToBottom(true)}
          />
          <div className="input-wrap">
            <MessageInput
              disabled={status !== 'connected'}
              onSend={handleSend}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
