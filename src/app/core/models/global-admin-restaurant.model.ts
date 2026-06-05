import { RestaurantType } from './subscription-product';

export interface RestaurantStatisticDTO {
  restaurantId: string;
  restaurantName: string;
  numberOfTables: number;
  numberOfBars: number;
  restaurantType: string;
  baseRestaurantName?: string;
}

export interface ListRestaurantsResponse {
  result: RestaurantStatisticDTO[] | null;
  totalCount: number;
}

export interface RestaurantDetailDTO {
  restaurantId: string;
  restaurantName: string;
  restaurantType: string;
  tables?: unknown[] | null;
  bars?: unknown[] | null;
  menu?: unknown | null;
  baseRestaurantName?: string;
}

export interface CreateRestaurantRequest {
  restaurantName: string;
  useCurrency: string;
  restaurantType: RestaurantType | string;
}

export interface UpdateRestaurantRequest {
  restaurantName: string;
  itHasBar: boolean;
}

export interface DeleteRestaurantResponse {
  restaurantId: string;
  success: boolean;
}
