/** Mirrors backend QR.Domain.Enums.FeedbackKind */
export enum FeedbackKind {
  Bug = 0,
  Improvement = 1
}

export interface SubmitFeedbackPayload {
  kind: FeedbackKind;
  message: string;
  routeContext?: string | null;
}

export interface SubmitFeedbackResponse {
  id: string;
}
