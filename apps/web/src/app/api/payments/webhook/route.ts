import { api, json, readText } from '../../../../lib/commerce-http';
import { CommerceError } from '../../../../lib/commerce-input';
import { paymentConfig } from '../../../../lib/commerce-config';
import { handlePaymentEvent, stripeClient } from '../../../../lib/payments';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return api(async () => {
    const raw = await readText(request, 262_144);
    const signature = request.headers.get('stripe-signature');
    if (!signature) throw new CommerceError('Missing payment signature.');
    const config = paymentConfig();
    let event;
    try { event = stripeClient().webhooks.constructEvent(raw, signature, config.webhookSecret); }
    catch { throw new CommerceError('Invalid payment signature.'); }
    await handlePaymentEvent(event);
    return json({ received: true });
  });
}
