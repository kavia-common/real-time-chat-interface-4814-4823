import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * PUBLIC_INTERFACE
 * MessageInput
 * A multiline chat input with Enter-to-send and Shift+Enter for newline.
 *
 * Props:
 * - onSend: (messageText: string) => void
 * - disabled?: boolean               // disables textarea and send button (e.g., when disconnected)
 * - placeholder?: string             // custom placeholder text
 * - maxLength?: number               // optional maximum length; defaults to 5000
 * - autoFocus?: boolean              // auto focus the input on mount
 * - rows?: number                    // initial rows for the textarea (default 1)
 *
 * Accessibility:
 * - Provides aria-labels for input and actions
 * - Keyboard accessible: Enter to send, Shift+Enter for newline
 * - Proper disabled state announcements
 */
function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Type a message",
  maxLength = 5000,
  autoFocus = false,
  rows = 1,
}) {
  const [text, setText] = useState("");
  const [isComposing, setIsComposing] = useState(false); // handle IME composition
  const taRef = useRef(null);
  const sendBtnRef = useRef(null);

  // Ocean Professional theme inline styles to avoid extra dependencies
  const styles = useMemo(
    () => ({
      container: {
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        width: "100%",
        boxSizing: "border-box",
        padding: "12px",
        background: "var(--surface, #ffffff)",
        borderTop: "1px solid var(--border-color, #e5e7eb)",
      },
      textareaWrap: {
        position: "relative",
        flex: 1,
        display: "flex",
        alignItems: "stretch",
        background:
          "linear-gradient(180deg, rgba(37,99,235,0.04) 0%, rgba(249,250,251,0.5) 100%)",
        border: "1px solid var(--border-color, #e5e7eb)",
        borderRadius: 10,
        padding: 8,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04) inset",
      },
      textarea: {
        width: "100%",
        border: "none",
        outline: "none",
        resize: "none",
        background: "transparent",
        color: "var(--text, #111827)",
        fontSize: 14,
        lineHeight: 1.4,
        maxHeight: 180, // prevent runaway growth
      },
      actions: {
        display: "flex",
        alignItems: "center",
        gap: 8,
      },
      sendBtn: {
        padding: "10px 14px",
        borderRadius: 10,
        border: "none",
        fontWeight: 700,
        fontSize: 14,
        color: "var(--button-text, #ffffff)",
        backgroundColor: "var(--button-bg, #2563EB)",
        boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
        cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
        opacity: disabled || !text.trim() ? 0.6 : 1,
        transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
      },
      hint: {
        fontSize: 12,
        color: "var(--text-secondary, #6b7280)",
        userSelect: "none",
        marginLeft: 4,
      },
    }),
    [disabled, text]
  );

  // Auto-focus logic
  useEffect(() => {
    if (autoFocus && taRef.current) {
      try {
        taRef.current.focus();
      } catch {
        // ignore focus errors
      }
    }
  }, [autoFocus]);

  const doSend = useCallback(() => {
    const message = text.trim();
    if (disabled) return;
    if (!message) return;
    if (typeof onSend === "function") {
      try {
        onSend(message);
      } catch {
        // ignore handler errors to keep UX responsive
      }
    }
    setText("");
    // focus back to textarea after send for quick typing
    requestAnimationFrame(() => {
      taRef.current?.focus();
    });
  }, [text, onSend, disabled]);

  const onKeyDown = useCallback(
    (e) => {
      if (disabled) return;
      if (isComposing) return;

      // Enter to send when not holding Shift
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
      // Shift+Enter is default: insert newline
    },
    [doSend, disabled, isComposing]
  );

  // Auto-resize the textarea height based on content
  const autoResize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 180);
    el.style.height = `${next}px`;
  }, []);
  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  // IME composition handlers to prevent premature send
  const handleCompositionStart = () => setIsComposing(true);
  const handleCompositionEnd = () => setIsComposing(false);

  return (
    <div style={styles.container} role="form" aria-label="Message input form">
      <div style={styles.textareaWrap}>
        <textarea
          ref={taRef}
          style={styles.textarea}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label="Type your message"
          aria-disabled={disabled}
          disabled={disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
      </div>

      <div style={styles.actions}>
        <button
          ref={sendBtnRef}
          type="button"
          style={styles.sendBtn}
          onClick={doSend}
          aria-label="Send message"
          title="Send (Enter). New line: Shift+Enter"
          disabled={disabled || !text.trim()}
        >
          Send
        </button>
      </div>

      <span style={styles.hint} aria-hidden="true">
        Enter to send • Shift+Enter for newline
      </span>
    </div>
  );
}

export default MessageInput;
