import { useEffect, useState } from 'react';
import { api } from '../services/api';
// Read every page so reference selectors do not silently hide records after 100.
export function useOptions(path, version = 0) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      const result = [];
      let page = 1,
        pages = 1;
      do {
        const data = await api.get(
          path + (path.includes('?') ? '&' : '?') + 'limit=100&page=' + page,
        );
        result.push(...data.items);
        pages = data.pages;
        page++;
      } while (page <= pages);
      if (alive) setItems(result);
    })()
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, version]);
  return { items, error, loading };
}
