import { Injectable } from '@angular/core';
import { ChartData, ChartDataset, ChartOptions, ChartType, PluginOptionsByType, ScaleOptions, TooltipLabelStyle } from 'chart.js';
import { DashboardMetricsResponse } from '@app/core/models/dashboard-metrics.model';
import { DeepPartial } from './utils';
import { getStyle } from '@coreui/utils';

export interface IChartProps {
  data?: ChartData;
  labels?: unknown;
  options?: ChartOptions;
  colors?: unknown;
  type: ChartType;
  legend?: unknown;

  [propName: string]: unknown;
}

@Injectable({
  providedIn: 'any'
})
export class DashboardChartsData {
  /** Y-axis max derived from last applied traffic series (for theme refresh). */
  private lastYMax = 10;

  public mainChart: IChartProps = { type: 'line' };

  constructor() {
    this.applyTrafficFromMetrics('Month', null, 'Orders');
  }

  /**
   * @param ordersLabel Translated label (e.g. closed orders).
   */
  applyTrafficFromMetrics(period: string, metrics: DashboardMetricsResponse | null, ordersLabel: string): void {
    const brandInfo = getStyle('--cui-info') ?? '#20a8d8';
    const brandInfoBg = `rgba(${getStyle('--cui-info-rgb')}, .1)`;

    let labels: string[] = [];
    let ordersData: number[] = [];

    if (metrics?.dailySeries?.length) {
      const daily = [...metrics.dailySeries].sort((a, b) => a.date.localeCompare(b.date));
      if (period === 'Day') {
        const slice = daily.slice(-7);
        labels = slice.map(d => shortWeekday(d.date));
        ordersData = slice.map(d => d.closedOrders);
      } else if (period === 'Month') {
        const slice = daily.slice(-30);
        labels = slice.map(d => shortDate(d.date));
        ordersData = slice.map(d => d.closedOrders);
      } else {
        const monthly = [...(metrics.monthlySeries ?? [])].sort((a, b) =>
          a.year === b.year ? a.month - b.month : a.year - b.year
        );
        labels = monthly.map(x => `${x.month}/${x.year}`);
        ordersData = monthly.map(x => x.closedOrders);
      }
    }

    if (!ordersData.length) {
      labels = ['—'];
      ordersData = [0];
    }

    const maxOrders = Math.max(...ordersData, 0);
    this.lastYMax = Math.max(10, Math.ceil(maxOrders * 1.15));

    const datasets: ChartDataset[] = [
      {
        data: ordersData,
        label: ordersLabel,
        backgroundColor: brandInfoBg,
        borderColor: brandInfo,
        pointHoverBackgroundColor: brandInfo,
        borderWidth: 2,
        fill: true
      }
    ];

    const plugins: DeepPartial<PluginOptionsByType<any>> = {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          labelColor: (context: any) =>
            ({ backgroundColor: context.dataset.borderColor } as TooltipLabelStyle)
        }
      }
    };

    const scales = this.getScales();

    const options: ChartOptions = {
      maintainAspectRatio: false,
      plugins,
      scales,
      elements: {
        line: {
          tension: 0.4
        },
        point: {
          radius: 0,
          hitRadius: 10,
          hoverRadius: 4,
          hoverBorderWidth: 3
        }
      }
    };

    this.mainChart.type = 'line';
    this.mainChart.options = options;
    this.mainChart.data = {
      datasets,
      labels
    };
  }

   getScales(): ScaleOptions<any> {
    const colorBorderTranslucent = getStyle('--cui-border-color-translucent');
    const colorBody = getStyle('--cui-body-color');
    const maxY = this.lastYMax;
    const step = Math.max(1, Math.ceil(maxY / 5));

    return {
      x: {
        grid: {
          color: colorBorderTranslucent,
          drawOnChartArea: false
        },
        ticks: {
          color: colorBody
        }
      },
      y: {
        border: {
          color: colorBorderTranslucent
        },
        grid: {
          color: colorBorderTranslucent
        },
        max: maxY,
        beginAtZero: true,
        ticks: {
          color: colorBody,
          maxTicksLimit: 6,
          stepSize: step
        }
      }
    };
  }
}

function shortWeekday(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
}

function shortDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
