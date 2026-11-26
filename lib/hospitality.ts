import type { Restaurant } from './domain';

export const hotelId = 'fourstar';
export const reservationStates = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] as const;
export type ReservationStatus = typeof reservationStates[number];
export const reservationLabels: Record<ReservationStatus, string> = {
  PENDING: 'Pending confirmation', CONFIRMED: 'Confirmed', CHECKED_IN: 'Checked in',
  CHECKED_OUT: 'Checked out', CANCELLED: 'Cancelled',
};
export const roomConditions = ['AVAILABLE', 'MAINTENANCE'] as const;
export const housekeepingStates = ['CLEAN', 'DIRTY', 'IN_PROGRESS'] as const;
export const stayPayments = ['CASH', 'CARD_DEMO', 'UPI_DEMO'] as const;
export const stayPaymentLabels = { CASH: 'Pay at the hotel (demo)', CARD_DEMO: 'Card (demo)', UPI_DEMO: 'UPI (demo)' };
export const isReservationId = (id: string) => /^FSR-[A-F0-9]{24}$/.test(id);

export type Stay = { checkIn: string; checkOut: string; guests: number };
export type Amenity = { id: string; name: string; description: string; hotelFeature: boolean };
export type RoomType = {
  id: string; name: string; description: string; beds: string; sizeM2: number; capacity: number;
  nightlyRate: number; position: number; isListed: boolean; images: { url: string }[]; amenities: Amenity[];
};
export type Hotel = Pick<Restaurant, 'name' | 'tagline' | 'location' | 'description' | 'logoUrl' | 'timeZone'> & {
  email: string; phone: string; heroUrl: string;
};
export type Reservation = {
  id: string; status: ReservationStatus; roomTypeName: string; checkIn: string; checkOut: string; guestCount: number;
  nightlyRate: number; total: number; history: { status: ReservationStatus; at: string }[];
};
export type Room = {
  id: string; number: string; floor: string; condition: typeof roomConditions[number];
  housekeeping: typeof housekeepingStates[number]; roomTypeId: string;
};
export type StaffReservation = Reservation & {
  guestName: string; email: string; guest: { mobile: string }; room: { number: string; id: string }; payment: typeof stayPayments[number];
};
export type HotelOverview = {
  hotel: Hotel; roomTypes: RoomType[]; rooms: Room[]; amenities: Amenity[]; reservations: StaffReservation[];
  calendar: { roomId: string; night: string; reservation: { status: ReservationStatus; id: string } }[];
  occupied: number; pending: number; roomSales: number; today: string; week: string;
};

const dayMillis = 86_400_000;

export function hotelDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function dateOnly(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number) {
  return dayString(new Date(dateOnly(value).valueOf() + days * dayMillis));
}

export function nightsBetween(checkIn: string, checkOut: string) {
  return (dateOnly(checkOut).valueOf() - dateOnly(checkIn).valueOf()) / dayMillis;
}

export function formatStayDay(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dateOnly(value.slice(0, 10)));
}

export function reservationActions(status: ReservationStatus): ReservationStatus[] {
  if (status === 'PENDING') return ['CONFIRMED', 'CANCELLED'];
  if (status === 'CONFIRMED') return ['CHECKED_IN', 'CANCELLED'];
  if (status === 'CHECKED_IN') return ['CHECKED_OUT'];
  return [];
}
