import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * PUBLIC_INTERFACE
 * MessageList
 * Renders a scrollable, accessible list of chat messages with Ocean Professional styling.
 *
 * Props:
 * - messages: Array<{
 *     id?: string|number,
 *     sender: 'me' | 'other' | string,
 *     content: string,
 *     timestamp?: string|number|Date,
 *     avatarText?: string,   // Optional initials for "other"
 *     name?: string          // Optional display name for "other"
 *   }>
 * - currentUserId?: string  // If provided, messages with sender === currentUserId are treated as "me"
 * - onReachTop?: () => void // Optional callback when user scrolls to top (for pagination)
 * - autoScrollThreshold?: number // px from bottom to consider "near bottom" to auto-scroll; default 100
 *
 * Accessibility:
 * - Container uses role="log" with aria-live="polite" and aria-relevant="additions"
 * - Each message is a listitem with author and content semantics
 * - The list maintains scroll position when new messages arrive unless user scrolled away
 */
function MessageList({
  messages = [],
  currentUserId,
  onReachTop,
  autoScrollThreshold = 100,
}) {
  const scrollRef = useRef(null);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const prevScrollHeightRef = useRef(0);
  const userScrollLockRef = useRef(false); // true if user moved away from bottom intentionally

  // Normalize messages to compute ownership and a stable key
  const normalized = useMemo(() => {
    return messages.map((m, idx) => {
      const isMe =
        m.sender === "me" ||
        (currentUserId && m.sender && String(m.sender) === String(currentUserId));
      const key = m.id ?? `${m.sender}-${idx}-${String(m.timestamp ?? "")}`;
      return { ...m, isMe, key };
    });
  }, [messages, currentUserId]);

  // Helper to check if user is near bottom
  const computeNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= autoScrollThreshold;
    // If 0 or less, we are at bottom
  };

  // Scroll handler to update near-bottom state and fire onReachTop
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const nearBottom = computeNearBottom();
      setIsUserNearBottom(nearBottom);
      userScrollLockRef.current = !nearBottom;

      // Notify when reaching top (for pagination)
      if (el.scrollTop <= 0 && typeof onReachTop === "function") {
        onReachTop();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScrollThreshold, onReachTop]);

  // Maintain scroll position when new messages are added.
  // - If user is near bottom, auto-scroll to bottom smoothly
  // - If not near bottom, preserve current scrollTop relative to new content height
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prevScrollHeight = prevScrollHeightRef.current;
    const atBottom = computeNearBottom();

    // After render, scroll adjustments
    requestAnimationFrame(() => {
      if (atBottom) {
        // Smooth scroll to bottom when near bottom
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        userScrollLockRef.current = false;
      } else {
        // Preserve visual position when not at bottom
        const diff = el.scrollHeight - prevScrollHeight;
        if (diff !== 0) {
          el.scrollTop = el.scrollTop + diff;
        }
        userScrollLockRef.current = true;
      }
      prevScrollHeightRef.current = el.scrollHeight;
    });
  }, [normalized]); // run when messages change

  // Initialize scroll to bottom on first mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    prevScrollHeightRef.current = el.scrollHeight;
    el.scrollTop = el.scrollHeight;
    setIsUserNearBottom(true);
    userScrollLockRef.current = false;
  }, []);

  // Ocean Professional theme inline styles (lean dependencies)
  const styles = {
    container: {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "var(--bg-primary, #f9fafb)",
    },
    scroller: {
      height: "100%",
      overflowY: "auto",
      padding: "12px",
      boxSizing: "border-box",
      scrollBehavior: "smooth",
      background:
        "linear-gradient(180deg, rgba(37,99,235,0.04) 0%, rgba(249,250,251,0.5) 100%)",
    },
    list: {
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    row: {
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      maxWidth: "100%",
    },
    rowMe: {
      justifyContent: "flex-end",
    },
    rowOther: {
      justifyContent: "flex-start",
    },
    bubbleBase: {
      maxWidth: "70%",
      padding: "10px 12px",
      borderRadius: 12,
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      transition: "transform 120ms ease, box-shadow 120ms ease, background-color 150ms ease",
      wordWrap: "break-word",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      lineHeight: 1.4,
      fontSize: 14,
    },
    bubbleMe: {
      background:
        "linear-gradient(135deg, rgba(37,99,235,0.9) 0%, rgba(37,99,235,0.8) 100%)",
      color: "#ffffff",
      borderTopRightRadius: 4,
    },
    bubbleOther: {
      background: "var(--surface, #ffffff)",
      color: "var(--text, #111827)",
      border: "1px solid var(--border-color, #e5e7eb)",
      borderTopLeftRadius: 4,
    },
    metaRow: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: "50%",
      background:
        "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(245,158,11,0.10) 100%)",
      color: "var(--text-primary, #111827)",
      border: "1px solid var(--border-color, #e5e7eb)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: 12,
      userSelect: "none",
      flexShrink: 0,
    },
    name: {
      fontSize: 12,
      color: "var(--text-secondary, #6b7280)",
    },
    timestamp: {
      fontSize: 11,
      color: "var(--text-secondary, #9ca3af)",
      marginTop: 4,
      userSelect: "none",
    },
    newBadge: {
      position: "sticky",
      bottom: 12,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none",
    },
    newChip: {
      backgroundColor: "rgba(37,99,235,0.95)",
      color: "#fff",
      padding: "6px 10px",
      borderRadius: 999,
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      fontSize: 12,
      fontWeight: 600,
      transition: "opacity 150ms ease",
      pointerEvents: "auto",
      cursor: "pointer",
    },
  };

  // Computed label for live region
  const liveRegionLabel = "Message list";

  return (
    <div style={styles.container}>
      <div
        ref={scrollRef}
        style={styles.scroller}
        role="log"
        aria-label={liveRegionLabel}
        aria-live="polite"
        aria-relevant="additions"
      >
        <ul role="list" style={styles.list}>
          {normalized.map((m) => {
            const isMe = m.isMe;
            const rowStyle = {
              ...styles.row,
              ...(isMe ? styles.rowMe : styles.rowOther),
            };
            const bubbleStyle = {
              ...styles.bubbleBase,
              ...(isMe ? styles.bubbleMe : styles.bubbleOther),
            };

            const initials =
              typeof m.avatarText === "string" && m.avatarText.trim()
                ? m.avatarText.trim().slice(0, 3).toUpperCase()
                : (m.name ? m.name.trim().slice(0, 3).toUpperCase() : "AI");

            const ts =
              m.timestamp
                ? new Date(m.timestamp)
                : null;
            const tsLabel = ts ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

            return (
              <li
                key={m.key}
                role="listitem"
                aria-label={`Message from ${isMe ? "you" : m.name || "other"}`}
              >
                <div style={rowStyle}>
                  {!isMe && (
                    <div
                      style={styles.avatar}
                      aria-hidden="true"
                      title={m.name || "User"}
                    >
                      {initials}
                    </div>
                  )}
                  <div>
                    {!isMe && (m.name || tsLabel) ? (
                      <div style={styles.metaRow}>
                        {m.name ? <span style={styles.name}>{m.name}</span> : null}
                        {tsLabel ? (
                          <span style={styles.timestamp} aria-label={`Sent at ${tsLabel}`}>
                            {tsLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div
                      style={bubbleStyle}
                      role="article"
                      aria-roledescription="message"
                    >
                      {m.content}
                    </div>
                    {isMe && tsLabel ? (
                      <div style={{ ...styles.timestamp, textAlign: "right" }} aria-label={`Sent at ${tsLabel}`}>
                        {tsLabel}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {!isUserNearBottom && (
          <div style={styles.newBadge} aria-hidden="true">
            {/* A floating chip that could be extended to scroll to bottom on click */}
            <button
              type="button"
              style={styles.newChip}
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              }}
              aria-label="Scroll to most recent messages"
              title="Scroll to latest"
            >
              New messages • Jump to bottom
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageList;
