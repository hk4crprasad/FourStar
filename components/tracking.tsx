'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { ArrowUpRight, Check, ChefHat, Circle, ClipboardList, Clock3, CreditCard, LoaderCircle, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { readLocal, request, RequestError } from '@/lib/client';
import { currency, isOrderId, orderTimeline, statusLabels, typeLabels, type TrackedOrder } from '@/lib/domain';
import { payWithRazorpay } from '@/lib/razorpay-checkout';
import { ErrorNotice, PoweredBy } from './shared';

export function TrackLookup() {
  const router = useRouter();
  const [lastOrder, setLastOrder] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setLastOrder(readLocal('phirmy-last-order', '')); }, []);
  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = String(new FormData(event.currentTarget).get('id')).trim().toUpperCase();
    if (!isOrderId(id)) {
      setError('Enter the full order ID from your confirmation.');
      return;
    }
    router.push(`/track/${id}`);
  }

  return <main className="single-main">
    <VStack className="track-layout">
      <VStack gap={2}>
        <p className="eyebrow">ORDER TRACKING</p>
        <Heading level={1}>Track your order</Heading>
        <p className="muted">Follow your order from our kitchen to your table.</p>
      </VStack>
      <VStack className="single-panel" gap={3}>
        <form className="form-stack" onSubmit={find}>
          <label>Order ID<input name="id" required maxLength={40} placeholder="FS-…" autoComplete="off" /></label>
          <ErrorNotice>{error}</ErrorNotice>
          <Button className="solid-button" type="submit" label="Find order" size="lg" />
        </form>
        {lastOrder && <Link className="text-action self-start" href={`/track/${lastOrder}`}>View your last order <Clock3 size={15} /></Link>}
      </VStack>
    </VStack>
    <footer className="track-footer"><PoweredBy /></footer>
  </main>;
}

export function OrderTracking({ id, placed }: { id: string; placed: boolean }) {
  const [order, setOrder] = useState<TrackedOrder>();
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paying, setPaying] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try { setOrder(await request<TrackedOrder>(`/api/orders/${encodeURIComponent(id)}`, { signal })); setError(''); }
    catch (cause) {
      if (signal?.aborted) return;
      setNotFound(cause instanceof RequestError && cause.status === 404);
      setError(cause instanceof Error ? cause.message : 'Unable to load the order.');
    }
  }, [id]);
  const finished = order?.status === 'COMPLETED' || order?.status === 'REJECTED';
  useEffect(() => {
    if (finished || notFound) return;
    const controller = new AbortController();
    const update = () => { if (!document.hidden) void refresh(controller.signal); };
    void refresh(controller.signal);
    const timer = setInterval(update, 3500);
    document.addEventListener('visibilitychange', update);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [finished, notFound, refresh]);

  async function pay() {
    if (paying) return;
    setPaying(true);
    setPaymentError('');
    try {
      if (await payWithRazorpay(id)) { setJustPaid(true); await refresh(); }
      else setPaymentError('Test checkout was closed. You can open it again.');
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : 'Unable to verify the test payment.');
    } finally { setPaying(false); }
  }

  const pendingPayment = order?.paymentVerified === false;
  const rejected = order?.status === 'REJECTED';
  const timeline = order ? (rejected ? ['PLACED', 'REJECTED'] as const : orderTimeline(order.type)) : [];
  return <main className="single-main">
    <VStack className="track-layout">
      <VStack gap={2}>
        <p className="eyebrow">ORDER TRACKING</p>
        <Heading level={1}>{pendingPayment ? 'Complete test payment' : (placed || justPaid) && order ? 'Thanks for your order.' : 'Your order status'}</Heading>
        {order && <>
          <p className="muted">Order ID</p>
          <code className="track-id">{order.id}</code>
          <HStack gap={2} vAlign="center"><MapPin size={17} aria-hidden="true" />{typeLabels[order.type]}<strong>{currency(order.total)}</strong></HStack>
          {order.type === 'ROOM_SERVICE' && <Link href="/room-service" className="text-action self-start">Back to room service</Link>}
          <Link href="/track" className="text-action self-start">Track another order</Link>
        </>}
      </VStack>
      <VStack className="single-panel" gap={3}>
        <HStack vAlign="center" gap={1}>{pendingPayment ? <CreditCard className="text-lime" size={22} /> : <ChefHat className="text-lime" size={22} />}<Heading level={2}>{pendingPayment ? 'Razorpay Test Mode' : 'Kitchen progress'}</Heading></HStack>
        <ErrorNotice>{error}</ErrorNotice>
        {!order && !error && <HStack gap={1} vAlign="center" role="status"><LoaderCircle className="animate-spin" size={18} /> Loading order…</HStack>}
        {!order && error && (notFound ? <Link href="/track" className="text-action self-start">Check another order ID</Link> : <Button label="Retry" onClick={() => void refresh()} />)}
        {pendingPayment && <>
          <p className="muted">The kitchen receives your order once the test payment is verified.</p>
          <a href="https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps#2-test-integration" target="_blank" rel="noreferrer" className="text-action self-start">Razorpay test payment details <ArrowUpRight size={14} /></a>
          <ErrorNotice>{paymentError}</ErrorNotice>
          <Button className="checkout-button" label={`Pay ${currency(order.total)} in Test Mode`} size="lg" isLoading={paying} onClick={() => void pay()} />
        </>}
        {order?.paymentVerified && <>
          {rejected && <p className="danger">The kitchen couldn’t accept this order.</p>}
          <ol className="timeline" aria-label="Order progress">
            {timeline.map(status => {
              const event = order.events.find(event => event.status === status);
              const Icon = status === 'REJECTED' ? X : event ? Check : Circle;
              return <li key={status} aria-current={status === order.status ? 'step' : undefined} className={`${event ? 'done' : ''} ${status === 'REJECTED' ? 'rejected' : ''}`}>
                <HStack className="timeline-mark" hAlign="center" vAlign="center"><Icon size={event ? 14 : 8} /></HStack>
                <VStack><strong>{statusLabels[status]}</strong>{event && <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</time>}</VStack>
              </li>;
            })}
          </ol>
          <HStack className="muted" gap={1} vAlign="center" role="status"><ClipboardList size={16} />{statusLabels[order.status]}{finished ? '' : ' · Updates automatically'}</HStack>
        </>}
      </VStack>
    </VStack>
    <footer className="track-footer"><PoweredBy /></footer>
  </main>;
}
