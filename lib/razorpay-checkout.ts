import { jsonRequest } from './client';

type Gateway = { verified: true } | { verified: false; keyId: string; orderId: string; amount: number; name: string };
type Signature = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type CheckoutOptions = {
  key: string; order_id: string; amount: number; currency: 'INR'; name: string; description: string;
  theme: { color: string };
  handler: (response: Signature) => void;
  modal: { ondismiss: () => void };
};
type CheckoutConstructor = new (options: CheckoutOptions) => { open: () => void };

let loading: Promise<CheckoutConstructor> | undefined;
function checkoutScript() {
  const host = window as Window & { Razorpay?: CheckoutConstructor };
  if (host.Razorpay) return Promise.resolve(host.Razorpay);
  loading ??= new Promise<CheckoutConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (result?: CheckoutConstructor) => {
      clearTimeout(timer);
      script.remove();
      if (result) resolve(result);
      else { loading = undefined; reject(new Error('Razorpay Checkout couldn’t load. Try again.')); }
    };
    script.onload = () => finish(host.Razorpay);
    script.onerror = () => finish();
    timer = setTimeout(() => finish(), 12_000);
    document.head.append(script);
  });
  return loading;
}

export async function payWithRazorpay(id: string) {
  const endpoint = `/api/orders/${encodeURIComponent(id)}/payment`;
  const gateway = await jsonRequest<Gateway>(endpoint, 'POST');
  if (gateway.verified) return true;

  const Razorpay = await checkoutScript();
  return new Promise<boolean>((resolve, reject) => {
    let verifying = false;
    const checkout = new Razorpay({
      key: gateway.keyId, order_id: gateway.orderId, amount: gateway.amount, currency: 'INR', name: gateway.name,
      description: 'Restaurant order · Test Mode', theme: { color: '#84cc16' },
      handler: response => {
        verifying = true;
        void jsonRequest<{ verified: true }>(endpoint, 'PATCH', response).then(() => resolve(true), reject);
      },
      modal: { ondismiss: () => { if (!verifying) resolve(false); } },
    });
    checkout.open();
  });
}
