import React, { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import type { Appointment } from '@/types';
import styles from './index.module.scss';

function AdminPage() {
  const [pendingCount, setPendingCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const appointments = await callFunction<Appointment[]>('getAppointments');
      const pending = appointments.filter(a => a.status === 'pending').length;
      const today = new Date().toISOString().split('T')[0];
      const todayApts = appointments.filter(a => a.date === today).length;
      setPendingCount(pending);
      setTodayCount(todayApts);
    } catch (err) {
      console.error('[Admin] loadData failed:', err);
    }
  };

  const navigateTo = (page: string) => {
    Taro.navigateTo({ url: `/pages/${page}/index` });
  };

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>管理后台</Text>
        <Text className={styles.headerDesc}>管理你的服务、时段和预约</Text>
      </View>

      <View className={styles.stats}>
        <View className={styles.statItem}>
          <Text className={styles.statItemValue}>{pendingCount}</Text>
          <Text className={styles.statItemLabel}>待确认</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statItemValue}>{todayCount}</Text>
          <Text className={styles.statItemLabel}>今日预约</Text>
        </View>
      </View>

      <View className={styles.menuGrid}>
        <View className={styles.menuItem} onClick={() => navigateTo('adminAppointments')}>
          <Text className={styles.menuItemIcon}>📋</Text>
          <Text className={styles.menuItemLabel}>预约管理</Text>
          <Text className={styles.menuItemDesc}>确认/完成预约</Text>
        </View>
        <View className={styles.menuItem} onClick={() => navigateTo('adminServices')}>
          <Text className={styles.menuItemIcon}>🔧</Text>
          <Text className={styles.menuItemLabel}>服务管理</Text>
          <Text className={styles.menuItemDesc}>增删改服务项目</Text>
        </View>
        <View className={styles.menuItem} onClick={() => navigateTo('adminTimeSlots')}>
          <Text className={styles.menuItemIcon}>🕐</Text>
          <Text className={styles.menuItemLabel}>时段管理</Text>
          <Text className={styles.menuItemDesc}>管理可预约时段</Text>
        </View>
      </View>
    </View>
  );
}

export default AdminPage;
