import { useState, useEffect, useCallback, useRef } from "react";

export function useInfiniteScroll<T>(items: T[] | undefined, pageSize: number = 100) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  const loadMore = useCallback(() => {
    if (items && visibleCount < items.length) {
      setVisibleCount((v) => v + pageSize);
    }
  }, [items, visibleCount, pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const visible = items?.slice(0, visibleCount);
  const hasMore = (items?.length ?? 0) > visibleCount;

  return { visible, hasMore, sentinelRef };
}
