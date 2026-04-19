import { useEffect } from 'react';

export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = `PRScope | ${page}`;
    return () => { document.title = 'PRScope'; };
  }, [page]);
}
