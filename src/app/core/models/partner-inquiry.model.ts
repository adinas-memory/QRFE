/** Mirrors backend QR.Domain.Enums.PartnerPortfolioSize */
export enum PartnerPortfolioSize {
  ZeroToFifty = 0,
  FiftyToTwoHundred = 1,
  OverTwoHundred = 2,
}

export interface SubmitPartnerInquiryPayload {
  companyName: string;
  contactEmail: string;
  cityRegion: string;
  portfolioSize: PartnerPortfolioSize;
  message: string;
  locale: string;
}

export interface SubmitPartnerInquiryResponse {
  id: string;
}
