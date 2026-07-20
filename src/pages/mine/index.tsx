import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, Button, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import type { Appointment, AppointmentStatus } from '@/types';
import { resolveAvatarForDisplay } from './profile';
import styles from './index.module.scss';

const isWeapp = process.env.TARO_ENV === 'weapp';
const USER_STORAGE_KEY = 'userInfo';
const DEFAULT_NICKNAME = '微信用户';
const DEFAULT_AVATAR = 'default';

type MineUserInfo = {
  nickname: string;
  avatar: string;
  isAdmin?: boolean;
};

type LoginResult = {
  isNewUser: boolean;
  user: MineUserInfo | null;
};

const STATUS_MAP: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: '待确认', className: styles.appointmentCardStatusPending },
  confirmed: { label: '已确认', className: styles.appointmentCardStatusConfirmed },
  completed: { label: '已完成', className: styles.appointmentCardStatusCompleted },
  cancelled: { label: '已取消', className: styles.appointmentCardStatusCancelled }
};

function isDefaultProfile(userInfo: MineUserInfo | null) {
  return !userInfo || userInfo.nickname === DEFAULT_NICKNAME || !userInfo.avatar || userInfo.avatar === DEFAULT_AVATAR;
}

function MinePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<MineUserInfo | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileNickname, setProfileNickname] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [displayAvatar, setDisplayAvatar] = useState('');

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

  const resolveDisplayAvatar = useCallback(async (avatar: string) => {
    try {
      const resolved = await resolveAvatarForDisplay(avatar, async (fileID) => {
        const res = await Taro.cloud.getTempFileURL({ fileList: [fileID] });
        return res.fileList?.[0]?.tempFileURL || fileID;
      });
      setDisplayAvatar(resolved);
    } catch (err) {
      console.error('[Mine] resolve avatar failed:', err);
      setDisplayAvatar(avatar && avatar !== DEFAULT_AVATAR ? avatar : '');
    }
  }, []);

  useEffect(() => {
    const stored = Taro.getStorageSync(USER_STORAGE_KEY) as MineUserInfo | '';
    if (stored) {
      setUserInfo(stored);
      setIsLoggedIn(true);
      setIsAdmin(Boolean(stored.isAdmin));
      setProfileNickname(stored.nickname === DEFAULT_NICKNAME ? '' : stored.nickname);
      setProfileAvatar(stored.avatar === DEFAULT_AVATAR ? '' : stored.avatar);
      resolveDisplayAvatar(stored.avatar);
      loadAppointments();
      checkAdmin();
    }
  }, [checkAdmin, loadAppointments, resolveDisplayAvatar]);

  const uploadAvatar = async (avatarPath: string) => {
    if (!isWeapp || !avatarPath || avatarPath.startsWith('cloud://') || avatarPath.startsWith('http')) {
      return avatarPath;
    }
    const extMatch = avatarPath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const ext = extMatch?.[1] || 'png';
    const uploadRes = await Taro.cloud.uploadFile({
      cloudPath: 'avatars/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext,
      filePath: avatarPath
    });
    return uploadRes.fileID;
  };

  const handleChooseAvatar = (event: any) => {
    const avatarUrl = event.detail?.avatarUrl || '';
    setProfileAvatar(avatarUrl);
  };

  const persistLoginResult = useCallback((result: MineUserInfo) => {
    const latestUserInfo = {
      ...result,
      nickname: result.nickname || DEFAULT_NICKNAME,
      avatar: result.avatar || DEFAULT_AVATAR
    };
    setUserInfo(latestUserInfo);
    setIsLoggedIn(true);
    setIsAdmin(!isWeapp || Boolean(result.isAdmin));
    Taro.setStorageSync(USER_STORAGE_KEY, latestUserInfo);
    resolveDisplayAvatar(latestUserInfo.avatar);
    return latestUserInfo;
  }, [resolveDisplayAvatar]);

  const handleLogin = async () => {
    if (profileSubmitting) return;

    try {
      setProfileSubmitting(true);
      const result = await callFunction<LoginResult>('login', { mode: 'check' });
      if (result.isNewUser || !result.user) {
        setProfileNickname('');
        setProfileAvatar('');
        setProfileEditing(true);
        return;
      }

      const latestUserInfo = persistLoginResult(result.user);
      setProfileNickname(latestUserInfo.nickname === DEFAULT_NICKNAME ? '' : latestUserInfo.nickname);
      setProfileAvatar(latestUserInfo.avatar === DEFAULT_AVATAR ? '' : latestUserInfo.avatar);
      setProfileEditing(false);
      loadAppointments();
      checkAdmin();
      Taro.showToast({ title: '登录成功', icon: 'success' });
    } catch (err) {
      console.error('[Mine] login failed:', err);
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      setProfileSubmitting(false);
    }
  };
  const handleSaveProfile = async () => {
    if (profileSubmitting) return;
    const nickname = profileNickname.trim();
    if (!profileAvatar) {
      Taro.showToast({ title: '请选择微信头像', icon: 'none' });
      return;
    }
    if (!nickname) {
      Taro.showToast({ title: '请输入微信昵称', icon: 'none' });
      return;
    }

    try {
      setProfileSubmitting(true);
      const avatar = await uploadAvatar(profileAvatar);
      const mode = isLoggedIn ? 'updateProfile' : 'create';
      const result = await callFunction<LoginResult>('login', { mode, nickname, avatar });
      if (!result.user) {
        throw new Error('登录失败，请重试');
      }
      const latestUserInfo = persistLoginResult(result.user);
      setProfileNickname(latestUserInfo.nickname);
      setProfileAvatar(latestUserInfo.avatar);
      setProfileEditing(false);
      loadAppointments();
      checkAdmin();
      Taro.showToast({ title: isLoggedIn ? '资料已保存' : '登录成功', icon: 'success' });
    } catch (err) {
      console.error('[Mine] save profile failed:', err);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setProfileSubmitting(false);
    }
  };
  const handleLogout = () => {
    setUserInfo(null);
    setIsLoggedIn(false);
    setIsAdmin(false);
    setAppointments([]);
    setDisplayAvatar('');
    setProfileAvatar('');
    setProfileNickname('');
    setProfileEditing(false);
    Taro.removeStorageSync(USER_STORAGE_KEY);
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

  const handleBindAdmin = async () => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const input = await Taro.showModal({
      title: '绑定管理员',
      editable: true,
      placeholderText: '请输入邀请码'
    });

    if (!input.confirm) return;

    const inviteCode = String(input.content || '').trim();
    if (!inviteCode) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    try {
      await callFunction('bindAdmin', { inviteCode });
      setIsAdmin(true);
      Taro.showToast({ title: '绑定成功', icon: 'success' });
      checkAdmin();
    } catch (err) {
      const message = err instanceof Error ? err.message : '绑定失败';
      Taro.showToast({ title: message, icon: 'none' });
    }
  };

  const needsProfile = isDefaultProfile(userInfo);

  return (
    <View className={styles.page}>
      {isLoggedIn && userInfo ? (
        <View className={styles.userCard}>
          {displayAvatar ? (
            <Image className={styles.userCardAvatar} src={displayAvatar} mode="aspectFill" />
          ) : (
            <View className={styles.defaultAvatar}><Text>微</Text></View>
          )}
          <View className={styles.userCardInfo}>
            <Text className={styles.userCardName}>{userInfo.nickname || DEFAULT_NICKNAME}</Text>
            <Text className={styles.userCardDesc}>{isAdmin ? '管理员' : '普通用户'}</Text>
          </View>
          <View className={styles.profileEditBtn} onClick={() => setProfileEditing(prev => !prev)}>
            <Text>{needsProfile ? '完善资料' : '编辑资料'}</Text>
          </View>
        </View>
      ) : (
        <View className={styles.loginCard}>
          <View className={styles.loginAvatar}><Text>微</Text></View>
          <Text className={styles.loginCardTitle}>立即登录</Text>
          <Text className={styles.loginCardTip}>登录后查看预约记录和个人服务信息</Text>
          <View className={styles.loginCardBtn} onClick={handleLogin}>
            <Text>{profileSubmitting ? '登录中...' : '微信一键登录'}</Text>
          </View>
        </View>
      )}

      {profileEditing && (
        <View className={styles.profileSheetMask} onClick={() => setProfileEditing(false)}>
          <View className={styles.profileSheet} onClick={(event) => event.stopPropagation()}>
            <View className={styles.profileSheetHandle} />
            <View className={styles.profileSheetHeader}>
              <View>
                <Text className={styles.profileSheetTitle}>完善微信资料</Text>
                <Text className={styles.profileSheetTip}>用于展示你的个人页面，不影响预约使用</Text>
              </View>
              <View className={styles.profileSheetClose} onClick={() => setProfileEditing(false)}>
                <Text>×</Text>
              </View>
            </View>
            <Button className={styles.avatarBtn} openType="chooseAvatar" onChooseAvatar={handleChooseAvatar}>
              {profileAvatar ? (
                <Image className={styles.avatarPreview} src={profileAvatar} mode="aspectFill" />
              ) : (
                <Text className={styles.avatarPlaceholder}>选择头像</Text>
              )}
            </Button>
            <Input
              className={styles.nicknameInput}
              type="nickname"
              value={profileNickname}
              placeholder="点击填写微信昵称"
              placeholderClass={styles.nicknamePlaceholder}
              onInput={(e) => setProfileNickname(e.detail.value)}
            />
            <View className={styles.profileActions}>
              <View className={styles.profileCancelBtn} onClick={() => setProfileEditing(false)}>
                <Text>稍后再说</Text>
              </View>
              <View className={styles.profileSaveBtn} onClick={handleSaveProfile}>
                <Text>{profileSubmitting ? '保存中...' : '保存资料'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
      {isLoggedIn && (
        <View className={styles.menuSection}>
          <Text className={styles.menuTitle}>功能</Text>
          <View className={styles.menuList}>
            {!isAdmin && (
              <View className={styles.menuItem} onClick={handleBindAdmin}>
                <View className={styles.menuItemLeft}>
                  <Text className={styles.menuItemIcon}>🔑</Text>
                  <Text className={styles.menuItemLabel}>绑定管理员</Text>
                </View>
                <Text className={styles.menuItemArrow}>›</Text>
              </View>
            )}
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

      {isLoggedIn && (
        <View className={styles.logoutBtn} onClick={handleLogout}>
          <Text>退出登录</Text>
        </View>
      )}
    </View>
  );
}

export default MinePage;

