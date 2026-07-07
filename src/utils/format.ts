import type { ServiceItem } from '@/types';

type PriceLike = Partial<Pick<ServiceItem, 'priceMin' | 'priceMax' | 'price'>>;

export function formatServicePrice(service: PriceLike): string {
  const priceMin = service.priceMin ?? service.price ?? 0;

  if (service.priceMax && service.priceMax > priceMin) {
    return `\u00a5${priceMin}-${service.priceMax}`;
  }
  return `\u00a5${priceMin}`;
}
