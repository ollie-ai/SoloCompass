import { useEffect, useRef, useState } from 'react';

const DEFAULT_PULL_THRESHOLD = 85;

export function usePullToRefresh(onRefresh, enabled = true) {
  const startY = useRef(0);
  const touching = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const onTouchStart = (event) => {
      if (window.scrollY > 0) return;
      touching.current = true;
      startY.current = event.touches[0].clientY;
    };

    const onTouchMove = (event) => {
      if (!touching.current || isRefreshing || window.scrollY > 0) return;
      const distance = event.touches[0].clientY - startY.current;
      if (distance > DEFAULT_PULL_THRESHOLD) {
        setIsRefreshing(true);
        Promise.resolve(onRefresh?.()).finally(() => {
          setTimeout(() => setIsRefreshing(false), 400);
        });
      }
    };

    const onTouchEnd = () => {
      touching.current = false;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, isRefreshing, onRefresh]);

  return { isRefreshing };
}
