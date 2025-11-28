import React from "react";

/**
 * PUBLIC_INTERFACE
 * ChatHeader
 * A reusable header for the chat UI, showing:
 * - Avatar + title/subtitle area
 * - Connection status indicator (connected/connecting/disconnected)
 * - Optional theme toggle that integrates with existing CRA toggle behavior
 *
 * Props:
 * - title: string - Primary title (e.g., "Support Chat")
 * - subtitle: string (optional) - Secondary text (e.g., "Online" or agent name)
 * - status: 'connected' | 'connecting' | 'disconnected' - WebSocket status
 * - onToggleTheme?: () => void - If provided, renders a theme toggle button and calls this handler
 * - currentTheme?: 'light' | 'dark' - Current theme label to adapt button text
 * - showAvatar?: boolean - Whether to render the avatar circle
 * - avatarText?: string - Initials or text for avatar circle (defaults to "AI")
 *
 * Accessibility:
 * - Status indicator has aria-label reflecting the current connection state
 * - Theme toggle includes dynamic aria-label indicating target theme
 */
function ChatHeader({
  title = "Chat",
  subtitle,
  status = "disconnected",
  onToggleTheme,
  currentTheme = "light",
  showAvatar = true,
  avatarText = "AI",
}) {
  // Map statuses to colors per Ocean Professional theme
  const statusColor = {
    connected: "var(--status-connected, #10B981)", // emerald-500
    connecting: "var(--status-connecting, #F59E0B)", // amber-500 (also accent color)
    disconnected: "var(--status-disconnected, #EF4444)", // red-500
  }[status] || "var(--status-disconnected, #EF4444)";

  // Inline styles to keep dependencies minimal and respect existing CSS vars/themes
  const styles = {
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      boxSizing: "border-box",
      padding: "12px 16px",
      background: "var(--bg-secondary, #ffffff)",
      color: "var(--text-primary, #111827)",
      borderBottom: "1px solid var(--border-color, #e5e7eb)",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
    left: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 0,
    },
    avatar: {
      display: showAvatar ? "flex" : "none",
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
      borderRadius: "50%",
      background:
        "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(249,250,251,1) 100%)",
      color: "var(--text-primary, #111827)",
      fontWeight: 700,
      fontSize: 14,
      border: "1px solid var(--border-color, #e5e7eb)",
      userSelect: "none",
      flex: "0 0 auto",
    },
    titles: {
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
    },
    title: {
      fontSize: 16,
      fontWeight: 700,
      lineHeight: 1.2,
      margin: 0,
      color: "var(--text-primary, #111827)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      maxWidth: "60vw",
    },
    subtitle: {
      fontSize: 12,
      color: "var(--text-secondary, #6b7280)",
      lineHeight: 1.2,
      marginTop: 2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      maxWidth: "60vw",
    },
    right: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      backgroundColor: statusColor,
      boxShadow: "0 0 0 2px rgba(0,0,0,0.04)",
      transition: "background-color 150ms ease",
    },
    statusLabel: {
      fontSize: 12,
      color: "var(--text-secondary, #6b7280)",
      textTransform: "capitalize",
    },
    themeBtn: {
      marginLeft: 6,
      padding: "8px 12px",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--button-text, #ffffff)",
      backgroundColor: "var(--button-bg, #2563EB)", // primary blue
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      transition: "all 150ms ease",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
    },
  };

  const themeTarget = currentTheme === "light" ? "dark" : "light";
  const showThemeToggle = typeof onToggleTheme === "function";

  return (
    <div style={styles.header} role="banner" aria-label="Chat header">
      <div style={styles.left}>
        <div style={styles.avatar} aria-hidden={!showAvatar}>
          {avatarText}
        </div>
        <div style={styles.titles}>
          <h1 style={styles.title} title={title}>
            {title}
          </h1>
          {subtitle ? (
            <span style={styles.subtitle} title={subtitle}>
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>

      <div style={styles.right}>
        <span
          style={styles.statusDot}
          aria-label={`Connection status: ${status}`}
          title={status}
        />
        <span style={styles.statusLabel}>{status}</span>

        {showThemeToggle && (
          <button
            type="button"
            style={styles.themeBtn}
            onClick={onToggleTheme}
            className="theme-toggle"
            aria-label={`Switch to ${themeTarget} mode`}
            title={`Switch to ${themeTarget} mode`}
          >
            {currentTheme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatHeader;
