import { PendingPlanModel } from "./pendingPlanModel";
import { RestaurantSetupFormModel } from "./restaurantSetupFormModel";

export interface SubscriptionPayloadModel extends RestaurantSetupFormModel, PendingPlanModel {}
