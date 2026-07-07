import React, { useState, useEffect, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import type { Appointment, AppointmentStatus } from '@/types';
import styles from './index.module.scss';

const FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
];

const STATUS_MAP: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: '待确认', className: styles.cardStatusPending },
  confirmed: { label: '已确认', className: styles.cardStatusConfirmed },
  completed: { label: '已完成', className: styles.cardStatusCompleted },
  cancelled: { label: '已取消', className: styles.cardStatusCancelled }
};

function AdminAppointmentsPage() {
  const [filter, setFilter] = useState('all');
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const loadAppointments = useCallback(async () => {
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const data = await callFunction<Appointment[]>('getAppointments', params);
      setAppointments(data);
    } catch (err) {
      console.error('[AdminAppointments] load failed:', err);
    }
  }, [filter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleConfirm = async (aptId: string) => {
    try {
      await callFunction('updateAppointment', { appointmentId: aptId, status: 'confirmed' });
      Taro.showToast({ title: '已确认', icon: 'success' });
      loadAppointments();
    } catch (err) {
      console.error('[AdminAppointments] confirm failed:', err);
    }
  };

  const handleComplete = async (aptId: string) => {
    try {
      await callFunction('updateAppointment', { appointmentId: aptId, status: 'completed' });
      Taro.showToast({ title: '已完成', icon: 'success' });
      loadAppointments();
    } catch (err) {
      console.error('[AdminAppointments] complete failed:', err);
    }
  };

  return (
    <View className={styles.page}>
      <View className={styles.filterBar}>
        {FILTER_OPTIONS.map(opt => (
          <View
            key={opt.key}
            className={`${styles.filterBtn} ${filter === opt.key ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(opt.key)}
          >
            <Text>{opt.label}</Text>
          </View>
        ))}
      </View>

      {appointments.length > 0 ? (
        <View className={styles.list}>
          {appointments.map(apt => (
            <View key={apt._id} className={styles.card}>
              <View className={styles.cardHeader}>
                <Text className={styles.cardName}>{apt.serviceName}</Text>
                <Text className={`${styles.cardStatus} ${STATUS_MAP[apt.status]?.className}`}>
                  {STATUS_MAP[apt.status]?.label}
                </Text>
              </View>
              <View className={styles.cardInfo}>
                <View className={styles.cardRow}>
                  <Text className={styles.cardLabel}>客户</Text>
                  <Text className={styles.cardValue}>{apt.customerName} {apt.phone}</Text>
                </View>
                <View className={styles.cardRow}>
                  <Text className={styles.cardLabel}>时间</Text>
                  <Text className={styles.cardValue}>{apt.date} {apt.timeSlot}</Text>
                </View>
                <View className={styles.cardRow}>
                  <Text className={styles.cardLabel}>车型</Text>
                  <Text className={styles.cardValue}>{apt.carModel}</Text>
                </View>
                {apt.remark && (
                  <View className={styles.cardRow}>
                    <Text className={styles.cardLabel}>备注</Text>
                    <Text className={styles.cardValue}>{apt.remark}</Text>
                  </View>
                )}
              </View>
              {apt.status === 'pending' && (
                <View className={styles.cardActions}>
                  <View className={`${styles.cardBtn} ${styles.cardBtnConfirm}`} onClick={() => handleConfirm(apt._id)}>
                    <Text>确认</Text>
                  </View>
                </View>
              )}
              {apt.status === 'confirmed' && (
                <View className={styles.cardActions}>
                  <View className={`${styles.cardBtn} ${styles.cardBtnComplete}`} onClick={() => handleComplete(apt._id)}>
                    <Text>完成</Text>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text className={styles.empty}>暂无预约记录</Text>
      )}
    </View>
  );
}

export default AdminAppointmentsPage;
