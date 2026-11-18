import type { SellerOffer, SellerVariantOption } from '@/lib/sellers/types';
import { centsToBRL } from '@/lib/money';

export function offerDefaults(sellerId: string, variantId: string, offers: SellerOffer[], variants: SellerVariantOption[]) {
  const current = offers.find(offer => offer.seller_id === sellerId && offer.variant_id === variantId);
  const variant = variants.find(item => item.id === variantId);
  return {
    price: current ? centsToBRL(current.price_cents) : variant ? centsToBRL(variant.sale_price_cents) : '',
    commission: current ? centsToBRL(current.commission_cents) : '',
    active: current?.active ?? true,
  };
}
