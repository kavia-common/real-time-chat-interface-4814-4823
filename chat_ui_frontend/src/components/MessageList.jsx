import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * PUBLIC_INTERFACE
 * MessageList renders the list of chat messages with accessibility features.
 * Props:
 * - messages: array of { id, role, text, createdAt, optimistic? }
 * - pendingMap: map of id -> 'pending'|'failed' to reflect optimistic state
 * - atBottom: boolean indicating if list is at scroll bottom
 * - onJumpToLatest: function to scroll to latest
 * - onScroll: scroll handler to track user scroll interactions
 */
const MessageList = forwardRef(function MessageList(
  { messages, pendingMap, atBottom, onJumpToLatest, onScroll },
  externalRef
) {
  const listRef = useRef(null);

  useImperativeHandle(externalRef, () => listRef.current);

  // Announce new messages politely
  useEffect(() => {
    // no-op needed for now; aria-live attribute on container will handle
  }, [messages]);

  return (
    <div
      className="message-list"
      onScroll={onScroll}
      ref={listRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((m) => {
        const state = pendingMap[m.id];
        const isMe = m.role === 'user' || m.role === 'me';
        return (
          <div key={m.id || Math.random()} className={`msg ${isMe ? 'me' : ''}`}>
            <div className="avatar" aria-hidden="true">
              {isMe ? '🧑' : '🤖'}
            </div>
            <div>
              <div className="bubble">
                <div>{m.text}</div>
                <div className="meta">
                  <span className="muted">
                    {new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {state === 'pending' && <span className="muted">• Sending…</span>}
                  {state === 'failed' && <span style={{ color: 'var(--error)' }}>• Failed</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {!atBottom && (
        <button className="jump-latest" onClick={onJumpToLatest} aria-label="Jump to latest messages">
          Jump to latest ⬇
        </button>
      )}
    </div>
  );
});

export default MessageList;
