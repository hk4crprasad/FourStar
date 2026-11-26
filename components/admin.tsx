'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import {
  Activity, ArrowUpRight, BarChart3, Check, ChefHat, ClipboardList, Clock3, History, IndianRupee, LayoutGrid,
  LoaderCircle, LogOut, Package, Power, ReceiptText, Settings, Utensils, X,
} from 'lucide-react';
import Link from 'next/link';
import { jsonRequest, request, RequestError } from '@/lib/client';
import { currency, nextStatuses, paymentLabels, statusLabels, typeLabels, type AdminOrder, type Menu, type OrderStatus } from '@/lib/domain';
import { Catalog } from './admin-catalog';
import { Brand, ErrorNotice, Popup, PoweredBy } from './shared';

const tabs = [
  ['overview', 'Overview', LayoutGrid], ['orders', 'Live orders', ClipboardList], ['history', 'Order history', History],
  ['items', 'Menu items', Utensils], ['categories', 'Categories', Package], ['reports', 'Daily reports', BarChart3],
  ['restaurant', 'Restaurant settings', Settings],
] as const;
type Tab = typeof tabs[number][0];

type Overview = {
  live: AdminOrder[]; history: AdminOrder[]; historyCount: number; day: string;
  report: { count: number; completed: number; rejected: number; sales: number };
};

const actionLabels: Partial<Record<OrderStatus, string>> = {
  ACCEPTED: 'Accept order', REJECTED: 'Reject order', PREPARING: 'Start preparing',
  READY: 'Mark ready', OUT_FOR_DELIVERY: 'Mark out for delivery', COMPLETED: 'Complete order',
};

function Metrics({ data, live }: { data: Overview; live?: boolean }) {
  const metrics = [
    ['Orders received', data.report.count, ReceiptText],
    [live ? 'Live orders' : 'Orders rejected', live ? data.live.length : data.report.rejected, Activity],
    ['Completed', data.report.completed, Check],
    ['Sales', currency(data.report.sales), IndianRupee],
  ] as const;
  return <VStack className="metric-grid">
    {metrics.map(([label, value, Icon]) => <VStack className="metric" gap={1} key={label}>
      <Icon className="text-lime" size={19} /><strong>{value}</strong><p>{label}</p>
    </VStack>)}
  </VStack>;
}

function OrderList({ orders, update, timeZone, live }: {
  orders: AdminOrder[]; update: (id: string, status: OrderStatus) => Promise<void>; timeZone: string; live?: boolean;
}) {
  const [selectedId, select] = useState<string>();
  const [pending, setPending] = useState<OrderStatus>();
  const [error, setError] = useState('');
  const order = orders.find(entry => entry.id === selectedId);
  const datetime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone });

  async function change(status: OrderStatus) {
    if (!order || pending) return;
    setPending(status);
    setError('');
    try {
      await update(order.id, status);
      if (status === 'COMPLETED' || status === 'REJECTED') select(undefined);
    } catch (cause) { setError((cause as Error).message); }
    finally { setPending(undefined); }
  }

  if (!orders.length) return <VStack className="empty-state" gap={1} align="center">
    {live ? <ChefHat size={27} /> : <History size={27} />}
    <strong>{live ? 'No live orders' : 'No past orders'}</strong>
    <p>{live ? 'New orders will appear here automatically.' : 'Completed and rejected orders will appear here.'}</p>
  </VStack>;

  return <>
    <ul className="admin-order-list">
      {orders.map(entry => <li key={entry.id}>
        <button className="order-row" onClick={() => { select(entry.id); setError(''); }}>
          <VStack className="order-name"><strong>{entry.customerName}</strong><small>{entry.id}</small></VStack>
          <VStack className="order-type"><strong>{typeLabels[entry.type]}</strong><small>{datetime.format(new Date(entry.createdAt))}</small></VStack>
          <p className={`order-status ${entry.status === 'REJECTED' ? 'danger' : ''}`}>{statusLabels[entry.status]}</p>
          <strong className="row-price">{currency(entry.total)}</strong>
          <ArrowUpRight size={17} />
        </button>
      </li>)}
    </ul>
    {order && <Popup title={`Order for ${order.customerName}`} close={() => select(undefined)} busy={Boolean(pending)} end>
      <HStack hAlign="between" gap={1} vAlign="center">
        <code className="track-id">{order.id}</code><p className={`order-status ${order.status === 'REJECTED' ? 'danger' : ''}`}>{statusLabels[order.status]}</p>
      </HStack>
      <dl className="settings-list">
        <HStack hAlign="between" gap={1}><dt>Placed</dt><dd>{datetime.format(new Date(order.createdAt))}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Phone</dt><dd>{order.customer.mobile}</dd></HStack>
        <HStack hAlign="between" gap={1}><dt>Order type</dt><dd>{typeLabels[order.type]}</dd></HStack>
        {order.tableNumber && <HStack hAlign="between" gap={1}><dt>Table</dt><dd>{order.tableNumber}</dd></HStack>}
        {order.address && <HStack hAlign="between" gap={1}><dt>Address</dt><dd>{order.address}</dd></HStack>}
        {order.instructions && <HStack hAlign="between" gap={1}><dt>Cooking instructions</dt><dd>{order.instructions}</dd></HStack>}
        <HStack hAlign="between" gap={1}><dt>Payment</dt><dd>{paymentLabels[order.payment]}</dd></HStack>
      </dl>
      <Heading level={3}>Order items</Heading>
      <ul className="order-detail-items">
        {order.items.map(item => <li key={item.id}><HStack hAlign="between" gap={2}>
          <VStack><strong>{item.quantity} × {item.name}</strong>{item.options.length > 0 && <small>{item.options.join(', ')}</small>}</VStack>
          <strong>{currency(item.unitPrice * item.quantity)}</strong>
        </HStack></li>)}
      </ul>
      <dl className="breakdown">
        <HStack hAlign="between"><dt>Subtotal</dt><dd>{currency(order.subtotal)}</dd></HStack>
        <HStack hAlign="between"><dt>Tax</dt><dd>{currency(order.tax)}</dd></HStack>
        {order.type === 'DELIVERY' && <HStack hAlign="between"><dt>Delivery</dt><dd>{currency(order.delivery)}</dd></HStack>}
        <HStack hAlign="between" className="total"><dt>Total</dt><dd>{currency(order.total)}</dd></HStack>
      </dl>
      <ErrorNotice>{error}</ErrorNotice>
      <HStack gap={1} wrap="wrap">
        {nextStatuses(order.type, order.status).map(status => <Button key={status} label={actionLabels[status] ?? statusLabels[status]}
          icon={status === 'REJECTED' ? <X size={16} /> : <Check size={16} />} className={status === 'REJECTED' ? '' : 'solid-button'}
          variant={status === 'REJECTED' ? 'destructive' : 'secondary'} onClick={() => void change(status)} isLoading={pending === status} isDisabled={Boolean(pending && pending !== status)} />)}
      </HStack>
    </Popup>}
  </>;
}

export function Admin({ initialMenu }: { initialMenu: Menu | null }) {
  const [menu, setMenu] = useState(initialMenu);
  const [overview, setOverview] = useState<Overview>();
  const [tab, setTab] = useState<Tab>('overview');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [menuError, setMenuError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const latest = useRef(0);

  const handle = useCallback((cause: unknown, set: (message: string) => void) => {
    if (cause instanceof RequestError && cause.status === 401) {
      window.location.assign('/admin/login');
      return;
    }
    set(cause instanceof Error ? cause.message : 'Something went wrong.');
  }, []);

  const refreshMenu = useCallback(async () => {
    try { setMenu(await request<Menu>('/api/admin/catalog/restaurant')); setMenuError(''); }
    catch (cause) { handle(cause, setMenuError); }
  }, [handle]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = ++latest.current;
    const query = new URLSearchParams({ page: String(page) });
    if (date && tab === 'reports') query.set('date', date);
    try {
      const result = await request<Overview>(`/api/admin/overview?${query}`, { signal });
      if (version === latest.current && !signal?.aborted) { setOverview(result); setError(''); }
    } catch (cause) { if (!signal?.aborted && version === latest.current) handle(cause, setError); }
  }, [date, page, tab, handle]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = setInterval(() => { if (!document.hidden) void refresh(controller.signal); }, 3000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { if (!initialMenu) void refreshMenu(); }, [initialMenu, refreshMenu]);

  async function update(id: string, status: OrderStatus) {
    await jsonRequest(`/api/admin/orders/${id}`, 'PATCH', { status });
    await refresh();
  }

  async function toggle() {
    if (!menu || toggling) return;
    setToggling(true);
    setMenuError('');
    try {
      await jsonRequest('/api/admin/catalog/restaurant', 'PATCH', { isOpen: !menu.restaurant.isOpen });
      await refreshMenu();
    } catch (cause) { handle(cause, setMenuError); }
    finally { setToggling(false); }
  }

  async function signOut() {
    setLoggingOut(true);
    try { await jsonRequest('/api/admin/session', 'DELETE'); window.location.assign('/admin/login'); }
    catch (cause) { handle(cause, setError); setLoggingOut(false); }
  }

  const title = tabs.find(([key]) => key === tab)?.[1];
  const timeZone = menu?.restaurant.timeZone ?? 'Asia/Kolkata';
  const onCatalog = tab === 'items' || tab === 'categories' || tab === 'restaurant';
  return <>
    <header className="admin-header">
      <HStack className="frame" hAlign="between" vAlign="center" gap={2}>
        <Brand restaurant={menu?.restaurant} />
        <HStack className="admin-header-actions" gap={1} vAlign="center">
          <Link href="/" className="text-action"><ArrowUpRight size={16} /> Storefront</Link>
          <Button variant="ghost" label="Sign out" isIconOnly icon={<LogOut size={19} />} onClick={() => void signOut()} isLoading={loggingOut} />
        </HStack>
      </HStack>
    </header>
    <VStack className="admin-shell frame">
      <aside className="admin-nav">
        <p className="eyebrow">RESTAURANT MANAGEMENT</p>
        <nav aria-label="Admin navigation">
          {tabs.map(([key, label, Icon]) => <button key={key} className={tab === key ? 'current' : ''} aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key)}><Icon size={18} />{label}{key === 'orders' && Boolean(overview?.live.length) && <small>{overview?.live.length}</small>}</button>)}
        </nav>
        <PoweredBy />
      </aside>
      <main className="admin-main">
        <HStack className="admin-title" hAlign="between" vAlign="center" gap={2}>
          <VStack gap={1}><Heading level={1}>{title}</Heading>
            {tab === 'overview' && <p className="muted">Today’s orders and kitchen activity.</p>}
            {tab === 'orders' && <p className="muted">Incoming orders refresh automatically.</p>}
            {tab === 'reports' && <p className="muted">Sales totals include completed orders.</p>}
          </VStack>
          {menu && <HStack className="kitchen-controls" gap={1} vAlign="center">
            <p className={`open-state ${menu.acceptingOrders ? 'is-open' : ''}`}><i />{menu.acceptingOrders ? 'Open now' : 'Closed'}</p>
            <Button label={menu.restaurant.isOpen ? 'Close kitchen' : 'Open kitchen'} icon={<Power size={16} />} size="sm" isLoading={toggling} onClick={() => void toggle()} />
          </HStack>}
        </HStack>
        <ErrorNotice>{menuError}</ErrorNotice>
        <ErrorNotice>{error}</ErrorNotice>
        {!overview && !onCatalog && (!error
          ? <HStack className="admin-panel" gap={1} role="status"><LoaderCircle className="animate-spin" size={19} /> Loading orders…</HStack>
          : <Button label="Retry orders" onClick={() => void refresh()} />)}
        {onCatalog && (menu
          ? <Catalog key={tab} resource={tab} menu={menu} refresh={refreshMenu} />
          : <Button label="Retry catalog" onClick={() => void refreshMenu()} />)}
        {overview && (tab === 'overview' || tab === 'reports') && <VStack gap={3}>
          <HStack className="report-bar" hAlign="between" vAlign="center" gap={2}>
            <HStack vAlign="center" gap={1}><Clock3 size={16} /><strong>{tab === 'overview' ? 'Today' : 'Report date'}</strong><small>{timeZone}</small></HStack>
            {tab === 'reports' && <input className="field-input" type="date" aria-label="Report date" value={date || overview.day} onChange={event => setDate(event.target.value)} />}
          </HStack>
          <Metrics data={overview} live={tab === 'overview'} />
        </VStack>}
        {overview && (tab === 'orders' || tab === 'overview') && <section className="admin-panel orders-panel">
          {tab === 'overview' && <HStack className="admin-section-title" hAlign="between" vAlign="center"><Heading level={2}>Live orders</Heading><button className="text-action" onClick={() => setTab('orders')}>View live orders <ArrowUpRight size={15} /></button></HStack>}
          <OrderList orders={overview.live} update={update} timeZone={timeZone} live />
        </section>}
        {overview && tab === 'history' && <VStack className="admin-panel" gap={2}>
          <OrderList orders={overview.history} update={update} timeZone={timeZone} />
          <HStack className="admin-pagination" hAlign="end" gap={1} vAlign="center">
            <Button label="Previous page" size="sm" isDisabled={page === 1} onClick={() => setPage(value => value - 1)} />
            <p>Page {page}</p>
            <Button label="Next page" size="sm" isDisabled={page * 20 >= overview.historyCount} onClick={() => setPage(value => value + 1)} />
          </HStack>
        </VStack>}
      </main>
    </VStack>
  </>;
}
