import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import { getDateOptions } from '@/utils/date';
import type { TimeSlot } from '@/types';
import styles from './index.module.scss';

interface WeeklyConfig {
  dayOfWeek: number;
  label: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  maxCount: number;
}

function AdminTimeSlotsPage() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily'>('weekly');
  const [dateOptions] = useState(getDateOptions);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0]?.date || '');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('10:00');
  const [formMaxCount, setFormMaxCount] = useState('1');

  // 每周配置
  const [weeklyConfigs, setWeeklyConfigs] = useState<WeeklyConfig[]>([
    { dayOfWeek: 0, label: '周日', isActive: false, startTime: '09:00', endTime: '18:00', maxCount: 1 },
    { dayOfWeek: 1, label: '周一', isActive: false, startTime: '09:00', endTime: '18:00', maxCount: 1 },
    { dayOfWeek: 2, label: '周二', isActive: false, startTime: '09:00', endTime: '18:00', maxCount: 1 },
    { dayOfWeek: 3, label: '周三', isActive: false, startTime: '09:00', endTime: '18:00', maxCount: 1 },
    { dayOfWeek: 4, label: '周四', isActive: false, startTime: '09:00', endTime: '18:00', maxCount: 1 },
    { dayOfWeek: 5, label: '周五', isActive: false, startTime: '09:00', endTime: '18:00', maxCount: 1 },
    { dayOfWeek: 6, label: '周六', isActive: true, startTime: '09:00', endTime: '18:00', maxCount: 1 },
  ]);

  const loadSlots = useCallback(async (date: string) => {
    try {
      const data = await callFunction<TimeSlot[]>('getTimeSlots', { date });
      setSlots(data);
    } catch (err) {
      console.error('[AdminTimeSlots] loadSlots failed:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleToggleWeekly = (index: number) => {
    const newConfigs = [...weeklyConfigs];
    newConfigs[index].isActive = !newConfigs[index].isActive;
    setWeeklyConfigs(newConfigs);
  };

  const handleUpdateWeekly = (index: number, field: string, value: string | number) => {
    const newConfigs = [...weeklyConfigs];
    (newConfigs[index] as any)[field] = value;
    setWeeklyConfigs(newConfigs);
  };

  const handleSaveWeekly = async () => {
    try {
      await callFunction('manageTimeSlot', {
        action: 'updateWeekly',
        configs: weeklyConfigs
      });
      Taro.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      console.error('[AdminTimeSlots] saveWeekly failed:', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  const handleAdd = async () => {
    if (!formStart || !formEnd) {
      Taro.showToast({ title: '请填写时段', icon: 'none' });
      return;
    }
    try {
      await callFunction('manageTimeSlot', {
        action: 'create',
        date: selectedDate,
        startTime: formStart,
        endTime: formEnd,
        maxCount: Number(formMaxCount)
      });
      Taro.showToast({ title: '已添加', icon: 'success' });
      setShowForm(false);
      loadSlots(selectedDate);
    } catch (err) {
      console.error('[AdminTimeSlots] add failed:', err);
    }
  };

  const handleToggle = async (slot: TimeSlot) => {
    try {
      await callFunction('manageTimeSlot', {
        action: 'update',
        slotId: slot._id,
        isAvailable: !slot.isAvailable
      });
      loadSlots(selectedDate);
    } catch (err) {
      console.error('[AdminTimeSlots] toggle failed:', err);
    }
  };

  return (
    <View className={styles.page}>
      {/* Tab 切换 */}
      <View className={styles.tabs}>
        <View
          className={`${styles.tab} ${activeTab === 'weekly' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('weekly')}
        >
          <Text>每周固定</Text>
        </View>
        <View
          className={`${styles.tab} ${activeTab === 'daily' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          <Text>特殊日期</Text>
        </View>
      </View>

      {/* 每周固定配置 */}
      {activeTab === 'weekly' && (
        <View className={styles.weeklySection}>
          <Text className={styles.sectionTip}>设置每周固定的营业时间，系统会自动为未来14天生成时段</Text>
          <View className={styles.weeklyList}>
            {weeklyConfigs.map((config, index) => (
              <View key={config.dayOfWeek} className={styles.weeklyItem}>
                <View className={styles.weeklyHeader}>
                  <Text className={styles.weeklyDay}>{config.label}</Text>
                  <View
                    className={`${styles.weeklySwitch} ${config.isActive ? styles.weeklySwitchOn : ''}`}
                    onClick={() => handleToggleWeekly(index)}
                  >
                    <View className={styles.weeklySwitchDot} />
                  </View>
                </View>
                {config.isActive && (
                  <View className={styles.weeklyConfig}>
                    <View className={styles.weeklyTime}>
                      <Text className={styles.weeklyTimeLabel}>开始</Text>
                      <Input
                        className={styles.weeklyTimeInput}
                        value={config.startTime}
                        onInput={(e) => handleUpdateWeekly(index, 'startTime', e.detail.value)}
                      />
                    </View>
                    <Text className={styles.weeklyTimeSep}>-</Text>
                    <View className={styles.weeklyTime}>
                      <Text className={styles.weeklyTimeLabel}>结束</Text>
                      <Input
                        className={styles.weeklyTimeInput}
                        value={config.endTime}
                        onInput={(e) => handleUpdateWeekly(index, 'endTime', e.detail.value)}
                      />
                    </View>
                    <View className={styles.weeklyCount}>
                      <Text className={styles.weeklyTimeLabel}>每时段</Text>
                      <Input
                        className={styles.weeklyCountInput}
                        type="number"
                        value={String(config.maxCount)}
                        onInput={(e) => handleUpdateWeekly(index, 'maxCount', Number(e.detail.value))}
                      />
                      <Text className={styles.weeklyTimeLabel}>人</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
          <View className={styles.saveBtn} onClick={handleSaveWeekly}>
            <Text>保存每周配置</Text>
          </View>
        </View>
      )}

      {/* 特殊日期配置 */}
      {activeTab === 'daily' && (
        <View className={styles.dailySection}>
          <ScrollView scrollX className={styles.dateScroll}>
            {dateOptions.map(opt => (
              <View
                key={opt.date}
                className={`${styles.dateItem} ${selectedDate === opt.date ? styles.dateItemSelected : ''}`}
                onClick={() => handleDateSelect(opt.date)}
              >
                <Text className={styles.dateItemDay}>{opt.month}月</Text>
                <Text className={styles.dateItemDate}>{opt.day}</Text>
                <Text className={styles.dateItemWeekday}>{opt.weekday}</Text>
              </View>
            ))}
          </ScrollView>

          <View className={styles.slotList}>
            {slots.length > 0 ? slots.map(slot => (
              <View key={slot._id} className={styles.slotItem} onClick={() => handleToggle(slot)}>
                <Text className={styles.slotItemTime}>{slot.startTime} - {slot.endTime}</Text>
                <View className={styles.slotItemStatus}>
                  <View className={`${styles.slotItemDot} ${slot.isAvailable ? styles.slotItemDotOpen : styles.slotItemDotClosed}`} />
                  <Text className={styles.slotItemLabel}>
                    {slot.isAvailable ? '开放' : '关闭'} {slot.bookedCount > 0 ? `(已约${slot.bookedCount})` : ''}
                  </Text>
                </View>
              </View>
            )) : (
              <Text className={styles.empty}>该日期暂无时段，点击下方添加</Text>
            )}
          </View>

          <View className={styles.addBtn} onClick={() => setShowForm(true)}>
            <Text>+ 添加时段</Text>
          </View>
        </View>
      )}

      {/* 添加时段表单 */}
      {showForm && (
        <View className={styles.formOverlay} onClick={() => setShowForm(false)}>
          <View className={styles.formSheet} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.formTitle}>添加时段</Text>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>开始时间 (HH:mm)</Text>
              <Input className={styles.formInput} value={formStart} onInput={(e) => setFormStart(e.detail.value)} />
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>结束时间 (HH:mm)</Text>
              <Input className={styles.formInput} value={formEnd} onInput={(e) => setFormEnd(e.detail.value)} />
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>每时段最大预约数</Text>
              <Input className={styles.formInput} type="number" value={formMaxCount} onInput={(e) => setFormMaxCount(e.detail.value)} />
            </View>
            <View className={styles.formActions}>
              <View className={styles.formBtnCancel} onClick={() => setShowForm(false)}><Text>取消</Text></View>
              <View className={styles.formBtnSubmit} onClick={handleAdd}><Text>添加</Text></View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default AdminTimeSlotsPage;
