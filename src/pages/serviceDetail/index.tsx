import React, { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import { useUser } from '@/hooks/useUser';
import { STORAGE_KEYS } from '@/constants/app';
import { formatServicePrice } from '@/utils/format';
import type { ServiceItem } from '@/types';
import styles from './index.module.scss';

function ServiceDetailPage() {
  const router = useRouter();
  const [service, setService] = useState<ServiceItem | null>(null);
  const { isLoggedIn, login } = useUser();

  useEffect(() => {
    const id = router.params.id;
    if (id) {
      loadService(id);
    }
  }, [router.params.id]);

  const loadService = async (id: string) => {
    try {
      const services = await callFunction<ServiceItem[]>('getServices');
      const found = services.find(s => s._id === id);
      if (found) setService(found);
    } catch (err) {
      console.error('[ServiceDetail] loadService failed:', err);
    }
  };

  const handleBook = async () => {
    if (!service) return;
    // 检查是否已登录，未登录先弹授权
    if (!isLoggedIn) {
      try {
        await login();
      } catch {
        Taro.showToast({ title: '请先登录后再预约', icon: 'none' });
        return;
      }
    }
    // 将服务信息存储到本地，预约页会读取
    Taro.setStorageSync(STORAGE_KEYS.preselectedService, {
      _id: service._id,
      name: service.name,
      priceMin: service.priceMin,
      priceMax: service.priceMax,
      duration: service.duration
    });
    Taro.switchTab({ url: '/pages/booking/index' });
  };

  if (!service) {
    return <View className={styles.page}><Text>加载中...</Text></View>;
  }

  return (
    <View className={styles.page}>
      <Image className={styles.image} src={service.image} mode="aspectFill" />
      <View className={styles.info}>
        <Text className={styles.infoName}>{service.name}</Text>
        <Text className={styles.infoPrice}>{formatServicePrice(service)}</Text>
        <View className={styles.infoMeta}>
          <Text className={styles.infoTag}>{service.categoryName || '服务'}</Text>
          <Text className={styles.infoTag}>{service.duration}分钟</Text>
        </View>
        <Text className={styles.infoDesc}>{service.description}</Text>
      </View>
      <View className={styles.bottomBar}>
        <View className={styles.bookBtn} onClick={handleBook}>
          <Text>立即预约</Text>
        </View>
      </View>
    </View>
  );
}

export default ServiceDetailPage;
