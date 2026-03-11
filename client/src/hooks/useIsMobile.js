import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile / tablet viewport.
 *   isMobile  — width < 768 px  (phones)
 *   isTablet  — 768 ≤ width < 1024 px  (iPad portrait)
 *   isDesktop — width ≥ 1024 px
 */
export function useIsMobile() {
  const query = () => ({
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
    width: window.innerWidth,
  });

  const [screen, setScreen] = useState(query);

  useEffect(() => {
    let raf;
    const handleResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScreen(query()));
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return screen;
}

export default useIsMobile;
