interface WaiterCallData {
  TableId: string;        // UUID al mesei
  CounterCalls: number;   // număr apeluri către chelner
  Timestamp: string;      // ISO 8601 timestamp
}


export interface WaiterCallEvent {
  RestaurantId: string;   // UUID al restaurantului
  Data: WaiterCallData;   // obiect cu detalii despre apel
  EventType: "WaiterCall"; // tipul evenimentului (literal type)
}


interface SnoozeWaiterCallData {
  TableId: string;        // UUID al mesei
  Timestamp: string;    // ISO 8601 timestamp până la care apelul este amânat
}

export interface SnoozeWaiterCallEvent {
  RestaurantId: string;
  Data: SnoozeWaiterCallData;
  EventType: "SnoozeWaiterCall";
}

export enum WaiterCallState {
  Idle = 'idle',        // nicio chemare
  Active = 'active',    // există chemare
  Snoozed = 'snoozed'   // chemare snoozată
}
