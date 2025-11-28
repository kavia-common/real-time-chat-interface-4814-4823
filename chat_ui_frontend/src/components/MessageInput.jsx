import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * MessageInput provides a textarea for composing messages and a send button.
 * Props:
 * - disabled: boolean; disables input and send
 * - onSend: function(text): Promise<void> | void
 */
export default function MessageInput({ disabled, onSend }) {
  const [text, setText] = useState('');
  const taRef = useRef(null);

  // Auto-resize textarea
  const resize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  useEffect(() => { resize(); }, [text, resize]);

  const doSend = async () => {
    const value = text.trim();
    if (!value) return;
    await onSend?.(value);
    setText('');
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) doSend();
    }
  };

  return (
    <div className="input-card" role="group" aria-label="Message input">
      <textarea
        ref={taRef}
        className="chat-input"
        placeholder={disabled ? 'Disconnected…' : 'Type a message…'}
        disabled={disabled}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        aria-disabled={disabled}
      />
      <button
        className="send-btn"
        onClick={doSend}
        disabled={disabled || !text.trim()}
        aria-label="Send message"
        title="Send (Enter). New line (Shift+Enter)"
      >
        Send
      </button>
    </div>
  );
}
