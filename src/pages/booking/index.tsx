import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Input, Textarea } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import { useUser } from '@/hooks/useUser';
import { STORAGE_KEYS } from '@/constants/app';
import { getDateOptions, type DateOption } from '@/utils/date';
import { formatServicePrice } from '@/utils/format';
import type { ServiceItem, TimeSlot } from '@/types';
import styles from './index.module.scss';

function BookingPage() {
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [dateOptions] = useState<DateOption[]>(() => getDateOptions(1, 14));
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { isLoggedIn, loading } = useUser();

  // 检查是否有预选服务（从服务详情页跳转过来）
  useDidShow(() => {
    // 未登录不能预约（等 user hook 加载完再判断）
    if (!loading && !isLoggedIn) {
      Taro.showToast({ title: '请先登录后再预约', icon: 'none' });
      setTimeout(() => Taro.switchTab({ url: '/pages/mine/index' }), 1500);
      return;
    }
    const preselected = Taro.getStorageSync(STORAGE_KEYS.preselectedService);
    if (preselected) {
      // 清除预选缓存
      Taro.removeStorageSync(STORAGE_KEYS.preselectedService);
      // 设置预选服务并跳到第二步
      setSelectedService(preselected as ServiceItem);
      setStep(1);
    }
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const data = await callFunction<ServiceItem[]>('getServices');
      setServices(data);
    } catch (err) {
      console.error('[Booking] loadServices failed:', err);
    }
  };

  const loadTimeSlots = useCallback(async (date: string) => {
    try {
      const data = await callFunction<TimeSlot[]>('getTimeSlots', { date });
      setTimeSlots(data);
    } catch (err) {
      console.error('[Booking] loadTimeSlots failed:', err);
      setTimeSlots([]);
    }
  }, []);

  const handleSelectService = (service: ServiceItem) => {
    setSelectedService(service);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot('');
    loadTimeSlots(date);
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    if (slot.bookedCount >= slot.maxCount) return;
    setSelectedSlot(`${slot.startTime}-${slot.endTime}`);
  };

  const canNext = () => {
    if (step === 0) return !!selectedService;
    if (step === 1) return !!selectedDate && !!selectedSlot;
    if (step === 2) return customerName.trim() && phone.trim() && carModel.trim();
    return false;
  };

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录后再预约', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      const priceStr = formatServicePrice(selectedService!);

      await callFunction('createAppointment', {
        serviceId: selectedService!._id,
        serviceName: selectedService!.name,
        servicePrice: priceStr,
        date: selectedDate,
        timeSlot: selectedSlot,
        customerName: customerName.trim(),
        phone: phone.trim(),
        carModel: carModel.trim(),
        remark: remark.trim()
      });
      Taro.showToast({ title: '预约成功！', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/mine/index' });
      }, 1500);
    } catch (err) {
      console.error('[Booking] submit failed:', err);
      Taro.showToast({ title: '预约失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ['选择服务', '选择时间', '填写信息'];

  return (
    <View className={styles.page}>
      {/* 步骤指示器 */}
      <View className={styles.steps}>
        {stepLabels.map((label, i) => (
          <React.Fragment key={i}>
            <View className={styles.step}>
              <View className={`${styles.stepDot} ${i === step ? styles.stepDotActive : ''} ${i < step ? styles.stepDotDone : ''}`}>
                <Text>{i < step ? '✓' : i + 1}</Text>
              </View>
              <Text className={`${styles.stepLabel} ${i === step ? styles.stepLabelActive : ''}`}>{label}</Text>
            </View>
            {i < stepLabels.length - 1 && (
              <View className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Step 0: 选择服务 */}
      {step === 0 && (
        <View className={styles.formSection}>
          <Text className={styles.formLabel}>选择服务项目</Text>
          <View className={styles.serviceGrid}>
            {services.map(svc => (
              <View
                key={svc._id}
                className={`${styles.serviceOption} ${selectedService?._id === svc._id ? styles.serviceOptionSelected : ''}`}
                onClick={() => handleSelectService(svc)}
              >
                <Text className={styles.serviceOptionName}>{svc.name}</Text>
                <Text className={styles.serviceOptionPrice}>{formatServicePrice(svc)}</Text>
                <Text className={styles.serviceOptionDuration}>{svc.duration}分钟</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Step 1: 选择时间 */}
      {step === 1 && (
        <View className={styles.formSection}>
          {/* 显示已选服务 */}
          {selectedService && (
            <View className={styles.selectedServiceTag}>
              <Text className={styles.selectedServiceTagLabel}>已选服务：</Text>
              <Text className={styles.selectedServiceTagValue}>{selectedService.name}</Text>
              <Text className={styles.selectedServiceTagPrice}>{formatServicePrice(selectedService)}</Text>
            </View>
          )}

          <Text className={styles.formLabel}>选择日期</Text>
          <ScrollView scrollX className={styles.dateScroll}>
            {dateOptions.map(opt => (
              <View
                key={opt.date}
                className={`${styles.dateItem} ${selectedDate === opt.date ? styles.dateItemSelected : ''}`}
                onClick={() => handleSelectDate(opt.date)}
              >
                <Text className={styles.dateItemDay}>{opt.month}月</Text>
                <Text className={styles.dateItemDate}>{opt.day}</Text>
                <Text className={styles.dateItemWeekday}>{opt.weekday}</Text>
              </View>
            ))}
          </ScrollView>

          {selectedDate && (
            <View style={{ marginTop: '32rpx' }}>
              <Text className={styles.formLabel}>选择时段</Text>
              {timeSlots.length > 0 ? (
                <View className={styles.timeGrid}>
                  {timeSlots.map(slot => {
                    const slotLabel = `${slot.startTime}-${slot.endTime}`;
                    const isFull = slot.bookedCount >= slot.maxCount;
                    return (
                      <View
                        key={slot._id}
                        className={`${styles.timeOption} ${selectedSlot === slotLabel ? styles.timeOptionSelected : ''} ${isFull ? styles.timeOptionDisabled : ''}`}
                        onClick={() => handleSelectSlot(slot)}
                      >
                        <Text className={styles.timeOptionText}>{slot.startTime}-{slot.endTime}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text className={styles.emptySlot}>该日期暂无可预约时段</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Step 2: 填写信息 */}
      {step === 2 && (
        <View className={styles.formSection}>
          {/* 显示预约摘要 */}
          <View className={styles.bookingSummary}>
            <Text className={styles.bookingSummaryTitle}>预约摘要</Text>
            <View className={styles.bookingSummaryRow}>
              <Text className={styles.bookingSummaryLabel}>服务</Text>
              <Text className={styles.bookingSummaryValue}>{selectedService?.name}</Text>
            </View>
            <View className={styles.bookingSummaryRow}>
              <Text className={styles.bookingSummaryLabel}>时间</Text>
              <Text className={styles.bookingSummaryValue}>{selectedDate} {selectedSlot}</Text>
            </View>
            <View className={styles.bookingSummaryRow}>
              <Text className={styles.bookingSummaryLabel}>价格</Text>
              <Text className={styles.bookingSummaryValue}>{selectedService ? formatServicePrice(selectedService) : ''}</Text>
            </View>
          </View>

          <Text className={styles.formLabel}>填写预约信息</Text>
          <View className={styles.inputGroup}>
            <Text className={styles.inputLabel}>姓名 *</Text>
            <Input
              className={styles.inputField}
              placeholder="请输入您的姓名"
              placeholderClass={styles.inputField}
              value={customerName}
              onInput={(e) => setCustomerName(e.detail.value)}
            />
          </View>
          <View className={styles.inputGroup}>
            <Text className={styles.inputLabel}>手机号 *</Text>
            <Input
              className={styles.inputField}
              type="number"
              maxlength={11}
              placeholder="请输入手机号"
              placeholderClass={styles.inputField}
              value={phone}
              onInput={(e) => setPhone(e.detail.value)}
            />
          </View>
          <View className={styles.inputGroup}>
            <Text className={styles.inputLabel}>车型 *</Text>
            <Input
              className={styles.inputField}
              placeholder="如：丰田凯美瑞 2024款"
              placeholderClass={styles.inputField}
              value={carModel}
              onInput={(e) => setCarModel(e.detail.value)}
            />
          </View>
          <View className={styles.inputGroup}>
            <Text className={styles.inputLabel}>备注（选填）</Text>
            <Textarea
              className={styles.textareaField}
              placeholder="有什么特殊需求可以在这里说明"
              placeholderClass={styles.textareaField}
              value={remark}
              onInput={(e) => setRemark(e.detail.value)}
            />
          </View>
        </View>
      )}

      {/* 底部按钮 */}
      <View className={styles.bottomBar}>
        {step > 0 && (
          <View className={styles.backBtn} onClick={handleBack}>
            <Text>上一步</Text>
          </View>
        )}
        <View
          className={`${styles.submitBtn} ${!canNext() ? styles.submitBtnDisabled : ''} ${step === 0 ? styles.submitBtnFull : ''}`}
          onClick={handleNext}
        >
          <Text>{step === 2 ? (submitting ? '提交中...' : '确认预约') : '下一步'}</Text>
        </View>
      </View>
    </View>
  );
}

export default BookingPage;
