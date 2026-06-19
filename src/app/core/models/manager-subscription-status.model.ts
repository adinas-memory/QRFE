export interface ManagerSubscriptionStatusModel {
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAtUtc: string | null;
}

export interface CancelSubscriptionResultModel {
  isCancelled: boolean;
  cancelAtPeriodEnd: boolean;
  cancelAtUtc: string | null;
  subscriptionStatus: string | null;
}
