import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import { formatServicePrice } from '@/utils/format';
import type { ServiceItem, ServiceCategory } from '@/types';
import styles from './index.module.scss';

function HomePage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    try {
      const data = await callFunction<ServiceCategory[]>('getCategories');
      setCategories(data);
    } catch (err) {
      console.error('[Home] loadCategories failed:', err);
    }
  }, []);

  const loadServices = useCallback(async (category: string) => {
    try {
      setLoading(true);
      const params = category === 'all' ? {} : { category };
      const data = await callFunction<ServiceItem[]>('getServices', params);
      setServices(data);
    } catch (err) {
      console.error('[Home] loadServices failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadServices(activeCategory);
  }, [activeCategory, loadServices]);

  const handleCategoryClick = (key: string) => {
    setActiveCategory(key);
  };

  const handleServiceClick = (service: ServiceItem) => {
    Taro.navigateTo({
      url: `/pages/serviceDetail/index?id=${service._id}`
    });
  };

  return (
    <View className={styles.page}>
      {/* 分类导航
      <ScrollView scrollX className={styles.categoriesScroll}>
        <View className={styles.categories}>
          <View
            className={`${styles.categoryItem} ${activeCategory === 'all' ? styles.categoryItemActive : ''}`}
            onClick={() => handleCategoryClick('all')}
          >
            <View className={styles.categoryItemIcon}>
              <Text>🎵</Text>
            </View>
            <Text className={styles.categoryItemLabel}>全部</Text>
          </View>
          {categories.map(cat => (
            <View
              key={cat._id}
              className={`${styles.categoryItem} ${activeCategory === cat.key ? styles.categoryItemActive : ''}`}
              onClick={() => handleCategoryClick(cat.key)}
            >
              <View className={styles.categoryItemIcon}>
                <Text>{cat.icon}</Text>
              </View>
              <Text className={styles.categoryItemLabel}>{cat.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView> */}

      {/* 服务列表 */}
      <View className={styles.sectionHeader}>
        <Text className={styles.sectionTitle}>服务项目</Text>
        <Text className={styles.sectionMore}>{services.length} 项服务</Text>
      </View>

      {services.length > 0 ? (
        <View className={styles.serviceList}>
          {services.map(service => (
            <View
              key={service._id}
              className={styles.serviceCard}
              onClick={() => handleServiceClick(service)}
            >
              <Image
                className={styles.serviceCardImage}
                src={service.image}
                mode="aspectFill"
              />
              <View className={styles.serviceCardContent}>
                <View>
                  <Text className={styles.serviceCardName}>{service.name}</Text>
                  <Text className={styles.serviceCardDesc}>{service.description}</Text>
                </View>
                <View className={styles.serviceCardFooter}>
                  <Text className={styles.serviceCardPrice}>
                    {formatServicePrice(service)}
                    <Text className={styles.serviceCardUnit}> /次</Text>
                  </Text>
                  <Text className={styles.serviceCardDuration}>{service.duration}分钟</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className={styles.empty}>
          <Text>🎵</Text>
          <Text className={styles.emptyText}>暂无服务</Text>
        </View>
      )}
    </View>
  );
}

export default HomePage;
