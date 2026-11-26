import type { Menu, TrackedOrder } from './domain';

export type PhirmyContext = {
  menu: Menu;
  order?: TrackedOrder;
};

export interface PhirmyAssistant {
  chat?(input: { message: string; context: PhirmyContext }): Promise<{ reply: string }>;
  voice?(input: { audio: Blob; context: PhirmyContext }): Promise<{ audio: Blob }>;
}
