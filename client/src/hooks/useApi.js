import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
export function useApi(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    if (!url) {
      setLoading(false);
      return;
    }
    api
      .get(url)
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [url, version]);
  return { data, loading, error, refresh };
}
