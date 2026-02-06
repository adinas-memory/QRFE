export interface UserContextModel {
  id: string;
  role: string;
  restaurantId?: string | null;  
  restaurantName?: string | null;
  restaurantType?: string | null;
}
