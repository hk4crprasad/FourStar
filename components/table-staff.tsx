'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Brand, ErrorNotice, Popup, PoweredBy } from './shared';
import { currency, nextStatuses, type MenuItem, type OrderStatus } from '@/lib/domain';
import { jsonRequest, request } from '@/lib/client';
import { serviceLabels, tableStatus, type StaffTable, type TableOrder } from '@/lib/table-view';

const closed = (order: TableOrder) => order.status === 'COMPLETED' || order.status === 'REJECTED';
const actions: Record<string, string> = { ACCEPTED: 'Accept order', PREPARING: 'Start preparing', READY: 'Mark ready', COMPLETED: 'Mark served', REJECTED: 'Cancel order' };
const minutesSince = (stamp: string) => Math.max(0, Math.floor((Date.now() - Date.parse(stamp)) / 60_000));
const qrLink = (id: string, format: string) => `/api/admin/tables/qr?id=${encodeURIComponent(id)}&format=${format}`;

function state(table: StaffTable) {
  const session = table.session;
  if (!table.enabled) return ['disabled', 'Disabled'];
  if (!session || session.closedAt) return ['available', 'Available'];
  if (Date.parse(session.expiresAt) <= Date.now()) return ['disabled', 'Session expired'];
  if (session.requests.some(req => req.type === 'BILL' && req.status !== 'RESOLVED') || session.bill) return ['bill', 'Bill requested'];
  if (session.orders.some(order => order.status === 'READY')) return ['ready', 'Ready to serve'];
  if (session.orders.some(order => order.status === 'PLACED')) return ['new', 'New order'];
  if (session.orders.some(order => ['ACCEPTED', 'PREPARING'].includes(order.status))) return ['preparing', 'Preparing'];
  if (session.orders.some(order => order.status === 'COMPLETED')) return ['served', 'Served'];
  return ['occupied', 'Occupied'];
}

function OrderCard({ order, disabled, change, remove }: {
  order: TableOrder; disabled: boolean; change: (status: OrderStatus) => void; remove?: (item: string) => void;
}) {
  const transitions = nextStatuses('DINE_IN', order.status);
  const allowCancel = ['ACCEPTED', 'PREPARING'].includes(order.status);
  return <article className="admin-panel">
    <VStack gap={2}>
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <Heading level={2}>Table {order.tableNumber}</Heading>
        <strong>{tableStatus[order.status]}</strong>
      </HStack>
      <p className="muted">{order.id} · {new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {minutesSince(order.createdAt)} min since submission</p>
      {order.status === 'PREPARING' && <p>Preparing for {minutesSince(order.events.find(event => event.status === 'PREPARING')?.at ?? order.updatedAt)} min</p>}
      <ul className="order-detail-items">{order.items.map(item => <li key={item.id}>
        <HStack hAlign="between" vAlign="center" gap={1}>
          <p>{item.quantity} × {item.name}{item.options.length > 0 && <small> · {item.options.join(', ')}</small>}</p>
          {remove && ['PLACED', 'ACCEPTED'].includes(order.status) && order.items.length > 1 && <Button label={`Remove ${item.name}`} size="sm" isDisabled={disabled} onClick={() => remove(item.id)} />}
        </HStack>
      </li>)}</ul>
      {order.instructions && <p><strong>Cooking instructions</strong> · {order.instructions}</p>}
      <strong>{currency(order.total)}</strong>
      {!closed(order) && <HStack gap={1} wrap="wrap">
        {[...transitions, ...(allowCancel ? ['REJECTED' as const] : [])].map(status => <Button key={status} label={status === 'REJECTED' && order.status === 'PLACED' ? 'Reject order' : actions[status]}
          className={status === 'REJECTED' ? undefined : 'solid-button'} isDisabled={disabled}
          onClick={() => { if (status !== 'REJECTED' || window.confirm('Cancel this order?')) change(status); }} />)}
      </HStack>}
    </VStack>
  </article>;
}

export function TableStaff({ kitchen = false }: { kitchen?: boolean }) {
  const [tables, setTables] = useState<StaffTable[]>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState<StaffTable | 'new'>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [menu, setMenu] = useState<MenuItem[]>();
  const [manual, setManual] = useState(false);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const sequence = useRef(0);
  const table = tables?.find(table => table.id === selected);
  const session = table?.session;
  const active = Boolean(session && !session.closedAt);
  const bill = session?.bill;
  const allOrders = tables?.flatMap(table => table.session?.closedAt ? [] : table.session?.orders ?? []) ?? [];
  async function refresh() {
    const version = ++sequence.current;
    try {
      const data = await request<StaffTable[]>('/api/admin/tables');
      if (version === sequence.current) setTables(data);
    } catch (cause) { if (version === sequence.current) setError((cause as Error).message); }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2400);
    return () => { clearInterval(timer); sequence.current++; };
  }, []);
  useEffect(() => {
    if (!kitchen || !tables) return;
    const ids = new Set(tables.flatMap(table => table.session?.orders.filter(order => order.status === 'PLACED').map(order => order.id) ?? []));
    const arrived = seen.current && [...ids].some(id => !seen.current?.has(id));
    seen.current = ids;
    const context = audio.current;
    if (arrived && sound && context?.state === 'running') {
      const note = context.createOscillator();
      const volume = context.createGain();
      note.frequency.value = 540;
      volume.gain.value = 0.08;
      note.connect(volume).connect(context.destination);
      note.start(); note.stop(context.currentTime + 0.18);
    }
  }, [tables, kitchen, sound]);

  async function mutate(data: object, endpoint = '/api/admin/tables', method = 'POST') {
    setBusy(true); setError('');
    try {
      await jsonRequest(endpoint, method, data);
      await refresh();
      return true;
    } catch (cause) { setError((cause as Error).message); return false; }
    finally { setBusy(false); }
  }
  const action = (action: string, id: string, extra: object = {}) => mutate({ action, id, ...extra });
  const change = (order: string, status: OrderStatus) => mutate({ status }, `/api/admin/orders/${order}`, 'PATCH');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = typeof editing === 'object' ? editing.id : undefined;
    if (await mutate({ action: 'save', id, number: form.get('number'), name: form.get('name'), capacity: Number(form.get('capacity')), enabled: form.has('enabled') })) {
      setEditing(undefined);
    }
  }
  async function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    const items = menu?.flatMap(item => {
      const quantity = Number(form.get(item.id));
      return quantity > 0 ? [{ menuItemId: item.id, quantity, picks: [] }] : [];
    });
    if (await action('manual', session.id, { order: { requestId: crypto.randomUUID(), instructions: form.get('instructions'), items } })) setManual(false);
  }
  const visibleTables = tables?.filter(table =>
    `${table.number} ${table.name}`.toLowerCase().includes(query.toLowerCase()) && (!filter || state(table)[0] === filter));
  const visibleOrders = allOrders.filter(order => !closed(order) &&
    `${order.tableNumber} ${order.id}`.toLowerCase().includes(query.toLowerCase()) && (!filter || order.status === filter));

  return <main className="frame booking-page">
    <VStack gap={3}>
      <HStack hAlign="between" wrap="wrap" gap={2}>
        <Brand />
        <HStack gap={2} wrap="wrap"><Link className="text-action" href="/admin">Dashboard</Link>
          <Link className="text-action" href={kitchen ? '/admin/tables' : '/admin/kitchen'}>{kitchen ? 'Table management' : 'Kitchen display'}</Link></HStack>
      </HStack>
      <Heading level={1}>{kitchen ? 'Kitchen display' : 'Table management'}</Heading>
      <HStack gap={2} wrap="wrap">
        <input className="field-input table-search" type="search" placeholder={kitchen ? 'Search table or order' : 'Search tables'} aria-label="Search" value={query} onChange={event => setQuery(event.target.value)} />
        <select className="field-input table-search" aria-label="Filter status" value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(kitchen ? { PLACED: 'Submitted', ACCEPTED: 'Accepted', PREPARING: 'Preparing', READY: 'Ready to serve' } :
            { available: 'Available', occupied: 'Occupied', new: 'New order', preparing: 'Preparing', ready: 'Ready', served: 'Served', bill: 'Bill requested', disabled: 'Disabled or expired' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {kitchen ? <Button label={sound ? 'Mute sound' : 'Enable notification sound'} onClick={() => {
          if (sound) { setSound(false); return; }
          audio.current ??= new AudioContext();
          void audio.current.resume().then(() => setSound(true)).catch(() => setError('Notification sound could not be enabled.'));
        }} /> : <>
          <Button className="solid-button" label="Create table" onClick={() => setEditing('new')} />
          <Link className="text-action" href="/api/admin/tables/qr?format=cards" target="_blank">Print A4 cards</Link>
          <a className="text-action" href="/api/admin/tables/qr?format=cards&download">Download all cards</a>
        </>}
      </HStack>
      <ErrorNotice>{editing || (selected && !kitchen) ? '' : error}</ErrorNotice>
      {!tables && !error && <p role="status">Loading {kitchen ? 'kitchen orders' : 'tables'}…</p>}
      {tables && (kitchen ? <section className="table-grid" aria-label="Kitchen orders">
        {!visibleOrders.length && <p>No active orders match this view.</p>}
        {visibleOrders.map(order => <OrderCard key={order.id} order={order} disabled={busy} change={status => void change(order.id, status)} />)}
      </section> : <section className="table-grid" aria-label="Restaurant floor">
        {!visibleTables?.length && <p>No tables match this view.</p>}
        {visibleTables?.map(table => {
          const [kind, label] = state(table);
          const visit = table.session?.closedAt ? null : table.session;
          const total = visit?.bill?.total ?? visit?.orders.filter(order => order.status !== 'REJECTED').reduce((n, order) => n + order.total, 0) ?? 0;
          return <button key={table.id} className={`admin-panel table-tile table-${kind}`} onClick={() => { setSelected(table.id); setError(''); }}>
            <strong>Table {table.number}</strong><b>{label}</b>
            <small>{table.name} · {table.capacity} seats{visit ? ` · ${minutesSince(visit.openedAt)} min` : ''}</small>
            {visit && <small>{visit.orders.filter(order => !closed(order)).length} active orders · {currency(total)} · {visit.requests.filter(req => req.status !== 'RESOLVED').length} requests</small>}
          </button>;
        })}
      </section>)}
      <PoweredBy />
    </VStack>

    {!editing && table && <Popup title={`Table ${table.number}`} close={() => { setSelected(''); setManual(false); }} busy={busy} end>
      <ErrorNotice>{error}</ErrorNotice>
      <HStack gap={1} wrap="wrap">
        <Button label="Edit table" onClick={() => setEditing(table)} />
        <Button label={table.token ? 'Regenerate QR' : 'Generate QR'} isDisabled={busy} onClick={() => {
          if (!table.token || window.confirm('Replace the current QR code?')) void action('rotate', table.id);
        }} />
        {table.token && <Button label="Revoke QR" isDisabled={busy} onClick={() => { if (window.confirm('Revoke this QR code?')) void action('revoke', table.id); }} />}
      </HStack>
      {table.token && <HStack gap={2} wrap="wrap">
        <a href={`/table/${table.token}`} target="_blank" rel="noreferrer">Open scan link</a>
        <a href={`${qrLink(table.id, 'png')}&download`}>Download PNG</a>
        <a href={`${qrLink(table.id, 'svg')}&download`}>Download SVG</a>
        <a href={qrLink(table.id, 'cards')} target="_blank" rel="noreferrer">Print card</a>
        <a href={`${qrLink(table.id, 'cards')}&download`}>Download card</a>
      </HStack>}
      {table.token && <img key={table.token} className="table-qr" src={qrLink(table.id, 'png')} alt={`Ordering QR for Table ${table.number}`} />}
      {!active && <Button label="Open session" isDisabled={busy || !table.enabled} className="solid-button" onClick={() => void action('open', table.id)} />}
      {session && <>
        {active && <p>Visit code <strong data-testid="visit-code">{session.code}</strong> · expires {new Date(session.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
        {active && session.requests.filter(req => req.status !== 'RESOLVED').map(req => <HStack key={req.id} gap={1} wrap="wrap" vAlign="center">
          <strong>{serviceLabels[req.type]}</strong>
          {req.status === 'PENDING' && <Button size="sm" label="Acknowledge" isDisabled={busy} onClick={() => void action('request', session.id, { requestId: req.id, status: 'ACKNOWLEDGED' })} />}
          <Button size="sm" label="Resolve" isDisabled={busy} onClick={() => void action('request', session.id, { requestId: req.id, status: 'RESOLVED' })} />
        </HStack>)}
        {active && !bill && <Button label={manual ? 'Hide manual order' : 'Add waiter order'} onClick={async () => {
          if (manual) { setManual(false); return; }
          try { setMenu((await request<{ items: MenuItem[] }>('/api/menu')).items.filter(item => item.inStock)); setManual(true); }
          catch (cause) { setError((cause as Error).message); }
        }} />}
        {manual && <form className="form-stack" onSubmit={addManual}>
          <VStack className="manual-items" gap={1}>{menu?.map(item => <label key={item.id}>{item.name}
            <input type="number" name={item.id} min="0" max="20" defaultValue="0" /></label>)}</VStack>
          <label>Cooking instructions<textarea name="instructions" maxLength={350} /></label>
          <Button label="Submit waiter order" type="submit" isDisabled={busy} />
        </form>}
        {session.orders.map(order => <OrderCard key={order.id} order={order} disabled={busy} change={status => void change(order.id, status)}
          remove={active && !bill ? itemId => void action('removeItem', session.id, { itemId }) : undefined} />)}
        {active && !bill && <form className="form-stack" onSubmit={event => {
          event.preventDefault();
          const discount = Math.round(Number(new FormData(event.currentTarget).get('discount')) * 100);
          void action('bill', session.id, { discount });
        }}>
          <label>Approved discount (₹)<input name="discount" type="number" min="0" step="0.01" defaultValue="0" /></label>
          <Button label="Generate bill" type="submit" className="checkout-button" isDisabled={busy || session.orders.some(order => !closed(order))} />
        </form>}
        {bill && <>
          <section className="table-receipt admin-panel">
            <Heading level={2}>FourStar · Table {table.number}</Heading>
            <p>Bill {bill.id}</p>
            <ul>{session.orders.filter(order => order.status === 'COMPLETED').flatMap(order => order.items.map(item => <li key={item.id}>{item.quantity} × {item.name} · {currency(item.quantity * item.unitPrice)}</li>))}</ul>
            <p>Subtotal {currency(bill.subtotal)} · Tax {currency(bill.tax)} · Discount {currency(bill.discount)}</p>
            <strong>Total {currency(bill.total)} · {bill.payments.length || !bill.total ? 'Paid' : 'Unpaid'}</strong>
            {bill.payments.map(payment => <p key={payment.method}>{payment.method} recorded · {currency(payment.amount)}</p>)}
          </section>
          <HStack gap={1} wrap="wrap">
            <Button label="Print receipt" onClick={() => window.print()} />
            {active && !bill.payments.length && bill.total > 0 && (['CASH', 'UPI'] as const).map(method => <Button key={method} label={`Record ${method === 'CASH' ? 'cash' : 'UPI'} (demo)`}
              isDisabled={busy} onClick={() => { if (window.confirm('Record full demo payment?')) void action('pay', session.id, { method }); }} />)}
          </HStack>
        </>}
        {active && <Button label="Close session" isDisabled={busy} onClick={() => { if (window.confirm('Close this table visit?')) void action('close', session.id); }} />}
      </>}
    </Popup>}
    {editing && <Popup title={editing === 'new' ? 'Create table' : 'Edit table'} close={() => setEditing(undefined)} busy={busy}>
      <form className="form-stack" onSubmit={save}>
        <label>Table number<input required name="number" pattern={String.raw`[A-Za-z0-9\-]{1,16}`} maxLength={16} defaultValue={editing === 'new' ? '' : editing.number} /></label>
        <label>Table name<input required name="name" maxLength={60} defaultValue={editing === 'new' ? '' : editing.name} /></label>
        <label>Seating capacity<input required name="capacity" type="number" min="1" max="60" defaultValue={editing === 'new' ? 4 : editing.capacity} /></label>
        <label className="check-row"><input type="checkbox" name="enabled" defaultChecked={editing === 'new' || editing.enabled} /> Enabled</label>
        <ErrorNotice>{error}</ErrorNotice>
        <Button type="submit" label="Save table" className="solid-button" isLoading={busy} />
      </form>
    </Popup>}
  </main>;
}
