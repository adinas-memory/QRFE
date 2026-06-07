package com.universal_restaurant_system.pos;

/** Shared guest waiter notification channel id — must match backend FcmGuestWaiterChannelIds. */
public final class GuestWaiterChannelIds {

    private static final String PREFIX = "guest_waiter_";

    private GuestWaiterChannelIds() {
    }

    public static String forRestaurantId(String restaurantId) {
        if (restaurantId == null) {
            return PREFIX + "unknown";
        }
        String normalized = restaurantId.trim().toLowerCase().replace("-", "");
        if (normalized.isEmpty()) {
            return PREFIX + "unknown";
        }
        return PREFIX + normalized;
    }
}
