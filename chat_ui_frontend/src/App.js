import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import { useWebSocket } from './hooks/useWebSocket';
import { getEnvSummary, getApiBase } from './utils/env';

// Shape of server messages assumed for example:
// - Inbound chat message: { type: 'message', id: '...', sender: 'server'|'me'|<id>, content: '...', timestamp: number }
// - Ack for sent message: { type: 'ack', clientId: 'temp-uuid', id: 'server-id', timestamp: number }
// - Optional system events: { type: 'system', content: '...', timestamp: number }

const DEFAULT_TITLE = 'Support Chat';

/**
 * Lightweight recent-history fetcher
 * Attempts GET on `${apiBase}/messages` then falls back to `${apiBase}/api/messages`.
 * Maps unknown schema to {id,sender,content,timestamp,name,avatarText}.
 * Returns an array or [] on any error.
 */
async function fetchRecentMessagesSafe() {
  const apiBase = getApiBase();
  if (!apiBase) return [];
  const candidates = [`${apiBase}/messages`, `${apiBase}/api/messages`];

  // Helper: normalize one item
  const toMessage = (item, index) => {
    if (!item || typeof item !== 'object') {
      return {
        id: `hist-${Date.now()}-${index}`,
        sender: 'other',
        content: String(item ?? ''),
        timestamp: Date.now(),
        name: 'Assistant',
        avatarText: 'AI',
      };
    }
    const id = item.id ?? item._id ?? item.uuid ?? `hist-${Date.now()}-${index}`;
    const content = item.content ?? item.message ?? item.text ?? '';
    const sender = item.sender ?? item.role ?? (item.user === 'me' ? 'me' : 'other') ?? 'other';
    const timestamp = item.timestamp ?? item.createdAt ?? item.time ?? Date.now();
    const name = item.name ?? (sender === 'me' ? 'You' : 'Assistant');
    const avatarText = item.avatarText ?? (sender === 'me' ? 'ME' : 'AI');
    return { id, sender, content, timestamp, name, avatarText };
  };

  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (!data) continue;

      // Accept arrays, or {messages: [...]}, or {data: [...]}
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(data?.data)
        ? data.data
        : [];

      if (!Array.isArray(list) || list.length === 0) return [];
      return list.map(toMessage);
    } catch {
      // try next candidate
      continue;
    }
  }
  return [];
}

/**
 * A non-intrusive, dismissible banner that shows WebSocket setup guidance.
 * Uses Ocean Professional CSS variables for consistent theming.
 * Note: No hooks inside this component make network or conditional calls that break rules of hooks.
 */
function WsHelpBanner({ visible, env, onDismiss }) {
  if (!visible) return null;

  const styles = {
    wrap: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      margin: '10px 12px 8px 12px', // add bottom margin so it doesn't crowd message list
      padding: '12px 14px',
      background: 'var(--surface-muted, #f3f4f6)',
      border: '1px solid var(--border-color, #e5e7eb)',
      borderRadius: 'var(--radius-md, 10px)',
      boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(17,24,39,0.06))',
      color: 'var(--text, #111827)',
    },
    bullet: {
      width: 10,
      height: 10,
      marginTop: 5,
      borderRadius: '50%',
      backgroundColor: 'var(--status-disconnected, #EF4444)',
      boxShadow: '0 0 0 2px rgba(239,68,68,0.08)',
      flexShrink: 0,
    },
    content: {
      flex: 1,
      minWidth: 0,
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      flexWrap: 'wrap',
    },
    title: {
      margin: 0,
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--text-primary, #111827)',
    },
    dismissBtn: {
      marginLeft: 'auto',
      padding: '6px 10px',
      fontSize: 12,
      fontWeight: 600,
      border: 'none',
      borderRadius: 8,
      color: 'var(--button-text, #ffffff)',
      backgroundColor: 'var(--button-bg, #2563EB)',
      cursor: 'pointer',
      boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.06))',
      transition: 'opacity 120ms ease, transform 120ms ease, box-shadow 120ms ease',
      flexShrink: 0,
    },
    text: {
      margin: '6px 0 0 0',
      fontSize: 12,
      color: 'var(--text-secondary, #6b7280)',
      lineHeight: 1.45,
    },
    codeRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      flexWrap: 'wrap',
    },
    code: {
      padding: '6px 8px',
      borderRadius: 8,
      border: '1px solid var(--border-color, #e5e7eb)',
      background: 'rgba(11,18,32,0.05)',
      color: 'var(--text, #111827)',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      userSelect: 'all',
    },
    copyBtn: {
      padding: '6px 10px',
      fontSize: 12,
      fontWeight: 600,
      border: 'none',
      borderRadius: 8,
      color: 'var(--button-text, #ffffff)',
      backgroundColor: 'var(--button-bg, #2563EB)',
      cursor: 'pointer',
      boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.06))',
      transition: 'opacity 120ms ease, transform 120ms ease, box-shadow 120ms ease',
      flexShrink: 0,
    },
    small: {
      fontSize: 11,
      color: 'var(--text-secondary, #6b7280)',
      marginTop: 6,
    },
  };

  const example = 'ws://localhost:8080/ws';
  const derivedCurrent = env?.wsUrl || 'ws(s)://<your-host>/ws';
  const apiBaseEnv = env?.apiBaseEnv || '(unset)';
  const backendEnv = env?.backendUrlEnv || '(unset)';
  const frontend = env?.frontendUrl || '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example);
    } catch {
      // ignore copy failures
    }
  };

  const sourceHint = env?.wsFromExplicit
    ? 'Using REACT_APP_WS_URL as configured.'
    : 'Using derived fallback because REACT_APP_WS_URL is not set.';

  return (
    <div style={styles.wrap} role="note" aria-live="polite" aria-label="WebSocket configuration help">
      <span style={styles.bullet} aria-hidden="true" />
      <div style={styles.content}>
        <div style={styles.titleRow}>
          <h3 style={styles.title}>WebSocket not connected</h3>
          <button
            type="button"
            style={styles.dismissBtn}
            onClick={onDismiss}
            title="Dismiss for this session"
            aria-label="Dismiss WebSocket help for this session"
          >
            Dismiss
          </button>
        </div>
        <p style={styles.text}>
          Set REACT_APP_WS_URL to your WebSocket endpoint. If not set, we derive a fallback:
          when REACT_APP_API_BASE or REACT_APP_BACKEND_URL is provided, we convert http↔ws and reuse its path (defaulting to /ws).
          Otherwise, we use the current page host with ws/wss and /ws.
        </p>

        <div style={styles.codeRow}>
          <code style={styles.code}>REACT_APP_WS_URL={derivedCurrent}</code>
          <button type="button" style={styles.copyBtn} onClick={copy} title="Copy example WebSocket URL">
            Copy example
          </button>
        </div>

        <div style={styles.small}>
          Example: <code style={styles.code}>{example}</code>
        </div>
        <div style={styles.small}>
          {sourceHint} Fallback sources • REACT_APP_API_BASE={apiBaseEnv}, REACT_APP_BACKEND_URL={backendEnv}; Page: {frontend || '(unknown)'}
        </div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** Root application component composing header, message list, and input with WebSocket integration. */
  const [theme, setTheme] = useState('light');

  // Persist dismissal per session without violating rules of hooks
  const [wsBannerDismissed, setWsBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('ws-help-dismissed') === '1';
    } catch {
      return false;
    }
  });

  // a naive current user id for demo; in real apps derive from auth/user profile
  const [currentUser] = useState(() => ({
    id: 'me',
    name: 'You',
    avatarText: 'ME',
  }));

  // message model internal: { id, clientId?, sender, content, timestamp, name?, avatarText?, pending?:boolean, error?:string }
  const [messages, setMessages] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState(null);

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

  // Optional recent history fetch: non-blocking, safe mapping, respects absence of API.
  useEffect(() => {
    let cancelled = false;

    const apiBase = getApiBase();
    if (!apiBase) {
      setHistoryLoaded(true);
      return;
    }

    (async () => {
      try {
        const history = await fetchRecentMessagesSafe();
        if (cancelled) return;
        if (Array.isArray(history) && history.length > 0) {
          setMessages((prev) => {
            // If previous is only the welcome message, replace it with history.
            if (prev.length === 1 && prev[0]?.id === 'welcome-1') {
              return history;
            }
            // Otherwise, merge without duplicating by id.
            const byId = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const h of history) {
              if (!byId.has(h.id)) merged.push(h);
            }
            return merged;
          });
        }
        setHistoryError(null);
      } catch (e) {
        setHistoryError('Could not load recent messages.');
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Setup WebSocket
  const { status, connected, connecting, send, lastMessage, url } = useWebSocket({
    // url resolved inside hook via env utils
    autoConnect: true,
    shouldReconnect: true,
    onMessage: () => {
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

      if (!queuedOrSent && !connecting && !connected) {
        // leave pending state to indicate queued
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
      paddingBottom: 8, // ensure breathing room so banner and input never collide on small screens
    },
    listWrap: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
    },
  };

  const envSummary = getEnvSummary();

  // Show banner when:
  // - Not connected and not currently connecting (to guide setup), OR
  // - WS URL is not from explicit env (to nudge to set REACT_APP_WS_URL)
  // Also respect session dismissal.
  const bannerShouldShow =
    ((!connected && !connecting) || !envSummary.wsFromExplicit) && !wsBannerDismissed;

  const handleDismissBanner = useCallback(() => {
    setWsBannerDismissed(true);
    try {
      sessionStorage.setItem('ws-help-dismissed', '1');
    } catch {
      // ignore storage issues
    }
  }, []);

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

        <WsHelpBanner
          visible={bannerShouldShow}
          env={{ ...envSummary, wsResolved: url || '' }}
          onDismiss={handleDismissBanner}
        />

        <div style={styles.listWrap}>
          {/* Non-blocking status note for history load */}
          {!historyLoaded && (
            <div
              role="status"
              aria-live="polite"
              style={{
                margin: '10px 12px 0 12px',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--text-secondary, #6b7280)',
                background: 'var(--surface-muted, #f3f4f6)',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: 8,
                boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(17,24,39,0.06))',
              }}
            >
              Loading recent messages…
            </div>
          )}
          {historyLoaded && historyError && (
            <div
              role="note"
              aria-live="polite"
              style={{
                margin: '10px 12px 0 12px',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--text-secondary, #6b7280)',
                background: 'var(--surface-muted, #f3f4f6)',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: 8,
                boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(17,24,39,0.06))',
              }}
            >
              Recent messages unavailable. You can still chat in real time.
            </div>
          )}
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
