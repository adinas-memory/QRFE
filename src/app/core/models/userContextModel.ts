export interface UserContextModel {
  id: string;
  roles: string | string[];
  restaurantId?: string | null;
}
