'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { jsonRequest, request } from '@/lib/client';
import { currency, type Category, type Menu, type MenuItem, type Option, type Restaurant } from '@/lib/domain';
import { ErrorNotice, Photo, Popup } from './shared';

export type CatalogResource = 'items' | 'categories' | 'restaurant';
const catalogPath = (resource: CatalogResource, id?: string) => `/api/admin/catalog/${resource}${id ? `?id=${encodeURIComponent(id)}` : ''}`;

function ImageField({ label, initial, required, onUpload }: { label: string; initial?: string | null; required?: boolean; onUpload: (busy: boolean) => void }) {
  const [value, setValue] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) { setError('Images must be smaller than 5 MB.'); return; }
    setBusy(true);
    onUpload(true);
    setError('');
    try {
      const result = await request<{ url: string }>('/api/admin/images', { method: 'POST', body: file });
      setValue(result.url);
    } catch (cause) { setError((cause as Error).message); }
    finally { onUpload(false); setBusy(false); }
  }
  return <VStack gap={1}>
    <label>{label}<input name="imageUrl" value={value} onChange={event => setValue(event.target.value)} placeholder="Paste an HTTPS URL or upload an image" maxLength={1500} required={required} /></label>
    <HStack gap={1} vAlign="center" className="upload-actions">
      {value && <Photo className="admin-thumb" src={value} />}
      <label className="file-button"><ImagePlus size={17} />{busy ? 'Uploading…' : 'Upload image'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label={`Upload ${label.toLowerCase()}`} disabled={busy} onChange={event => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }} />
      </label>
    </HStack>
    <ErrorNotice>{error}</ErrorNotice>
  </VStack>;
}

function Editor({ resource, menu, record, close, saved }: {
  resource: CatalogResource; menu: Menu; record?: MenuItem | Category; close: () => void; saved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const dish = resource === 'items' ? record as MenuItem | undefined : undefined;
  const category = resource === 'categories' ? record as Category | undefined : undefined;
  const restaurant = menu.restaurant;
  const [options, setOptions] = useState<Option[]>(dish?.options ?? []);

  function optionAt(index: number, option: Option) {
    setOptions(current => current.map((old, i) => i === index ? option : old));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uploading) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    const checked = (name: string) => form.has(name);
    const money = (name: string) => Math.round(Number(text(name)) * 100);
    const common = { name: text('name'), imageUrl: text('imageUrl') || null, position: Number(text('position')) };
    let data: unknown = common;
    if (resource === 'items') data = {
      ...common, categoryId: text('categoryId'), description: text('description'), price: money('price'),
      vegetarian: checked('vegetarian'), inStock: checked('inStock'), popular: checked('popular'), recommended: checked('recommended'), options,
    };
    if (resource === 'restaurant') data = {
      name: common.name, logoUrl: common.imageUrl, tagline: text('tagline'), description: text('description'), location: text('location'),
      opensAt: text('opensAt'), closesAt: text('closesAt'), timeZone: text('timeZone'), isOpen: checked('isOpen'),
      taxBps: money('tax'), deliveryFee: money('deliveryFee'),
    };
    setBusy(true);
    setError('');
    try {
      await jsonRequest(catalogPath(resource, record?.id), resource === 'restaurant' || record ? 'PATCH' : 'POST', data);
      saved();
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  }

  const title = resource === 'restaurant' ? 'Restaurant settings' : `${record ? 'Edit' : 'Add'} ${resource === 'items' ? 'dish' : 'category'}`;
  return <Popup title={title} close={close} busy={busy || uploading}>
    <form className="form-stack" onSubmit={submit}>
      <label>{resource === 'restaurant' ? 'Restaurant name' : 'Name'}<input name="name" defaultValue={record?.name ?? (resource === 'restaurant' ? restaurant.name : '')} maxLength={resource === 'restaurant' ? 55 : resource === 'categories' ? 45 : 100} required /></label>
      {resource === 'restaurant' && <>
        <label>Brand tagline<input name="tagline" defaultValue={restaurant.tagline} maxLength={40} required /></label>
        <label>Location<input name="location" defaultValue={restaurant.location} maxLength={100} required /></label>
      </>}
      {resource !== 'categories' && <label>{resource === 'restaurant' ? 'Storefront description' : 'Description'}<textarea name="description" defaultValue={resource === 'restaurant' ? restaurant.description : dish?.description} maxLength={600} required /></label>}
      {resource === 'items' && <HStack className="form-pair" gap={2}>
        <label>Category<select name="categoryId" aria-label="Category" required defaultValue={dish?.categoryId ?? ''}>
          <option value="" disabled>Choose a category</option>{menu.categories.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select></label>
        <label>Price (₹)<input name="price" type="number" min="1" max="100000" step="0.01" defaultValue={dish ? dish.price / 100 : undefined} required /></label>
      </HStack>}
      {resource !== 'restaurant' && <label>Display position<input name="position" type="number" min="0" max="9999" defaultValue={record?.position ?? (resource === 'items' ? menu.items.length : menu.categories.length)} required /></label>}
      <ImageField label={resource === 'restaurant' ? 'Logo image' : 'Image'} initial={resource === 'restaurant' ? restaurant.logoUrl : record?.imageUrl} required={resource === 'items'} onUpload={setUploading} />
      {resource === 'items' && <>
        <HStack className="catalog-checks">
          <label className="check-row"><input type="checkbox" name="vegetarian" defaultChecked={dish?.vegetarian} /> Vegetarian</label>
          <label className="check-row"><input type="checkbox" name="inStock" defaultChecked={dish?.inStock ?? true} /> In stock</label>
          <label className="check-row"><input type="checkbox" name="popular" defaultChecked={dish?.popular} /> Popular</label>
          <label className="check-row"><input type="checkbox" name="recommended" defaultChecked={dish?.recommended} /> Recommended</label>
        </HStack>
        <fieldset className="options-list"><legend>Customisation options</legend>
          {options.map((option, index) => <HStack className="option-editor" gap={1} key={index} vAlign="end">
            <label>Option name<input value={option.label} maxLength={45} required onChange={event => optionAt(index, { ...option, label: event.target.value })} /></label>
            <label>Price (₹)<input value={option.price / 100} type="number" min="0" max="100000" step="0.01" required onChange={event => optionAt(index, { ...option, price: Math.round(Number(event.target.value) * 100) })} /></label>
            <Button label={`Remove option ${index + 1}`} isIconOnly icon={<Trash2 size={16} />} variant="ghost" onClick={() => setOptions(current => current.filter((_, i) => i !== index))} />
          </HStack>)}
          <Button label="Add option" icon={<Plus size={16} />} isDisabled={options.length >= 15} onClick={() => setOptions(current => [...current, { label: '', price: 0 }])} />
        </fieldset>
      </>}
      {resource === 'restaurant' && <>
        <label className="check-row"><input type="checkbox" name="isOpen" defaultChecked={restaurant.isOpen} /> Kitchen enabled</label>
        <HStack className="form-pair" gap={2}>
          <label>Opens at<input name="opensAt" type="time" defaultValue={restaurant.opensAt} required /></label>
          <label>Closes at<input name="closesAt" type="time" defaultValue={restaurant.closesAt} required /></label>
        </HStack>
        <p className="muted">Set matching opening and closing times for all-day ordering.</p>
        <label>Time zone<input name="timeZone" defaultValue={restaurant.timeZone} required /></label>
        <HStack className="form-pair" gap={2}>
          <label>Tax (%)<input name="tax" type="number" min="0" max="50" step="0.01" defaultValue={restaurant.taxBps / 100} required /></label>
          <label>Delivery fee (₹)<input name="deliveryFee" type="number" min="0" max="100000" step="0.01" defaultValue={restaurant.deliveryFee / 100} required /></label>
        </HStack>
      </>}
      <ErrorNotice>{error}</ErrorNotice>
      <Button className="solid-button" type="submit" label={`Save ${resource === 'items' ? 'dish' : resource === 'categories' ? 'category' : 'settings'}`} size="lg" isLoading={busy} isDisabled={uploading} />
    </form>
  </Popup>;
}

export function Catalog({ resource, menu, refresh }: { resource: CatalogResource; menu: Menu; refresh: () => Promise<void> }) {
  const [editor, setEditor] = useState<{ record?: MenuItem | Category }>();
  const [deleting, setDeleting] = useState<MenuItem | Category>();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const records: (MenuItem | Category)[] = resource === 'items' ? menu.items : menu.categories;

  async function mutate(url: string, method: string, data?: unknown, id = 'record') {
    setBusy(id);
    setError('');
    setNotice('');
    try {
      await jsonRequest(url, method, data);
      setDeleting(undefined);
      await refresh();
      setNotice(method === 'DELETE' ? 'Deleted.' : 'Changes saved.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(''); }
  }

  return <>
    <ErrorNotice>{!deleting && error}</ErrorNotice>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {resource === 'restaurant' ? <VStack className="admin-panel" gap={3}>
      <HStack hAlign="between" vAlign="center" gap={2} className="catalog-controls">
        <VStack gap={1}><Heading level={2}>{menu.restaurant.name}</Heading><p className="muted">{menu.restaurant.location}</p></VStack>
        <Button label="Edit settings" icon={<Pencil size={16} />} onClick={() => setEditor({})} />
      </HStack>
      <dl className="settings-list">
        <HStack hAlign="between"><dt>Kitchen enabled</dt><dd>{menu.restaurant.isOpen ? 'Yes' : 'No'}</dd></HStack>
        <HStack hAlign="between"><dt>Accepting orders now</dt><dd>{menu.acceptingOrders ? 'Yes' : 'No'}</dd></HStack>
        <HStack hAlign="between"><dt>Opening hours</dt><dd>{menu.restaurant.opensAt === menu.restaurant.closesAt ? 'All day' : `${menu.restaurant.opensAt} – ${menu.restaurant.closesAt}`}</dd></HStack>
        <HStack hAlign="between"><dt>Tax</dt><dd>{menu.restaurant.taxBps / 100}%</dd></HStack>
        <HStack hAlign="between"><dt>Delivery fee</dt><dd>{currency(menu.restaurant.deliveryFee)}</dd></HStack>
      </dl>
    </VStack> : <VStack className="admin-panel" gap={3}>
      <HStack hAlign="between" vAlign="center" gap={2} className="catalog-controls">
        <input className="field-input" type="search" placeholder={`Search ${resource === 'items' ? 'dishes' : 'categories'}…`} aria-label="Search catalog" value={query} onChange={event => setQuery(event.target.value)} />
        <Button className="solid-button" label={resource === 'items' ? 'Add dish' : 'Add category'} icon={<Plus size={17} />} onClick={() => setEditor({})} isDisabled={resource === 'items' && !menu.categories.length} />
      </HStack>
      {resource === 'items' && !menu.categories.length && <p className="muted">Create a category to add dishes.</p>}
      <ul className="catalog-list">
        {records.filter(record => record.name.toLowerCase().includes(query.trim().toLowerCase())).map(record => {
          const dish = 'price' in record ? record : null;
          return <li key={record.id}>
            <Photo src={record.imageUrl ?? ''} className="admin-thumb" />
            <VStack className="catalog-name"><strong>{record.name}</strong>
              {dish && <small>{menu.categories.find(category => category.id === dish.categoryId)?.name} · {currency(dish.price)}</small>}
              {!dish && <small>{menu.items.filter(item => item.categoryId === record.id).length} dishes</small>}
            </VStack>
            <HStack gap={1} vAlign="center" className="catalog-row-actions">
              {dish && <Button label={dish.inStock ? 'In stock' : 'Sold out'} aria-label={`${dish.name} is ${dish.inStock ? 'in stock' : 'sold out'}. Change availability`}
                className={dish.inStock ? 'stock-toggle' : 'stock-toggle danger'} size="sm" isLoading={busy === record.id}
                onClick={() => void mutate(catalogPath('items', record.id), 'PATCH', { inStock: !dish.inStock }, record.id)} />}
              <Button label={`Edit ${record.name}`} isIconOnly icon={<Pencil size={16} />} variant="ghost" onClick={() => setEditor({ record })} />
              <Button label={`Delete ${record.name}`} isIconOnly icon={<Trash2 size={16} />} variant="ghost" onClick={() => { setError(''); setDeleting(record); }} />
            </HStack>
          </li>;
        })}
      </ul>
      {!records.some(record => record.name.toLowerCase().includes(query.trim().toLowerCase())) && <p className="empty-state">No {resource === 'items' ? 'dishes' : 'categories'} found.</p>}
    </VStack>}
    {editor && <Editor resource={resource} menu={menu} record={editor.record} close={() => setEditor(undefined)} saved={() => {
      setEditor(undefined); setNotice('Changes saved.'); void refresh();
    }} />}
    {deleting && <Popup title={`Delete ${deleting.name}?`} busy={Boolean(busy)} close={() => setDeleting(undefined)}>
      <p className="muted">This removes it from the customer menu.</p>
      <ErrorNotice>{error}</ErrorNotice>
      <HStack gap={1} hAlign="end">
        <Button label="Cancel" onClick={() => setDeleting(undefined)} isDisabled={Boolean(busy)} />
        <Button label="Delete" variant="destructive" isLoading={Boolean(busy)} onClick={() => void mutate(catalogPath(resource, deleting.id), 'DELETE')} />
      </HStack>
    </Popup>}
  </>;
}
