export interface VenueSizeConfig {
  type: 'Small' | 'Medium' | 'Large';
  maxTables: number;
  maxBars: number;
  maxBarSeats: number;
}

export type VenueSizeConfigList = VenueSizeConfig[];
