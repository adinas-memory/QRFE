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
