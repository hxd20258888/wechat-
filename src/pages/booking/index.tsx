import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Input, Textarea, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import { STORAGE_KEYS } from '@/constants/app';
import { formatDateKey, WEEKDAYS } from '@/utils/date';
import { formatServicePrice } from '@/utils/format';
import type { ServiceItem, TimeSlot, UserInfo, AvailableDate, AppointmentCreateResult } from '@/types';
import styles from './index.module.scss';

type LoginResult = {
  isNewUser: boolean;
  user: UserInfo | null;
};

const USER_STORAGE_KEY = 'userInfo';
const DEFAULT_NICKNAME = '微信用户';
const DEFAULT_AVATAR = 'default';

function isAuthorizedUser(user: UserInfo | null) {
  return Boolean(
    user &&
    user.nickname &&
    user.avatar &&
    user.nickname !== DEFAULT_NICKNAME &&
    user.avatar !== DEFAULT_AVATAR
  );
}

function buildDateRange() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 30);
  return { startDate: formatDateKey(start), endDate: formatDateKey(end) };
}

function buildDateDisplay(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { month: '', day: dateKey, weekday: '' };
  }
  return {
    month: String(date.getMonth() + 1),
    day: String(date.getDate()),
    weekday: WEEKDAYS[date.getDay()]
  };
}

function BookingPage() {
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [datesError, setDatesError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [carModel, setCarModel] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [authNickname, setAuthNickname] = useState('');
  const [authAvatar, setAuthAvatar] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [result, setResult] = useState<AppointmentCreateResult | null>(null);

  const refreshUserFromStorage = useCallback(() => {
    const stored = Taro.getStorageSync(USER_STORAGE_KEY) as UserInfo | '';
    setUserInfo(stored || null);
  }, []);

  const loadServices = useCallback(async () => {
    try {
      setServicesLoading(true);
      setServicesError('');
      const data = await callFunction<ServiceItem[]>('getServices');
      setServices(data || []);
    } catch (err) {
      console.error('[Booking] loadServices failed:', err);
      setServicesError('服务加载失败，请重试');
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  const loadAvailableDates = useCallback(async () => {
    try {
      setDatesLoading(true);
      setDatesError('');
      const range = buildDateRange();
      const data = await callFunction<AvailableDate[]>('getTimeSlots', {
        mode: 'availableDates',
        ...range
      });
      setAvailableDates(data || []);
    } catch (err) {
      console.error('[Booking] loadAvailableDates failed:', err);
      setDatesError('可预约时间加载失败，请重试');
      setAvailableDates([]);
    } finally {
      setDatesLoading(false);
    }
  }, []);

  const loadTimeSlots = useCallback(async (date: string) => {
    try {
      setSlotsLoading(true);
      setSlotsError('');
      const data = await callFunction<TimeSlot[]>('getTimeSlots', { date });
      setTimeSlots(data || []);
    } catch (err) {
      console.error('[Booking] loadTimeSlots failed:', err);
      setSlotsError('时段加载失败，请重试');
      setTimeSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useDidShow(() => {
    refreshUserFromStorage();
    const preselected = Taro.getStorageSync(STORAGE_KEYS.preselectedService);
    if (preselected) {
      Taro.removeStorageSync(STORAGE_KEYS.preselectedService);
      setSelectedService(preselected as ServiceItem);
      setStep(1);
      loadAvailableDates();
    }
  });

  useEffect(() => {
    refreshUserFromStorage();
    loadServices();
  }, [loadServices, refreshUserFromStorage]);

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
    if (result) return false;
    if (step === 0) return !!selectedService;
    if (step === 1) return !!selectedDate && !!selectedSlot;
    if (step === 2) return Boolean(customerName.trim() && phone.trim() && carModel.trim());
    return false;
  };

  const uploadAvatar = async (avatarPath: string) => {
    if (!avatarPath || avatarPath.startsWith('cloud://') || avatarPath.startsWith('http')) {
      return avatarPath;
    }
    const extMatch = avatarPath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const ext = extMatch?.[1] || 'png';
    const uploadRes = await Taro.cloud.uploadFile({
      cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
      filePath: avatarPath
    });
    return uploadRes.fileID;
  };

  const openAuthSheet = () => {
    setAuthNickname(userInfo?.nickname === DEFAULT_NICKNAME ? '' : userInfo?.nickname || '');
    setAuthAvatar(userInfo?.avatar === DEFAULT_AVATAR ? '' : userInfo?.avatar || '');
    setAuthVisible(true);
  };

  const handleSaveAuth = async () => {
    if (authSubmitting) return;
    const nickname = authNickname.trim();
    if (!authAvatar) {
      Taro.showToast({ title: '请选择微信头像', icon: 'none' });
      return;
    }
    if (!nickname) {
      Taro.showToast({ title: '请输入微信昵称', icon: 'none' });
      return;
    }

    try {
      setAuthSubmitting(true);
      const avatar = await uploadAvatar(authAvatar);
      const mode = userInfo ? 'updateProfile' : 'create';
      const loginResult = await callFunction<LoginResult>('login', { mode, nickname, avatar });
      if (!loginResult.user) {
        throw new Error('授权失败，请重试');
      }
      Taro.setStorageSync(USER_STORAGE_KEY, loginResult.user);
      setUserInfo(loginResult.user);
      setAuthVisible(false);
      setStep(2);
    } catch (err) {
      console.error('[Booking] save auth failed:', err);
      Taro.showToast({ title: err instanceof Error ? err.message : '授权失败，请重试', icon: 'none' });
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!canNext()) return;
    if (step === 0) {
      setStep(1);
      if (!availableDates.length) loadAvailableDates();
      return;
    }
    if (step === 1) {
      if (!isAuthorizedUser(userInfo)) {
        openAuthSheet();
        return;
      }
      setStep(2);
      return;
    }
    handleSubmit();
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleReturnPrevious = () => {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      Taro.navigateBack();
    } else {
      Taro.switchTab({ url: '/pages/home/index' });
    }
  };

  const resetBooking = () => {
    setResult(null);
    setStep(0);
    setSelectedService(null);
    setSelectedDate('');
    setSelectedSlot('');
    setTimeSlots([]);
    setCustomerName('');
    setPhone('');
    setCarModel('');
    setRemark('');
    loadServices();
  };

  const handleSubmit = async () => {
    if (submitting || !selectedService) return;
    if (!isAuthorizedUser(userInfo)) {
      openAuthSheet();
      return;
    }
    setSubmitting(true);
    try {
      const priceStr = formatServicePrice(selectedService);
      const data = await callFunction<AppointmentCreateResult>('createAppointment', {
        serviceId: selectedService._id,
        serviceName: selectedService.name,
        servicePrice: priceStr,
        date: selectedDate,
        timeSlot: selectedSlot,
        customerName: customerName.trim(),
        phone: phone.trim(),
        carModel: carModel.trim(),
        remark: remark.trim()
      });
      setResult({
        ...data,
        serviceName: data?.serviceName || selectedService.name,
        date: data?.date || selectedDate,
        timeSlot: data?.timeSlot || selectedSlot,
        status: data?.status || 'pending'
      });
    } catch (err) {
      console.error('[Booking] submit failed:', err);
      Taro.showToast({ title: err instanceof Error ? err.message : '预约失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ['选择服务', '选择时间', '填写信息'];

  if (result) {
    return (
      <View className={styles.page}>
        <View className={styles.resultPanel}>
          <Text className={styles.resultTitle}>预约已提交</Text>
          <Text className={styles.resultDesc}>等待技师确认</Text>
          <View className={styles.resultRows}>
            <Text className={styles.resultRow}>预约编号：{result._id}</Text>
            <Text className={styles.resultRow}>服务项目：{result.serviceName}</Text>
            <Text className={styles.resultRow}>预约时间：{result.date} {result.timeSlot}</Text>
            <Text className={styles.resultRow}>联系人：{customerName.trim()} {phone.trim()}</Text>
          </View>
        </View>
        <View className={styles.resultActions}>
          <View className={styles.submitBtn} onClick={() => Taro.switchTab({ url: '/pages/mine/index' })}><Text>查看我的预约</Text></View>
          <View className={styles.secondaryBtn} onClick={resetBooking}><Text>继续预约</Text></View>
          <View className={styles.secondaryBtn} onClick={() => Taro.switchTab({ url: '/pages/home/index' })}><Text>返回首页</Text></View>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.page}>
      <View className={styles.steps}>
        {stepLabels.map((label, i) => (
          <React.Fragment key={label}>
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

      {step === 0 && (
        <View className={styles.formSection}>
          <Text className={styles.formLabel}>选择服务项目</Text>
          {servicesLoading ? <Text className={styles.emptySlot}>服务加载中...</Text> : null}
          {servicesError ? <View className={styles.emptyState}><Text>{servicesError}</Text><View className={styles.retryBtn} onClick={loadServices}><Text>重试</Text></View></View> : null}
          {!servicesLoading && !servicesError && services.length === 0 ? (
            <View className={styles.emptyState}>
              <Text>暂无可预约服务，请稍后再试或联系门店</Text>
              <View className={styles.retryBtn} onClick={handleReturnPrevious}><Text>返回上一层</Text></View>
            </View>
          ) : null}
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

      {step === 1 && (
        <View className={styles.formSection}>
          {selectedService && (
            <View className={styles.selectedServiceTag}>
              <Text className={styles.selectedServiceTagLabel}>已选服务：</Text>
              <Text className={styles.selectedServiceTagValue}>{selectedService.name}</Text>
              <Text className={styles.selectedServiceTagPrice}>{formatServicePrice(selectedService)}</Text>
            </View>
          )}

          <Text className={styles.formLabel}>选择日期</Text>
          {datesLoading ? <Text className={styles.emptySlot}>可预约日期加载中...</Text> : null}
          {datesError ? <View className={styles.emptyState}><Text>{datesError}</Text><View className={styles.retryBtn} onClick={loadAvailableDates}><Text>重试</Text></View></View> : null}
          {!datesLoading && !datesError && availableDates.length === 0 ? (
            <View className={styles.emptyState}><Text>暂无可预约时间，请稍后再试或联系门店</Text></View>
          ) : null}
          {availableDates.length > 0 && (
            <ScrollView scrollX className={styles.dateScroll}>
              {availableDates.map(opt => {
                const display = buildDateDisplay(opt.date);
                return (
                  <View
                    key={opt.date}
                    className={`${styles.dateItem} ${selectedDate === opt.date ? styles.dateItemSelected : ''}`}
                    onClick={() => handleSelectDate(opt.date)}
                  >
                    <Text className={styles.dateItemDay}>{display.month ? `${display.month}月` : ''}</Text>
                    <Text className={styles.dateItemDate}>{display.day}</Text>
                    <Text className={styles.dateItemWeekday}>{display.weekday}</Text>
                    <Text className={styles.dateItemCount}>{opt.availableCount}个时段</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {selectedDate && (
            <View style={{ marginTop: '32rpx' }}>
              <Text className={styles.formLabel}>选择时段</Text>
              {slotsLoading ? <Text className={styles.emptySlot}>时段加载中...</Text> : null}
              {slotsError ? <View className={styles.emptyState}><Text>{slotsError}</Text><View className={styles.retryBtn} onClick={() => loadTimeSlots(selectedDate)}><Text>重试</Text></View></View> : null}
              {!slotsLoading && !slotsError && timeSlots.length === 0 ? <Text className={styles.emptySlot}>该日期暂无可预约时段</Text> : null}
              {timeSlots.length > 0 && (
                <View className={styles.timeGrid}>
                  {timeSlots.map(slot => {
                    const slotLabel = `${slot.startTime}-${slot.endTime}`;
                    return (
                      <View
                        key={slot._id}
                        className={`${styles.timeOption} ${selectedSlot === slotLabel ? styles.timeOptionSelected : ''}`}
                        onClick={() => handleSelectSlot(slot)}
                      >
                        <Text className={styles.timeOptionText}>{slot.startTime}-{slot.endTime}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {step === 2 && (
        <View className={styles.formSection}>
          <View className={styles.bookingSummary}>
            <Text className={styles.bookingSummaryTitle}>预约摘要</Text>
            <View className={styles.bookingSummaryRow}><Text className={styles.bookingSummaryLabel}>服务</Text><Text className={styles.bookingSummaryValue}>{selectedService?.name}</Text></View>
            <View className={styles.bookingSummaryRow}><Text className={styles.bookingSummaryLabel}>时间</Text><Text className={styles.bookingSummaryValue}>{selectedDate} {selectedSlot}</Text></View>
            <View className={styles.bookingSummaryRow}><Text className={styles.bookingSummaryLabel}>价格</Text><Text className={styles.bookingSummaryValue}>{selectedService ? formatServicePrice(selectedService) : ''}</Text></View>
          </View>

          <Text className={styles.formLabel}>填写预约信息</Text>
          <View className={styles.inputGroup}><Text className={styles.inputLabel}>姓名 *</Text><Input className={styles.inputField} placeholder="请输入您的姓名" value={customerName} onInput={(e) => setCustomerName(e.detail.value)} /></View>
          <View className={styles.inputGroup}><Text className={styles.inputLabel}>手机号 *</Text><Input className={styles.inputField} type="number" maxlength={11} placeholder="请输入手机号" value={phone} onInput={(e) => setPhone(e.detail.value)} /></View>
          <View className={styles.inputGroup}><Text className={styles.inputLabel}>车型 *</Text><Input className={styles.inputField} placeholder="如：丰田凯美瑞 2024款" value={carModel} onInput={(e) => setCarModel(e.detail.value)} /></View>
          <View className={styles.inputGroup}><Text className={styles.inputLabel}>备注（选填）</Text><Textarea className={styles.textareaField} placeholder="有什么特殊需求可以在这里说明" value={remark} onInput={(e) => setRemark(e.detail.value)} /></View>
        </View>
      )}

      <View className={styles.bottomBar}>
        {step > 0 && <View className={styles.backBtn} onClick={handleBack}><Text>上一步</Text></View>}
        <View className={`${styles.submitBtn} ${!canNext() ? styles.submitBtnDisabled : ''} ${step === 0 ? styles.submitBtnFull : ''}`} onClick={handleNext}>
          <Text>{step === 2 ? (submitting ? '提交中...' : '确认预约') : '下一步'}</Text>
        </View>
      </View>

      {authVisible && (
        <View className={styles.authMask}>
          <View className={styles.authSheet}>
            <Text className={styles.authTitle}>完善微信头像昵称</Text>
            <Text className={styles.authDesc}>预约会绑定到你的微信身份，退出后再次登录也能查看自己的预约记录。</Text>
            <Button className={styles.avatarBtn} openType="chooseAvatar" onChooseAvatar={(event) => setAuthAvatar(event.detail.avatarUrl)}>
              <Text>{authAvatar ? '已选择头像' : '选择微信头像'}</Text>
            </Button>
            <Input className={styles.inputField} type="nickname" placeholder="请输入微信昵称" value={authNickname} onInput={(e) => setAuthNickname(e.detail.value)} />
            <View className={styles.authActions}>
              <View className={styles.secondaryBtn} onClick={() => setAuthVisible(false)}><Text>取消</Text></View>
              <View className={`${styles.submitBtn} ${authSubmitting ? styles.submitBtnDisabled : ''}`} onClick={handleSaveAuth}><Text>{authSubmitting ? '保存中...' : '保存并继续'}</Text></View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default BookingPage;
