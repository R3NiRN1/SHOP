import { CommerceError } from './commerce-input';

export function paymentConfig() {
  if (process.env.PAYMENTS_ENABLED !== 'true') throw new CommerceError('Online checkout is not enabled. Please enquire to order.', 503);
  const secret = process.env.STRIPE_SECRET_KEY ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!/^sk_(test|live)_[a-zA-Z0-9]{8,}$/.test(secret) || !/^whsec_\S{8,}$/.test(webhookSecret)) {
    throw new CommerceError('Payment settings are incomplete.', 503);
  }
  const live = secret.startsWith('sk_live_');
  if (live && process.env.SHOP_ALLOW_LIVE_PAYMENTS !== 'true') throw new CommerceError('Live payments require explicit activation.', 503);
  let origin: string;
  try {
    const url = new URL(process.env.NEXTAUTH_URL ?? '');
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error();
    if (live && url.protocol !== 'https:') throw new Error();
    origin = url.origin;
  } catch { throw new CommerceError('Configure the shop URL before enabling checkout.', 503); }
  const delivery = process.env.SHOP_DELIVERY;
  if (delivery !== 'collection' && delivery !== 'shipping') throw new CommerceError('Choose collection or shipping in SHOP_DELIVERY.', 503);
  const shipping = process.env.SHOP_SHIPPING_PENCE ?? '';
  if (delivery === 'shipping' && !/^\d{1,6}$/.test(shipping)) throw new CommerceError('Set the postage charge in SHOP_SHIPPING_PENCE.', 503);
  return { secret, webhookSecret, live, origin, delivery, shippingPence: delivery === 'shipping' ? Number(shipping) : 0 };
}

export function paymentAvailability() {
  try {
    const config = paymentConfig();
    return { enabled: true, testMode: !config.live, delivery: config.delivery, shippingPence: config.shippingPence };
  } catch { return { enabled: false, testMode: false, delivery: '', shippingPence: 0 }; }
}
