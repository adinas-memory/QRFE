export interface SseEvent<T> {
  EventType: string;
  RestaurantId: string;
  Sequence: number;
  Data: T;
}


