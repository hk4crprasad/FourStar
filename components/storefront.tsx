'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Bike, ChevronLeft, ChevronRight, Clock3,
  Flame, House, Leaf, MapPin, Minus, Plus, ReceiptText, Search, ShoppingBag, Trash2, Utensils, UtensilsCrossed, X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { jsonRequest, readLocal, request, writeLocal } from '@/lib/client';
import { currency, itemPrice, paymentLabels, payments, totals, typeLabels, type CartLine, type Menu, type MenuItem, type OrderType } from '@/lib/domain';
import { Brand, ErrorNotice, Photo, Popup, PoweredBy } from './shared';

const modeIcons = { DELIVERY: Bike, TAKEAWAY: ShoppingBag, DINE_IN: Utensils };
const modes = ['DELIVERY', 'TAKEAWAY', 'DINE_IN'] as const;
const cartKey = 'phirmy-cart';
const typeKey = 'phirmy-mode';

type Line = CartLine & { key: string; item?: MenuItem; price: number; invalid: boolean };
const lineKey = (line: CartLine) => JSON.stringify([line.menuItemId, line.picks]);

function Diet({ veg }: { veg: boolean }) {
  return <i className={`diet-icon ${veg ? 'vegetarian' : 'non-vegetarian'}`} role="img" aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'} title={veg ? 'Vegetarian' : 'Non-vegetarian'} />;
}

function Stepper({ quantity, name, minus, plus, blocked }: { quantity: number; name: string; minus: () => void; plus: () => void; blocked?: boolean }) {
  return <HStack className="stepper" vAlign="center">
    <button type="button" aria-label={`Decrease ${name} quantity`} onClick={minus}><Minus size={14} /></button>
    <motion.strong key={quantity} initial={{ opacity: 0.5, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}>{quantity}</motion.strong>
    <button type="button" aria-label={`Increase ${name} quantity`} onClick={plus} disabled={blocked}><Plus size={14} /></button>
  </HStack>;
}

function FoodCard({ item, add, quantity, change }: { item: MenuItem; add: () => void; quantity: number; change: (delta: number) => void }) {
  return <VStack as="article" className={`food-card ${item.inStock ? '' : 'sold-out'}`}>
    <VStack className="food-photo">
      <Photo src={item.imageUrl} alt={item.name} />
      {!item.inStock && <small className="stock-tag">Sold out</small>}
    </VStack>
    <VStack className="food-info">
      <HStack vAlign="center" gap={1} className="dish-title"><Diet veg={item.vegetarian} /><Heading level={3}>{item.name}</Heading></HStack>
      <p>{item.description}</p>
      <HStack className="food-bottom" vAlign="center" hAlign="between" gap={1}>
        <strong>{currency(item.price)}</strong>
        {item.options.length === 0 && quantity > 0
          ? <Stepper name={item.name} quantity={quantity} minus={() => change(-1)} plus={() => change(1)} blocked={!item.inStock || quantity >= 50} />
          : <Button className="add-button" size="sm" label={`Add ${item.name}`} icon={<Plus size={15} />} onClick={add} isDisabled={!item.inStock}>Add{quantity ? ` · ${quantity}` : ''}</Button>}
      </HStack>
    </VStack>
  </VStack>;
}

function ModePicker({ type, select }: { type: OrderType; select: (type: OrderType) => void }) {
  return <HStack className="mode-picker" role="group" aria-label="Order type">
    {modes.map(mode => {
      const Icon = modeIcons[mode];
      return <button type="button" className={type === mode ? 'selected' : ''} aria-pressed={type === mode} key={mode} onClick={() => select(mode)}>
        <Icon size={15} />{typeLabels[mode]}
      </button>;
    })}
  </HStack>;
}

function Breakdown({ amount, deliveryType, taxBps, empty }: { amount: ReturnType<typeof totals>; deliveryType: OrderType; taxBps: number; empty?: boolean }) {
  return <dl className="breakdown">
    <HStack hAlign="between"><dt>Subtotal</dt><dd>{currency(amount.subtotal)}</dd></HStack>
    <HStack hAlign="between"><dt>Tax ({taxBps / 100}%)</dt><dd>{currency(amount.tax)}</dd></HStack>
    {deliveryType === 'DELIVERY' && <HStack hAlign="between"><dt>Delivery fee</dt><dd>{empty ? '—' : currency(amount.delivery)}</dd></HStack>}
    <HStack hAlign="between" className="total"><dt>Total</dt><dd>{currency(amount.total)}</dd></HStack>
  </dl>;
}

function CartContents({ lines, count, type, setType, change, remove, amount, taxBps, canOrder, checkout }: {
  lines: Line[]; count: number; type: OrderType; setType: (type: OrderType) => void;
  change: (line: CartLine, delta: number) => void; remove: (key: string) => void;
  amount: ReturnType<typeof totals>; taxBps: number; canOrder: boolean; checkout: () => void;
}) {
  const invalid = lines.some(line => line.invalid);
  return <>
    <ModePicker type={type} select={setType} />
    {count === 0 ? <VStack className="empty-cart" align="center">
      <HStack className="empty-cart-icon" hAlign="center" vAlign="center"><ShoppingBag size={35} strokeWidth={1.45} /></HStack>
      <strong>Your cart is empty</strong>
      <p>Add something delicious from the menu to get started.</p>
    </VStack> : <motion.ul className="cart-lines" layout aria-live="polite">
      <AnimatePresence initial={false}>
        {lines.map(line => <motion.li layout key={line.key} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
          <Photo src={line.item?.imageUrl ?? ''} />
          <VStack className="cart-line-details">
            <strong>{line.item?.name ?? 'Dish removed'}</strong>
            {line.picks.length > 0 && <small>{line.picks.join(', ')}</small>}
            {line.invalid && <small className="danger">Unavailable</small>}
            <HStack hAlign="between" vAlign="center" gap={1}>
              <Stepper name={line.item?.name ?? 'Dish'} quantity={line.quantity} minus={() => change(line, -1)} plus={() => change(line, 1)} blocked={line.invalid || line.quantity >= 50 || count >= 100} />
              <b>{currency(line.price * line.quantity)}</b>
            </HStack>
          </VStack>
          <Button isIconOnly variant="ghost" size="sm" label={`Remove ${line.item?.name ?? 'dish'}`} className="cart-remove" icon={<Trash2 size={15} />} onClick={() => remove(line.key)} />
        </motion.li>)}
      </AnimatePresence>
    </motion.ul>}
    <Breakdown amount={amount} deliveryType={type} taxBps={taxBps} empty={!count} />
    <Button className="checkout-button" label="Checkout" size="lg" isDisabled={count === 0 || !canOrder || invalid} onClick={checkout}>Checkout <ArrowRight size={18} /></Button>
    {invalid && <p className="cart-help danger">Remove unavailable items to continue.</p>}
    {!canOrder && <p className="cart-help">The kitchen is currently closed.</p>}
  </>;
}

function Customise({ item, close, add }: { item: MenuItem; close: () => void; add: (picks: string[]) => void }) {
  const [picks, setPicks] = useState<string[]>([]);
  return <Popup title={item.name} close={close}>
    <Photo src={item.imageUrl} className="customise-photo" />
    <p className="muted">{item.description}</p>
    <fieldset className="options-list"><legend>Make it yours</legend>
      {item.options.map(option => <label key={option.label} className="check-row">
        <input type="checkbox" checked={picks.includes(option.label)} onChange={event => setPicks(current => event.target.checked ? [...current, option.label] : current.filter(label => label !== option.label))} />
        <strong>{option.label}</strong><small>{option.price ? `+${currency(option.price)}` : 'Free'}</small>
      </label>)}
    </fieldset>
    <Button className="solid-button" label={`Add to cart · ${currency(itemPrice(item, picks))}`} size="lg" onClick={() => add(picks)} />
  </Popup>;
}

function Checkout({ lines, type, setType, close, menu, completed }: {
  lines: CartLine[]; type: OrderType; setType: (type: OrderType) => void; close: () => void; menu: Menu; completed: (id: string, paidOnline: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const draft = useRef<{ payload: string; id: string } | null>(null);
  const subtotal = lines.reduce((sum, line) => {
    const item = menu.items.find(candidate => candidate.id === line.menuItemId);
    return sum + (item ? itemPrice(item, line.picks) * line.quantity : 0);
  }, 0);
  const amount = totals(subtotal, type, menu.restaurant.taxBps, menu.restaurant.deliveryFee);
  const paymentChoices = menu.razorpayEnabled ? ['CASH', 'RAZORPAY_TEST'] as const : payments.filter(payment => payment !== 'RAZORPAY_TEST');
  const [payment, setPayment] = useState<typeof payments[number]>('CASH');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const data = {
      customerName: form.get('customerName'), mobile: form.get('mobile'), type,
      tableNumber: form.get('tableNumber') ?? undefined, address: form.get('address') ?? undefined,
      instructions: form.get('instructions'), payment: form.get('payment'), items: lines,
    };
    const payload = JSON.stringify(data);
    if (draft.current?.payload !== payload) draft.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      const { id } = await jsonRequest<{ id: string }>('/api/orders', 'POST', { ...data, requestId: draft.current.id });
      completed(id, form.get('payment') === 'RAZORPAY_TEST');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to place your order.');
      setBusy(false);
    }
  }

  return <Popup title="Checkout" close={close} busy={busy}>
    <form className="form-stack" onSubmit={submit}>
      <ModePicker type={type} select={mode => { if (!busy) setType(mode); }} />
      <label>Full name<input name="customerName" maxLength={100} autoComplete="name" required placeholder="Your name" /></label>
      <label>Mobile number<input name="mobile" type="tel" autoComplete="tel" maxLength={20} required placeholder="10-digit Indian mobile number" /></label>
      {type === 'DINE_IN' && <label>Table number<input name="tableNumber" required maxLength={20} placeholder="e.g. 12" /></label>}
      {type === 'DELIVERY' && <label>Delivery address<textarea name="address" required minLength={8} maxLength={350} autoComplete="street-address" placeholder="House or flat number, street and area" /></label>}
      <label>Cooking instructions <small>(optional)</small><textarea name="instructions" maxLength={350} placeholder="Allergies, spice level or other requests" /></label>
      <label>Payment method<select name="payment" value={payment} onChange={event => setPayment(event.target.value as typeof payment)}>{paymentChoices.map(payment => <option key={payment} value={payment}>{paymentLabels[payment]}</option>)}</select></label>
      <p className="muted">Demo checkout. No payment is collected.</p>
      <Breakdown amount={amount} deliveryType={type} taxBps={menu.restaurant.taxBps} />
      <ErrorNotice>{error}</ErrorNotice>
      <Button className="checkout-button" type="submit" size="lg" label={`${payment === 'RAZORPAY_TEST' ? 'Continue to test payment' : 'Place order'} · ${currency(amount.total)}`} isLoading={busy} isDisabled={!menu.acceptingOrders} />
    </form>
  </Popup>;
}

export function Storefront({ initialMenu }: { initialMenu: Menu | null }) {
  const [menu, setMenu] = useState(initialMenu);
  const [unavailable, setUnavailable] = useState(!initialMenu);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [type, setType] = useState<OrderType>('DELIVERY');
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customise, setCustomise] = useState<MenuItem>();
  const [toast, setToast] = useState<{ text: string; id: number }>();
  const [active, setActive] = useState('home');
  const [searchOpen, setSearchOpen] = useState(false);
  const categoryRow = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function refresh() {
    try { setMenu(await request<Menu>('/api/menu')); setUnavailable(false); }
    catch { setUnavailable(true); }
  }

  useEffect(() => {
    setCart(readLocal<CartLine[]>(cartKey, []));
    const saved = readLocal<OrderType>(typeKey, 'DELIVERY');
    if (modes.includes(saved)) setType(saved);
    setHydrated(true);
    const interval = window.setInterval(refresh, 30_000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, []);
  useEffect(() => { if (hydrated) { writeLocal(cartKey, cart); writeLocal(typeKey, type); } }, [cart, type, hydrated]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 2400);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const restaurant = menu?.restaurant;
  const items = menu?.items ?? [];
  const lines = cart.map<Line>(line => {
    const item = items.find(menuItem => menuItem.id === line.menuItemId);
    return {
      ...line, key: lineKey(line), item, price: item ? itemPrice(item, line.picks) : 0,
      invalid: !item?.inStock || line.picks.some(pick => !item.options.some(option => option.label === pick)),
    };
  });
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const amount = totals(lines.reduce((sum, line) => sum + line.price * line.quantity, 0), type, restaurant?.taxBps ?? 0, restaurant?.deliveryFee ?? 0);

  function change(line: CartLine, delta: number) {
    setCart(previous => {
      if (delta > 0 && previous.reduce((sum, entry) => sum + entry.quantity, 0) >= 100) return previous;
      const key = lineKey(line);
      const match = previous.find(entry => lineKey(entry) === key);
      if (!match) return delta > 0 && previous.length < 50 ? [...previous, line] : previous;
      return previous.map(entry => lineKey(entry) === key ? { ...entry, quantity: Math.min(50, entry.quantity + delta) } : entry)
        .filter(entry => entry.quantity > 0);
    });
  }

  function addDish(item: MenuItem, picks: string[] = []) {
    if (!item.inStock) return;
    const line = { menuItemId: item.id, picks: [...picks].sort(), quantity: 1 };
    const existing = cart.find(entry => lineKey(entry) === lineKey(line));
    if (count >= 100 || (existing?.quantity ?? 0) >= 50 || (!existing && cart.length >= 50)) {
      setToast({ text: 'This cart has reached its item limit.', id: Date.now() });
      return;
    }
    change(line, 1);
    setToast({ text: `${item.name} added`, id: Date.now() });
    setCustomise(undefined);
  }

  function section(id: string) {
    setActive(id === 'home' ? 'home' : 'menu');
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    if (id === 'home') window.scrollTo({ top: 0, behavior });
    else document.getElementById(id)?.scrollIntoView({ behavior });
  }

  function openCheckout() {
    setCartOpen(false);
    setCheckoutOpen(true);
  }

  const searching = query.trim().toLowerCase();
  const filtered = items.filter(item => (categoryId === 'all' || item.categoryId === categoryId) &&
    (!vegOnly || item.vegetarian) && (!searching || `${item.name} ${item.description} ${menu?.categories.find(category => category.id === item.categoryId)?.name}`.toLowerCase().includes(searching)));
  const focusedMenu = categoryId !== 'all' || Boolean(searching) || vegOnly;
  const popular = items.filter(item => item.popular);
  const recommended = items.filter(item => item.recommended);
  const renderDishes = (dishes: MenuItem[]) => <VStack className="food-grid">
    {dishes.map(item => <FoodCard key={item.id} item={item}
      quantity={cart.filter(line => line.menuItemId === item.id).reduce((sum, line) => sum + line.quantity, 0)}
      add={() => item.options.length ? setCustomise(item) : addDish(item)}
      change={delta => change({ menuItemId: item.id, picks: [], quantity: 1 }, delta)} />)}
  </VStack>;
  const cartContents = <CartContents lines={lines} count={count} type={type} setType={setType} change={change}
    remove={key => setCart(previous => previous.filter(line => lineKey(line) !== key))}
    amount={amount} taxBps={restaurant?.taxBps ?? 0} canOrder={Boolean(menu?.acceptingOrders)} checkout={openCheckout} />;

  return <MotionConfig reducedMotion="user">
    <header className="site-header" id="home">
      <HStack className="header-inner frame" vAlign="center" hAlign="between">
        <HStack vAlign="center" className="header-brand">
          <Brand restaurant={restaurant} />
          {restaurant && <p className="location"><MapPin size={16} />{restaurant.location}</p>}
        </HStack>
        <nav className="desktop-nav" aria-label="Main navigation">
          <button className={active === 'home' ? 'current' : ''} onClick={() => section('home')}>Home</button>
          <button className={active === 'menu' ? 'current' : ''} onClick={() => section('menu')}>Menu</button>
          <Link href="/track">Track order</Link>
        </nav>
        <HStack className="header-actions" gap={1} vAlign="center">
          <form className={`search-box ${searchOpen ? 'search-open' : ''}`} role="search" onSubmit={event => { event.preventDefault(); setSearchOpen(false); section('menu'); }}>
            <Search size={17} /><input ref={searchRef} type="search" aria-label="Search dishes" placeholder="Search dishes..." value={query}
              onChange={event => { setQuery(event.target.value); if (event.target.value.trim()) setActive('menu'); }} />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
          </form>
          <Button label="Search menu" isIconOnly className="mobile-search" variant="ghost" icon={<Search size={22} />} onClick={() => setSearchOpen(value => !value)} />
          <Button label={`Open cart, ${count} items`} isIconOnly className="header-bag" variant="ghost" icon={<ShoppingBag size={20} />} onClick={() => setCartOpen(true)} />
        </HStack>
      </HStack>
    </header>
    <main className="frame shop-layout" aria-label="Restaurant menu">
      <VStack className="shop-content">
        <section className="hero" aria-labelledby="hero-title">
          <img className="hero-photo" src="/food/hero.webp" alt="" fetchPriority="high" />
          <VStack className="hero-content">
            <p className="eyebrow hero-eyebrow"><i /> FROM THE INDIAN KITCHEN</p>
            <Heading level={1} id="hero-title" className="hero-title">From our tandoor<br /><em>to your table.</em></Heading>
            <p className="hero-copy">{restaurant?.description ?? 'Tandoor favourites, slow-cooked curries and more from our Indian kitchen.'}</p>
            <Button className="solid-button hero-action" label="Explore menu" size="lg" onClick={() => section('menu')}>Explore menu <ArrowRight size={17} /></Button>
          </VStack>
          <p className="hero-caption"><Flame size={14} /> Butter Chicken</p>
        </section>
        <HStack className="store-meta" vAlign="center" gap={2}>
          <p className={`open-state ${menu?.acceptingOrders ? 'is-open' : ''}`}><i />{menu ? (menu.acceptingOrders ? 'Open now' : 'Kitchen closed') : 'Hours unavailable'}</p>
          {restaurant && <p className="hours"><Clock3 size={15} />{restaurant.opensAt === restaurant.closesAt ? 'Open daily' : `${restaurant.opensAt} – ${restaurant.closesAt}`}</p>}
          {restaurant && <p className="store-location"><MapPin size={15} />{restaurant.location}</p>}
        </HStack>
        {unavailable && <HStack className="menu-error" gap={2} vAlign="center">
          <ErrorNotice>{menu ? 'Couldn’t refresh the menu. Showing the last loaded menu.' : 'The menu is temporarily unavailable.'}</ErrorNotice>
          <Button label="Retry" size="sm" onClick={() => void refresh()} />
        </HStack>}
        {menu && <>
          <section className="category-section" aria-labelledby="category-title">
            <HStack className="section-head" hAlign="between" vAlign="center">
              <Heading level={2} id="category-title">Browse Categories</Heading>
              <HStack className="scroll-arrows" gap={1}>
                <Button label="Previous categories" isIconOnly size="sm" variant="ghost" icon={<ChevronLeft size={18} />} onClick={() => categoryRow.current?.scrollBy({ left: -320, behavior: 'smooth' })} />
                <Button label="Next categories" isIconOnly size="sm" variant="ghost" icon={<ChevronRight size={18} />} onClick={() => categoryRow.current?.scrollBy({ left: 320, behavior: 'smooth' })} />
              </HStack>
            </HStack>
            <HStack className="category-row" ref={categoryRow} role="group" aria-label="Menu categories">
              {[{ id: 'all', name: 'All Items', imageUrl: null }, ...menu.categories].map(category => <button key={category.id}
                className={`category ${categoryId === category.id ? 'category-active' : ''}`} aria-pressed={categoryId === category.id}
                onClick={() => { setCategoryId(category.id); setQuery(''); if (category.id !== 'all') setActive('menu'); }}>
                {category.imageUrl ? <Photo src={category.imageUrl} /> : <HStack className="category-symbol" hAlign="center" vAlign="center"><UtensilsCrossed size={24} strokeWidth={1.6} /></HStack>}
                <strong>{category.name}</strong>
              </button>)}
            </HStack>
          </section>
          {!focusedMenu && popular.length > 0 && <section className="menu-section" aria-labelledby="popular-title">
            <HStack className="section-head" hAlign="between" vAlign="center" gap={1}>
              <VStack><Heading level={2} id="popular-title"><Flame size={23} className="section-flame" /> Popular Dishes</Heading><p>Our most-loved plates</p></VStack>
              <button className="text-action" onClick={() => section('menu')}>View full menu <ArrowRight size={16} /></button>
            </HStack>
            {renderDishes(popular)}
          </section>}
          {!focusedMenu && recommended.length > 0 && <section className="menu-section" aria-labelledby="recommended-title">
            <HStack className="section-head" vAlign="center"><VStack><Heading level={2} id="recommended-title">Recommended for You</Heading><p>More favourites from our kitchen</p></VStack></HStack>
            {renderDishes(recommended)}
          </section>}
          <section className="menu-section" id="menu" aria-labelledby="full-menu-title">
            <HStack className="section-head" hAlign="between" vAlign="center" gap={2}>
              <VStack><Heading level={2} id="full-menu-title">{searching ? 'Search results' : (menu.categories.find(category => category.id === categoryId)?.name ?? 'Full Menu')}</Heading><p>{filtered.length} {filtered.length === 1 ? 'dish' : 'dishes'}</p></VStack>
              <button className={`filter-button ${vegOnly ? 'selected' : ''}`} aria-pressed={vegOnly} onClick={() => setVegOnly(value => !value)}><Leaf size={16} /> Veg only</button>
            </HStack>
            {filtered.length ? renderDishes(filtered) : <VStack className="empty-state" align="center" gap={2}><Search size={25} /><p>No dishes match your filters.</p><Button label="Clear filters" onClick={() => { setQuery(''); setCategoryId('all'); setVegOnly(false); }} /></VStack>}
          </section>
        </>}
        <footer className="store-footer"><PoweredBy /><Link href="/admin">Staff access <ArrowUpRight size={14} /></Link></footer>
      </VStack>
      <aside className="cart-column" aria-label="Your cart">
        <VStack className="cart-panel">
          <HStack vAlign="center" hAlign="between" className="cart-title">
            <Heading level={2}><ShoppingBag size={22} /> Your Cart</Heading>
            <small>{count} {count === 1 ? 'item' : 'items'}</small>
          </HStack>
          {cartContents}
        </VStack>
      </aside>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <button className={active === 'home' ? 'current' : ''} onClick={() => section('home')}><House size={20} />Home</button>
      <button className={active === 'menu' ? 'current' : ''} onClick={() => section('menu')}><UtensilsCrossed size={20} />Menu</button>
      <Link href="/track"><ReceiptText size={20} />Orders</Link>
      <button onClick={() => setCartOpen(true)}><ShoppingBag size={20} />Cart{count > 0 ? ` (${count})` : ''}</button>
    </nav>
    <AnimatePresence>
      {count > 0 && <motion.button className="sticky-cart" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 18, opacity: 0 }} onClick={() => setCartOpen(true)}>
        <strong><ShoppingBag size={19} /> {count} {count === 1 ? 'item' : 'items'} · {currency(amount.total)}</strong><b>View cart <ArrowRight size={17} /></b>
      </motion.button>}
    </AnimatePresence>
    <AnimatePresence>
      {toast && <motion.output key={toast.id} className="cart-toast" role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
        <ShoppingBag size={17} />{toast.text}
      </motion.output>}
    </AnimatePresence>
    {cartOpen && <Popup title="Your Cart" close={() => setCartOpen(false)} end>{cartContents}</Popup>}
    {customise && <Customise item={customise} close={() => setCustomise(undefined)} add={picks => addDish(customise, picks)} />}
    {checkoutOpen && menu && <Checkout lines={cart} type={type} setType={setType} close={() => setCheckoutOpen(false)} menu={menu} completed={(id, online) => {
      setCart([]); writeLocal(cartKey, []); writeLocal('phirmy-last-order', id); setCheckoutOpen(false); router.push(`/track/${id}${online ? '' : '?placed=1'}`);
    }} />}
  </MotionConfig>;
}
