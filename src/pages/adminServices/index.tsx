import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { callFunction } from '@/services/cloud';
import { CATEGORY_OPTIONS, DEFAULT_CATEGORY_KEY } from '@/constants/categories';
import { formatServicePrice } from '@/utils/format';
import { getCategoryLabel, getServiceCategoryKey, getServicePriceMin } from '@/utils/service';
import type { ServiceItem } from '@/types';
import styles from './index.module.scss';

function AdminServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(DEFAULT_CATEGORY_KEY);
  const [formPrice, setFormPrice] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const loadServices = useCallback(async () => {
    try {
      const data = await callFunction<ServiceItem[]>('getServices');
      setServices(data);
    } catch (err) {
      console.error('[AdminServices] loadServices failed:', err);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const resetForm = () => {
    setFormName('');
    setFormCategory(DEFAULT_CATEGORY_KEY);
    setFormPrice('');
    setFormDuration('');
    setFormDesc('');
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (svc: ServiceItem) => {
    setEditingId(svc._id);
    setFormName(svc.name);
    setFormCategory(getServiceCategoryKey(svc));
    setFormPrice(String(getServicePriceMin(svc)));
    setFormDuration(String(svc.duration));
    setFormDesc(svc.description);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formPrice || !formDuration) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    try {
      const categoryName = getCategoryLabel(formCategory);
      const price = Number(formPrice);

      await callFunction('manageService', {
        action: editingId ? 'update' : 'create',
        serviceId: editingId,
        name: formName.trim(),
        categoryId: formCategory,
        categoryName,
        category: formCategory,
        price,
        priceMin: price,
        duration: Number(formDuration),
        description: formDesc.trim()
      });
      Taro.showToast({ title: editingId ? '已更新' : '已添加', icon: 'success' });
      setShowForm(false);
      resetForm();
      loadServices();
    } catch (err) {
      console.error('[AdminServices] submit failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    const confirm = await Taro.showModal({ title: '删除服务', content: '确定删除该服务吗？' });
    if (!confirm.confirm) return;
    try {
      await callFunction('manageService', { action: 'delete', serviceId: id });
      Taro.showToast({ title: '已删除', icon: 'success' });
      loadServices();
    } catch (err) {
      console.error('[AdminServices] delete failed:', err);
    }
  };

  return (
    <View className={styles.page}>
      <View className={styles.list}>
        {services.map(svc => (
          <View key={svc._id} className={styles.item}>
            <View className={styles.itemHeader}>
              <Text className={styles.itemName}>{svc.name}</Text>
              <View className={styles.itemActions}>
                <View className={styles.itemBtn} onClick={() => openEdit(svc)}><Text>编辑</Text></View>
                <View className={styles.itemBtn} onClick={() => handleDelete(svc._id)}><Text>删除</Text></View>
              </View>
            </View>
            <View className={styles.itemMeta}>
              <Text className={styles.itemPrice}>{formatServicePrice(svc)}</Text>
              <Text className={styles.itemDuration}>{svc.duration}分钟</Text>
              <Text className={styles.itemCategory}>
                {getCategoryLabel(getServiceCategoryKey(svc))}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className={styles.addBtn} onClick={openAdd}>
        <Text>+ 添加服务</Text>
      </View>

      {showForm && (
        <View className={styles.formOverlay} onClick={() => setShowForm(false)}>
          <View className={styles.formSheet} onClick={(e) => e.stopPropagation()}>
            <Text className={styles.formTitle}>{editingId ? '编辑服务' : '添加服务'}</Text>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>服务名称</Text>
              <Input className={styles.formInput} value={formName} onInput={(e) => setFormName(e.detail.value)} />
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>分类</Text>
              <View style={{ display: 'flex', gap: '16rpx' }}>
                {CATEGORY_OPTIONS.map(opt => (
                  <View
                    key={opt.key}
                    className={styles.itemBtn}
                    style={formCategory === opt.key ? { background: '#FF6B35', color: '#fff', borderColor: '#FF6B35' } : {}}
                    onClick={() => setFormCategory(opt.key)}
                  >
                    <Text>{opt.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>价格（元）</Text>
              <Input className={styles.formInput} type="number" value={formPrice} onInput={(e) => setFormPrice(e.detail.value)} />
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>时长（分钟）</Text>
              <Input className={styles.formInput} type="number" value={formDuration} onInput={(e) => setFormDuration(e.detail.value)} />
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>服务描述</Text>
              <Input className={styles.formInput} value={formDesc} onInput={(e) => setFormDesc(e.detail.value)} />
            </View>
            <View className={styles.formActions}>
              <View className={styles.formBtnCancel} onClick={() => setShowForm(false)}><Text>取消</Text></View>
              <View className={styles.formBtnSubmit} onClick={handleSubmit}><Text>保存</Text></View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default AdminServicesPage;
