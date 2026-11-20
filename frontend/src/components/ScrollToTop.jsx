import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Βρίσκουμε το div που κάνει πραγματικά το scroll
    const scrollContainer = document.getElementById('main-scroll-area');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
