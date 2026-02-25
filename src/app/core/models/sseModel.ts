export interface SseEvent<T> {
  EventType: string;
  Data: T;
}
