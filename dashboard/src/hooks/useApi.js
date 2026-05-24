import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export function useApi(path, params = null, options = {}) {
  const { autoFetch = true, refreshInterval = 0 } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(path, params);
      setData(result);
    } catch (err) {
      setError(err.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [path, JSON.stringify(params)]);

  useEffect(() => {
    if (!autoFetch) return;
    fetchData();
  }, [fetchData, autoFetch]);

  useEffect(() => {
    if (!refreshInterval || !autoFetch) return;
    const id = setInterval(fetchData, refreshInterval);
    return () => clearInterval(id);
  }, [fetchData, refreshInterval, autoFetch]);

  return { data, loading, error, refetch: fetchData };
}

export function useApiPost() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (path, body) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post(path, body);
      return result;
    } catch (err) {
      setError(err.message || '요청에 실패했습니다.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error, clearError: () => setError(null) };
}
