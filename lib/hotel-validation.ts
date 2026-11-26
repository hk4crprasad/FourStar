import { z } from 'zod';
import { addDays, housekeepingStates, isReservationId, nightsBetween, roomConditions, stayPayments, type Stay } from './hospitality';
import { ApiError } from './http';
import { id, imageUrl, indianMobile, name } from './validation';

export const stayInput = z.object({
  checkIn: z.iso.date(), checkOut: z.iso.date(), guests: z.number().int().min(1).max(8),
}).strict();

export function stayNights(stay: Stay, today: string) {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  if (stay.checkIn < today || stay.checkIn > addDays(today, 365)) {
    throw new ApiError(400, 'Choose a check-in date within the next year.');
  }
  if (!Number.isInteger(nights) || nights < 1 || nights > 30) {
    throw new ApiError(400, 'Choose a checkout date 1 to 30 nights after check-in.');
  }
  return nights;
}

export const reservationInput = z.object({
  requestId: z.uuid(), roomTypeId: id, stay: stayInput, guestName: name('your name'),
  email: z.email().max(254), mobile: indianMobile, payment: z.enum(stayPayments),
}).strict();

export const guestLoginInput = z.object({
  reservationId: z.string().trim().toUpperCase().refine(isReservationId),
  mobile: indianMobile, roomToken: z.uuid().optional(),
}).strict();

export const roomInput = z.object({
  number: name('a room number', 20), floor: name('a floor', 25), roomTypeId: id,
  condition: z.enum(roomConditions), housekeeping: z.enum(housekeepingStates),
}).strict();

export const roomTypeInput = z.object({
  name: name('a room type name', 60), description: name('a description', 600), beds: name('the bed layout', 80),
  sizeM2: z.number().int().min(1).max(1000), capacity: z.number().int().min(1).max(8),
  nightlyRate: z.number().int().min(100).max(10_000_000), isListed: z.boolean(),
  position: z.number().int().min(0).max(9999),
  images: z.array(imageUrl).min(1, 'Add at least one room photograph.').max(8),
  amenities: z.array(id).max(30).refine(list => new Set(list).size === list.length, 'Select each amenity once.'),
}).strict();

export const hotelInput = z.object({
  name: name('a hotel name', 55), tagline: name('a brand tagline', 40),
  location: name('the hotel location', 100), description: name('a description', 600),
  heroUrl: imageUrl, logoUrl: imageUrl.nullable(), email: z.email().max(254), phone: indianMobile,
}).strict();
