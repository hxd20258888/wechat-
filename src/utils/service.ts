import { CATEGORY_OPTIONS, DEFAULT_CATEGORY_KEY } from '@/constants/categories';
import type { ServiceItem } from '@/types';

export function getServiceCategoryKey(service: ServiceItem): string {
  return service.categoryId || service.category || DEFAULT_CATEGORY_KEY;
}

export function getServicePriceMin(service: ServiceItem): number {
  return service.priceMin ?? service.price ?? 0;
}

export function getCategoryLabel(categoryKey: string): string {
  return CATEGORY_OPTIONS.find(option => option.key === categoryKey)?.label || categoryKey;
}
