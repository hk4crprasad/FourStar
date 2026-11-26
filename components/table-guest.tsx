'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Brand, ErrorNotice } from './shared';
import { jsonRequest, request, RequestError } from '@/lib/client';
import { currency, type Restaurant } from '@/lib/domain';
import { serviceLabels, tableStatus, type RequestKind, type TableOrder, type TableRequest } from '@/lib/table-view';

export function TableGate({ token, number, restaurant }: { token?: string; number?: string; restaurant?: Pick<Restaurant, 'name' | 'logoUrl' | 'tagline'> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get('code');
    setBusy(true);
    setError('');
    try {
      await jsonRequest('/api/table', 'POST', { action: 'join', token, code });
      window.location.reload();
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }
  return <main className="single-main table-guest"><VStack className="single-panel" gap={3}>
    <Brand restaurant={restaurant} />
    <Heading level={1}>{number ? `Welcome to ${restaurant?.name ?? 'FourStar'}` : 'Scan your table QR'}</Heading>
    {number ? <><p>You are dining at <strong>Table {number}</strong>.</p>
      <p className="muted">Enter the visit code from staff to order and track food for your table.</p>
      <form className="form-stack" onSubmit={join}>
        <label>Visit code<input name="code" required autoComplete="off" maxLength={8} minLength={8} /></label>
        <ErrorNotice>{error}</ErrorNotice>
        <Button type="submit" label="Join table" isLoading={busy} className="solid-button" />
      </form></> : <p className="muted">Use the QR card at your table or ask staff for help.</p>}
    <Link href="/food">Browse the menu</Link>
  </VStack></main>;
}

type GuestVisit = { table: string; orders: TableOrder[]; requests: Pick<TableRequest, 'type' | 'status'>[]; billed: boolean };

export function TableGuestOrders() {
  const [visit, setVisit] = useState<GuestVisit>();
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<RequestKind>();
  async function refresh() {
    try { setVisit(await request<GuestVisit>('/api/table')); setLoadError(''); }
    catch (cause) {
      if (cause instanceof RequestError && cause.status === 403) setVisit(undefined);
      setLoadError((cause as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => clearInterval(timer);
  }, []);
  async function call(type: RequestKind) {
    setPending(type); setError(''); setNotice('');
    try {
      await jsonRequest('/api/table', 'POST', { action: 'request', type });
      setNotice('Request sent to staff.');
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setPending(undefined); }
  }
  return <main className="single-main table-guest"><VStack className="single-panel" gap={3}>
    <Brand />
    <Heading level={1}>{visit ? `Table ${visit.table} orders` : 'Table orders'}</Heading>
    <ErrorNotice>{loadError || error}</ErrorNotice>
    {!visit && !loadError && <p role="status">Loading table orders…</p>}
    {!visit && loadError && <Link href="/table">Return to table ordering</Link>}
    {visit && <>
      <Link href="/table" className="text-action">Back to the table menu</Link>
      {visit.billed && <p className="muted">Staff have issued the bill for your visit.</p>}
      <HStack gap={1} wrap="wrap">
        {(Object.keys(serviceLabels) as RequestKind[]).map(type => <Button key={type} label={serviceLabels[type]} onClick={() => void call(type)}
          isLoading={pending === type} isDisabled={Boolean(pending) || visit.requests.some(req => req.type === type) || (type === 'BILL' && visit.billed)} />)}
      </HStack>
      {notice && <p role="status">{notice}</p>}
      {visit.requests.map(req => <small className="muted" key={req.type}>{serviceLabels[req.type]} · {req.status === 'ACKNOWLEDGED' ? 'Staff acknowledged' : 'Waiting for staff'}</small>)}
      {!visit.orders.length && <p>No orders for this visit yet.</p>}
      {visit.orders.map(order => <article className="admin-panel" key={order.id}>
        <Heading level={2}>{order.id}</Heading>
        <p role="status">{tableStatus[order.status]} · {currency(order.total)}</p>
        <ul>{order.items.map(item => <li key={item.id}>{item.quantity} × {item.name}</li>)}</ul>
      </article>)}
    </>}
  </VStack></main>;
}
