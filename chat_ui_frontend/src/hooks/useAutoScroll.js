import { useCallback, useRef, useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * useAutoScroll manages scroll behavior for a message list:
 * - Tracks if the user is at the bottom
 * - Provides scrollToBottom(force) to scroll
 * - Exposes onUserScroll handler to update state
 */
export function useAutoScroll() {
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef(null);

  const setListRef = useCallback((el) => {
    listRef.current = el;
  }, []);

  const onUserScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setAtBottom(nearBottom);
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    const el = listRef.current;
    if (!el) return;
    if (atBottom || force) {
      el.scrollTop = el.scrollHeight;
    }
  }, [atBottom]);

  return { atBottom, setListRef, onUserScroll, scrollToBottom };
}
