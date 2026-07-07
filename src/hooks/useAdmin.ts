import { useState, useCallback } from 'react';
import { callFunction } from '@/services/cloud';
import type { UserInfo } from '@/types';

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkAdmin = useCallback(async () => {
    try {
      setLoading(true);
      const result = await callFunction<{ isAdmin: boolean }>('checkAdmin');
      setIsAdmin(result.isAdmin);
      return result.isAdmin;
    } catch (err) {
      console.error('[useAdmin] checkAdmin failed:', err);
      setIsAdmin(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const bindAdmin = useCallback(async () => {
    try {
      setLoading(true);
      await callFunction('bindAdmin');
      setIsAdmin(true);
      return true;
    } catch (err) {
      console.error('[useAdmin] bindAdmin failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { isAdmin, loading, checkAdmin, bindAdmin };
}
