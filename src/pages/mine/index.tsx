import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import type { Appointment, AppointmentStatus } from '@/types';
import styles from './index.module.scss';

const isWeapp = process.env.TARO_ENV === 'weapp';

const STATUS_MAP: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: '待确认', className: styles.appointmentCardStatusPending },
  confirmed: { label: '已确认', className: styles.appointmentCardStatusConfirmed },
  completed: { label: '已完成', className: styles.appointmentCardStatusCompleted },
  cancelled: { label: '已取消', className: styles.appointmentCardStatusCancelled }
};

function MinePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<{ nickname: string; avatar: string } | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const stored = Taro.getStorageSync('userInfo');
    if (stored) {
      setUserInfo(stored);
      setIsLoggedIn(true);
      loadAppointments();
      checkAdmin();
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    try {
      const data = await callFunction<Appointment[]>('getAppointments');
      setAppointments(data);
    } catch (err) {
      console.error('[Mine] loadAppointments failed:', err);
    }
  }, []);

  const checkAdmin = useCallback(async () => {
    try {
      const result = await callFunction<{ isAdmin: boolean }>('checkAdmin');
      setIsAdmin(result.isAdmin);
    } catch (err) {
      console.error('[Mine] checkAdmin failed:', err);
    }
  }, []);

  const handleLogin = async () => {
    try {
      let nickname = '微信用户';
      let avatar = 'https://picsum.photos/id/64/200/200';

      // 微信小程序环境使用真实授权
      if (isWeapp) {
        const profile = await Taro.getUserProfile({ desc: '用于展示用户信息' });
        nickname = profile.userInfo.nickName;
        avatar = profile.userInfo.avatarUrl;
      } else {
        // H5/Web 环境使用模拟数据（管理员账号）
        nickname = '管理员';
        avatar = 'https://picsum.photos/id/64/200/200';
      }

      const result = await callFunction<{ nickname: string; avatar: string; isAdmin: boolean }>('login', {
        nickname,
        avatar
      });
      setUserInfo({ nickname: result.nickname, avatar: result.avatar });
      setIsLoggedIn(true);
      Taro.setStorageSync('userInfo', { nickname: result.nickname, avatar: result.avatar });
      loadAppointments();
      // H5 环境默认管理员
      if (!isWeapp) {
        setIsAdmin(true);
      } else if (result.isAdmin) {
        setIsAdmin(true);
      }
    } catch (err) {
      console.error('[Mine] login failed:', err);
    }
  };

  const handleLogout = () => {
    setUserInfo(null);
    setIsLoggedIn(false);
    setIsAdmin(false);
    setAppointments([]);
    Taro.removeStorageSync('userInfo');
  };

  const handleCancelAppointment = async (aptId: string) => {
    const confirm = await Taro.showModal({
      title: '取消预约',
      content: '确定要取消这个预约吗？'
    });
    if (!confirm.confirm) return;
    try {
      await callFunction('updateAppointment', { appointmentId: aptId, status: 'cancelled' });
      setAppointments(prev =>
        prev.map(a => a._id === aptId ? { ...a, status: 'cancelled' as AppointmentStatus } : a)
      );
      Taro.showToast({ title: '已取消', icon: 'success' });
    } catch (err) {
      console.error('[Mine] cancel failed:', err);
    }
  };

  const handleGoAdmin = () => {
    Taro.navigateTo({ url: '/pages/admin/index' });
  };

  return (
    <View className={styles.page}>
      {/* 用户信息 */}
      {isLoggedIn && userInfo ? (
        <View className={styles.userCard}>
          <Image className={styles.userCardAvatar} src={userInfo.avatar} mode="aspectFill" />
          <View className={styles.userCardInfo}>
            <Text className={styles.userCardName}>{userInfo.nickname}</Text>
            <Text className={styles.userCardDesc}>{isAdmin ? '管理员' : '普通用户'}</Text>
          </View>
        </View>
      ) : (
        <View className={styles.loginCard}>
          <Text className={styles.loginCardTip}>登录后查看预约信息</Text>
          <View className={styles.loginCardBtn} onClick={handleLogin}>
            <Text>微信一键登录</Text>
          </View>
        </View>
      )}

      {/* 功能入口 */}
      {isLoggedIn && (
        <View className={styles.menuSection}>
          <Text className={styles.menuTitle}>功能</Text>
          <View className={styles.menuList}>
            {isAdmin && (
              <View className={styles.menuItem} onClick={handleGoAdmin}>
                <View className={styles.menuItemLeft}>
                  <Text className={styles.menuItemIcon}>⚙️</Text>
                  <Text className={styles.menuItemLabel}>管理后台</Text>
                </View>
                <Text className={styles.menuItemArrow}>›</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 我的预约 */}
      {isLoggedIn && (
        <View className={styles.menuSection}>
          <Text className={styles.menuTitle}>我的预约</Text>
          {appointments.length > 0 ? (
            <View className={styles.appointmentList}>
              {appointments.map(apt => (
                <View key={apt._id} className={styles.appointmentCard}>
                  <View className={styles.appointmentCardHeader}>
                    <Text className={styles.appointmentCardName}>{apt.serviceName}</Text>
                    <Text className={`${styles.appointmentCardStatus} ${STATUS_MAP[apt.status]?.className}`}>
                      {STATUS_MAP[apt.status]?.label}
                    </Text>
                  </View>
                  <View className={styles.appointmentCardInfo}>
                    <View className={styles.appointmentCardRow}>
                      <Text className={styles.appointmentCardLabel}>日期</Text>
                      <Text className={styles.appointmentCardValue}>{apt.date} {apt.timeSlot}</Text>
                    </View>
                    <View className={styles.appointmentCardRow}>
                      <Text className={styles.appointmentCardLabel}>车型</Text>
                      <Text className={styles.appointmentCardValue}>{apt.carModel}</Text>
                    </View>
                    <View className={styles.appointmentCardRow}>
                      <Text className={styles.appointmentCardLabel}>价格</Text>
                      <Text className={styles.appointmentCardValue}>¥{apt.servicePrice}</Text>
                    </View>
                  </View>
                  {apt.status === 'pending' && (
                    <View className={styles.appointmentCardActions}>
                      <View
                        className={`${styles.appointmentCardActionBtn} ${styles.appointmentCardActionBtnCancel}`}
                        onClick={() => handleCancelAppointment(apt._id)}
                      >
                        <Text>取消预约</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View className={styles.emptyState}>
              <Text className={styles.emptyStateIcon}>📋</Text>
              <Text className={styles.emptyStateText}>暂无预约记录</Text>
            </View>
          )}
        </View>
      )}

      {/* 退出登录 */}
      {isLoggedIn && (
        <View className={styles.logoutBtn} onClick={handleLogout}>
          <Text>退出登录</Text>
        </View>
      )}
    </View>
  );
}

export default MinePage;
