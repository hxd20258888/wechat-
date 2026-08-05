import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import type { UserInfo } from '@/types';

const USER_STORAGE_KEY = 'userInfo';

interface LoginResult {
  isNewUser: boolean;
  user: UserInfo | null;
}

export function useUser() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = Taro.getStorageSync(USER_STORAGE_KEY);
    if (stored) {
      setUserInfo(stored);
      setIsLoggedIn(true);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async () => {
    try {
      setLoading(true);
      const profile = await Taro.getUserProfile({ desc: '用于展示用户信息' });
      const result = await callFunction<LoginResult>('login', {
        mode: 'create',
        nickname: profile.userInfo.nickName,
        avatar: profile.userInfo.avatarUrl
      });
      if (!result.user) {
        throw new Error('登录失败，请稍后重试');
      }
      setUserInfo(result.user);
      setIsLoggedIn(true);
      Taro.setStorageSync(USER_STORAGE_KEY, result.user);
      return result.user;
    } catch (err) {
      console.error('[useUser] login failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUserInfo(null);
    setIsLoggedIn(false);
    Taro.removeStorageSync(USER_STORAGE_KEY);
  }, []);

  const updatePhone = useCallback(async (phone: string) => {
    if (!userInfo) return;
    const updated = { ...userInfo, phone };
    setUserInfo(updated);
    Taro.setStorageSync(USER_STORAGE_KEY, updated);
  }, [userInfo]);

  return { userInfo, isLoggedIn, loading, login, logout, updatePhone };
}
