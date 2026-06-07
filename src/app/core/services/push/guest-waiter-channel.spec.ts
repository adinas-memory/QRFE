export {};

import { guestWaiterChannelId } from './guest-waiter-channel';

describe('guestWaiterChannelId', () => {
  it('builds channel id from restaurant guid', () => {
    expect(guestWaiterChannelId('019c1a13-db50-763a-8cde-4a39922a538d')).toBe(
      'guest_waiter_019c1a13db50763a8cde4a39922a538d',
    );
  });
});
