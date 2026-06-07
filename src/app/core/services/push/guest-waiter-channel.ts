/** Must match backend FcmGuestWaiterChannelIds and Android GuestWaiterChannelIds. */
export const GUEST_WAITER_CHANNEL_PREFIX = 'guest_waiter_';

export function guestWaiterChannelId(restaurantId: string): string {
  const normalized = restaurantId.trim().toLowerCase().replace(/-/g, '');
  return normalized ? `${GUEST_WAITER_CHANNEL_PREFIX}${normalized}` : `${GUEST_WAITER_CHANNEL_PREFIX}unknown`;
}

export function guestWaiterChannelSoundPromptKey(restaurantId: string): string {
  return `qrfe.guestWaiterChannelSoundPrompted.${guestWaiterChannelId(restaurantId)}`;
}
