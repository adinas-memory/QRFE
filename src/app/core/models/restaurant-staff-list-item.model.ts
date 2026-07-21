/** Matches GET /api/restaurants/{restaurantId}/admin/staff */
export interface RestaurantStaffListItem {
  userId: string;
  email: string;
  displayName: string;
  role: string;
}

export interface StaffUserActionRequest {
  employeeId: string;
}
