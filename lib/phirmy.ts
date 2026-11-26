import type { Menu, TrackedOrder } from './domain';
import type { Hotel, Reservation } from './hospitality';

export type PhirmyContext = {
  hotel?: Hotel;
  reservation?: Reservation;
  menu: Menu;
  order?: TrackedOrder;
};

export interface PhirmyAssistant {
  chat?(input: { message: string; context: PhirmyContext }): Promise<{ reply: string }>;
  voice?(input: { audio: Blob; context: PhirmyContext }): Promise<{ audio: Blob }>;
}

export interface PhirmyTelephonyAdapter {
  handleCall(input: { callId: string; context: PhirmyContext }): Promise<void>;
}
