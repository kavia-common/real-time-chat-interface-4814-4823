import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import { useWebSocket } from './hooks/useWebSocket';
import { getEnvSummary } from './utils/env';

// Shape of server messages assumed for example:
// - Inbound chat message: { type: 'message', id: '...', sender: 'server'|'me'|<id>, content: '...', timestamp: number }
// - Ack for sent message: { type: 'ack', clientId: 'temp-uuid', id: 'server-id', timestamp: number }
// - Optional system events: { type: 'system', content: '...', timestamp: number }

const DEFAULT_TITLE = 'Support Chat';

// PUBLIC_INTERFACE
function App() {
  /** Root application component composing header, message list, and input with WebSocket integration. */
  const [theme, setTheme] = useState('light');

  // a naive current user id for demo; in real apps derive from auth/user profile
  const [currentUser] = useState(() => ({
    id: 'me',
    name: 'You',
    avatarText: 'ME',
  }));

  // message model internal: { id, clientId?, sender, content, timestamp, name?, avatarText?, pending?:boolean, error?:string }
  const [messages, setMessages] = useState([]);

  // Map of clientId -> index in messages for quick optimistic ack reconciliation
  const pendingIndexRef = useRef(new Map());

  // Apply theme to document for CSS vars
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Initialize with a friendly welcome message so UI isn’t empty
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      const now = Date.now();
      return [
        {
          id: 'welcome-1',
          sender: 'other',
          name: 'Assistant',
          avatarText: 'AI',
          content: 'Welcome! Ask me anything to get started.',
          timestamp: now,
        },
      ];
    });
  }, []);

  // Setup WebSocket
  const { status, connected, connecting, send, lastMessage } = useWebSocket({
    // url resolved inside hook via env utils
    autoConnect: true,
    shouldReconnect: true,
    onMessage: ({ data }) => {
      // Additional handler over lastMessage state if needed; we primarily use lastMessage effect below
      // No-op here; logic centralized in useEffect listening on lastMessage
    },
  });

  // Inbound message handling (server -> client)
  useEffect(() => {
    if (!lastMessage) return;

    // If the server sends plain text, wrap as a message
    if (typeof lastMessage === 'string') {
      const now = Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: `srv-${now}`,
          sender: 'other',
          name: 'Assistant',
          avatarText: 'AI',
          content: lastMessage,
          timestamp: now,
        },
      ]);
      return;
    }

    // If JSON object with types
    if (typeof lastMessage === 'object' && lastMessage !== null) {
      const payload = lastMessage;

      // ACK: reconcile optimistic message
      if (payload.type === 'ack' && payload.clientId) {
        const serverId = payload.id || payload.serverId || payload.messageId;
        const ts = payload.timestamp || Date.now();

        setMessages((prev) => {
          const map = pendingIndexRef.current;
          const idx = map.get(payload.clientId);
          if (idx == null) {
            // Unknown clientId: append as new message to avoid losing content
            return [
              ...prev,
              {
                id: serverId || `srv-${ts}`,
                sender: currentUser.id,
                content: payload.content || '(sent)',
                timestamp: ts,
                name: currentUser.name,
                avatarText: currentUser.avatarText,
              },
            ];
          }
          const next = [...prev];
          const existing = next[idx];
          next[idx] = {
            ...existing,
            id: serverId || existing.id,
            pending: false,
            timestamp: ts || existing.timestamp,
          };
          // remove from pending map
          map.delete(payload.clientId);
          return next;
        });
        return;
      }

      // Chat message from server or another user
      if (payload.type === 'message' || (payload.content && payload.sender)) {
        const ts = payload.timestamp || Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: payload.id || `srv-${ts}`,
            sender: payload.sender || 'other',
            name: payload.name || (payload.sender === 'me' ? currentUser.name : 'Assistant'),
            avatarText: payload.avatarText || (payload.sender === 'me' ? currentUser.avatarText : 'AI'),
            content: payload.content || '',
            timestamp: ts,
          },
        ]);
        return;
      }

      // System or unknown type: render as system/other message
      if (payload.type === 'system' || payload.info || payload.notice) {
        const content = payload.content || payload.info || payload.notice || 'System update';
        const ts = payload.timestamp || Date.now();
        setMessages((prev) => [
          ...prev,
          {
            id: payload.id || `sys-${ts}`,
            sender: 'other',
            name: 'System',
            avatarText: 'SYS',
            content,
            timestamp: ts,
          },
        ]);
        return;
      }
    }
  }, [lastMessage, currentUser]);

  // PUBLIC_INTERFACE
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // PUBLIC_INTERFACE
  const handleSend = useCallback(
    (text) => {
      // Create optimistic message with temporary clientId
      const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();
      const optimistic = {
        id: clientId,
        clientId,
        sender: currentUser.id,
        name: currentUser.name,
        avatarText: currentUser.avatarText,
        content: text,
        timestamp: now,
        pending: true,
      };

      // Add to list and register in pending map
      setMessages((prev) => {
        const next = [...prev, optimistic];
        pendingIndexRef.current.set(clientId, next.length - 1);
        return next;
      });

      // Try to send via WebSocket; server should ack with { type:'ack', clientId, id, timestamp }
      const payload = {
        type: 'message',
        clientId,
        sender: currentUser.id,
        content: text,
        timestamp: now,
        meta: {
          env: getEnvSummary().nodeEnv,
        },
      };

      const queuedOrSent = send(payload);

      // If not connected, queuedOrSent may be false but the hook queues until open.
      // We keep the optimistic message. If the socket eventually fails with no ack,
      // user still sees their message; future UX improvements could add retry/error state.
      if (!queuedOrSent && !connecting && !connected) {
        // Optionally mark as "queued" visually by leaving pending=true
      }
    },
    [currentUser, send, connected, connecting]
  );

  const statusLabel = useMemo(() => {
    if (connecting) return 'connecting';
    if (connected) return 'connected';
    return 'disconnected';
  }, [connecting, connected]);

  // Layout styles
  const styles = {
    app: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-primary, #f9fafb)',
      color: 'var(--text-primary, #111827)',
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      maxWidth: 960,
      margin: '0 auto',
      height: '100%',
      boxSizing: 'border-box',
      borderLeft: '1px solid var(--border-color, #e5e7eb)',
      borderRight: '1px solid var(--border-color, #e5e7eb)',
      background: 'var(--surface, #ffffff)',
    },
    listWrap: {
      flex: 1,
      minHeight: 0,
    },
  };

  return (
    <div className="App" style={styles.app}>
      <div style={styles.body}>
        <ChatHeader
          title={DEFAULT_TITLE}
          subtitle={connected ? 'Online' : connecting ? 'Connecting…' : 'Offline'}
          status={statusLabel}
          onToggleTheme={toggleTheme}
          currentTheme={theme}
          showAvatar
          avatarText="AI"
        />

        <div style={styles.listWrap}>
          <MessageList messages={messages} currentUserId={currentUser.id} />
        </div>

        <MessageInput
          onSend={handleSend}
          disabled={!connected}
          placeholder={connected ? 'Type a message' : 'Connecting…'}
          autoFocus
        />
      </div>
    </div>
  );
}

export default App;
