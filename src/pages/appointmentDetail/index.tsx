import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import type { Appointment, AppointmentStatus } from '@/types';
import styles from './index.module.scss';

type AppointmentDetail = Appointment & {
  isAdminView?: boolean;
};

const STATUS_MAP: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: '待确认', className: styles.statusPending },
  confirmed: { label: '已确认', className: styles.statusConfirmed },
  completed: { label: '已完成', className: styles.statusCompleted },
  cancelled: { label: '已取消', className: styles.statusCancelled }
};

function AppointmentDetailPage() {
  const router = useRouter();
  const appointmentId = String(router.params.id || '');
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!appointmentId) {
      setError('预约参数无效');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await callFunction<AppointmentDetail>('getAppointmentDetail', { appointmentId });
      setAppointment(data);
    } catch (err) {
      console.error('[AppointmentDetail] load failed:', err);
      setError(err instanceof Error ? err.message : '预约详情加载失败');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const updateStatus = async (status: AppointmentStatus) => {
    if (!appointment || updating) return;
    const confirm = await Taro.showModal({
      title: status === 'cancelled' ? '取消预约' : '更新预约',
      content: status === 'cancelled' ? '确定要取消这个预约吗？' : '确定更新该预约状态吗？'
    });
    if (!confirm.confirm) return;

    try {
      setUpdating(true);
      await callFunction('updateAppointment', { appointmentId: appointment._id, status });
      Taro.showToast({ title: '已更新', icon: 'success' });
      loadDetail();
    } catch (err) {
      console.error('[AppointmentDetail] update failed:', err);
      Taro.showToast({ title: err instanceof Error ? err.message : '更新失败', icon: 'none' });
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !appointment) {
    return <View className={styles.page}><Text className={styles.empty}>加载中...</Text></View>;
  }

  if (error || !appointment) {
    return (
      <View className={styles.page}>
        <View className={styles.emptyPanel}>
          <Text className={styles.empty}>{error || '预约不存在'}</Text>
          <View className={styles.secondaryBtn} onClick={() => Taro.navigateBack()}><Text>返回上一层</Text></View>
        </View>
      </View>
    );
  }

  const status = STATUS_MAP[appointment.status];
  const canUserCancel = !appointment.isAdminView && (appointment.status === 'pending' || appointment.status === 'confirmed');
  const canAdminConfirm = appointment.isAdminView && appointment.status === 'pending';
  const canAdminComplete = appointment.isAdminView && appointment.status === 'confirmed';
  const canAdminCancel = appointment.isAdminView && (appointment.status === 'pending' || appointment.status === 'confirmed');

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View>
          <Text className={styles.title}>{appointment.serviceName}</Text>
          <Text className={styles.subtitle}>{appointment.date} {appointment.timeSlot}</Text>
        </View>
        <Text className={`${styles.status} ${status?.className}`}>{status?.label}</Text>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>预约信息</Text>
        <View className={styles.row}><Text className={styles.label}>预约编号</Text><Text className={styles.value}>{appointment._id}</Text></View>
        <View className={styles.row}><Text className={styles.label}>服务项目</Text><Text className={styles.value}>{appointment.serviceName}</Text></View>
        <View className={styles.row}><Text className={styles.label}>预约时间</Text><Text className={styles.value}>{appointment.date} {appointment.timeSlot}</Text></View>
        <View className={styles.row}><Text className={styles.label}>价格</Text><Text className={styles.value}>¥{appointment.servicePrice}</Text></View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>联系信息</Text>
        <View className={styles.row}><Text className={styles.label}>姓名</Text><Text className={styles.value}>{appointment.customerName}</Text></View>
        <View className={styles.row}><Text className={styles.label}>手机号</Text><Text className={styles.value}>{appointment.phone}</Text></View>
        <View className={styles.row}><Text className={styles.label}>车型</Text><Text className={styles.value}>{appointment.carModel}</Text></View>
        <View className={styles.row}><Text className={styles.label}>备注</Text><Text className={styles.value}>{appointment.remark || '无'}</Text></View>
      </View>

      <View className={styles.actions}>
        {canUserCancel && <View className={styles.cancelBtn} onClick={() => updateStatus('cancelled')}><Text>{updating ? '处理中...' : '取消预约'}</Text></View>}
        {canAdminConfirm && <View className={styles.primaryBtn} onClick={() => updateStatus('confirmed')}><Text>{updating ? '处理中...' : '确认预约'}</Text></View>}
        {canAdminComplete && <View className={styles.primaryBtn} onClick={() => updateStatus('completed')}><Text>{updating ? '处理中...' : '完成预约'}</Text></View>}
        {canAdminCancel && <View className={styles.cancelBtn} onClick={() => updateStatus('cancelled')}><Text>{updating ? '处理中...' : '取消预约'}</Text></View>}
      </View>
    </View>
  );
}

export default AppointmentDetailPage;
