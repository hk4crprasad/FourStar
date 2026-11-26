import { z } from 'zod';
import { requireStaff } from '@/lib/auth';
import { db, restaurantId } from '@/lib/db';
import { ApiError, jsonBody, respond, verifyOrigin } from '@/lib/http';
import { getMenu } from '@/lib/menu';
import { categoryInput, id, menuItemInput, restaurantInput } from '@/lib/validation';

type Context = { params: Promise<{ resource: string }> };

export function GET(_request: Request, { params }: Context) {
  return respond(async () => {
    await requireStaff();
    const { resource } = await params;
    if (!['items', 'categories', 'restaurant'].includes(resource)) throw new ApiError(404, 'Unknown catalog resource.');
    return getMenu();
  });
}

async function save(request: Request, { params }: Context, updating: boolean) {
  verifyOrigin(request);
  await requireStaff();
  const { resource } = await params;
  const data = await jsonBody(request);
  const recordId = updating && resource !== 'restaurant' ? id.parse(new URL(request.url).searchParams.get('id')) : '';
  if (resource === 'restaurant' && updating) {
    const status = z.object({ isOpen: z.boolean() }).strict().safeParse(data);
    return db.restaurant.update({ where: { id: restaurantId }, data: status.success ? status.data : restaurantInput.parse(data) });
  }
  if (resource === 'categories') {
    const category = categoryInput.parse(data);
    return updating
      ? db.category.update({ where: { id: recordId, restaurantId }, data: category })
      : db.category.create({ data: { ...category, restaurantId } });
  }
  if (resource === 'items') {
    const availability = z.object({ inStock: z.boolean() }).strict().safeParse(data);
    if (updating && availability.success) {
      return db.menuItem.update({ where: { id: recordId, restaurantId }, data: availability.data });
    }
    const item = menuItemInput.parse(data);
    const category = await db.category.findFirst({ where: { id: item.categoryId, restaurantId } });
    if (!category) throw new ApiError(400, 'Choose a valid menu category.');
    return updating
      ? db.menuItem.update({ where: { id: recordId, restaurantId }, data: item })
      : db.menuItem.create({ data: { ...item, restaurantId } });
  }
  throw new ApiError(404, 'Unknown catalog resource.');
}

export function POST(request: Request, context: Context) { return respond(() => save(request, context, false)); }
export function PATCH(request: Request, context: Context) { return respond(() => save(request, context, true)); }

export function DELETE(request: Request, { params }: Context) {
  return respond(async () => {
    verifyOrigin(request);
    await requireStaff();
    const { resource } = await params;
    const recordId = id.parse(new URL(request.url).searchParams.get('id'));
    if (resource === 'items') await db.menuItem.delete({ where: { id: recordId, restaurantId } });
    else if (resource === 'categories') {
      if (await db.menuItem.count({ where: { categoryId: recordId, restaurantId } })) {
        throw new ApiError(409, 'Move dishes out of this category before deleting it.');
      }
      await db.category.delete({ where: { id: recordId, restaurantId } });
    } else throw new ApiError(404, 'Unknown catalog resource.');
    return { ok: true };
  });
}
