import { z } from 'zod';
import { orderTypes, payments } from './domain';

export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/, 'Invalid record ID.');
const name = (label: string, max = 100) => z.string().trim().min(1, `Enter ${label}.`).max(max);
const paise = z.number().int().min(0).max(10_000_000);
const description = name('a description', 600);
const position = z.number().int().min(0).max(9999);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid time.');
const imageUrl = z.string().trim().max(1500).refine(value => {
  if (/^\/(food\/[a-z0-9-]+\.webp|api\/media\/[a-f0-9-]{36})$/.test(value)) return true;
  return URL.canParse(value) && new URL(value).protocol === 'https:';
}, 'Use an HTTPS image link or upload an image.');

/* Keep uploaded URLs and bundled assets distinct from arbitrary same-origin endpoints. */
export const categoryInput = z.object({ name: name('a category name', 45), imageUrl: imageUrl.nullable(), position }).strict();
export const menuItemInput = z.object({
  categoryId: id, name: name('a dish name'), description, imageUrl, price: paise.min(100),
  vegetarian: z.boolean(), inStock: z.boolean(), popular: z.boolean(), recommended: z.boolean(),
  position, options: z.array(z.object({ label: name('an option label', 45), price: paise }).strict()).max(15)
    .refine(options => new Set(options.map(option => option.label.toLowerCase())).size === options.length, 'Use a different label for each option.'),
}).strict();

export const restaurantInput = z.object({
  name: name('a restaurant name', 55), tagline: name('a brand tagline', 40),
  logoUrl: imageUrl.nullable(), location: name('a restaurant location', 100), description,
  isOpen: z.boolean(), opensAt: time, closesAt: time, taxBps: z.number().int().min(0).max(5000), deliveryFee: paise,
  timeZone: name('an IANA time zone').refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }, 'Enter a valid IANA time zone.'),
}).strict();

export const orderInput = z.object({
  requestId: z.uuid(),
  customerName: name('your name'),
  mobile: z.string().trim().transform(value => value.replace(/[\s()-]/g, '')).pipe(z.string().regex(/^(?:\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'))
    .transform(value => value.startsWith('+91') ? value : `+91${value}`),
  type: z.enum(orderTypes),
  tableNumber: z.string().trim().max(20).optional(),
  address: z.string().trim().max(350).optional(),
  instructions: z.string().trim().max(350).optional(),
  payment: z.enum(payments),
  items: z.array(z.object({
    menuItemId: id, quantity: z.number().int().min(1).max(50),
    picks: z.array(z.string().trim().min(1).max(45)).max(15)
      .refine(picks => new Set(picks).size === picks.length, 'Each customization can be selected once.'),
  }).strict()).min(1, 'Add at least one dish.').max(50),
}).strict().superRefine((data, ctx) => {
  if (data.type === 'DINE_IN' && !data.tableNumber) ctx.addIssue({ code: 'custom', path: ['tableNumber'], message: 'Enter your table number.' });
  if (data.type === 'DELIVERY' && (data.address?.length ?? 0) < 8) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Enter a complete delivery address.' });
  if (data.items.reduce((count, line) => count + line.quantity, 0) > 100) ctx.addIssue({ code: 'custom', path: ['items'], message: 'An order can contain up to 100 dishes.' });
});
