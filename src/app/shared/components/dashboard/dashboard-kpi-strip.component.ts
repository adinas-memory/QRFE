import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import {
  ColComponent,
  RowComponent,
  TemplateIdDirective,
  WidgetStatAComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardMetricsResponse } from '@app/core/models/dashboard-metrics.model';

@Component({
  selector: 'app-dashboard-kpi-strip',
  templateUrl: './dashboard-kpi-strip.component.html',
  imports: [
    DecimalPipe,
    RowComponent,
    ColComponent,
    WidgetStatAComponent,
    TemplateIdDirective,
    IconDirective,
    TranslocoPipe
  ]
})
export class DashboardKpiStripComponent {
  readonly metrics = input<DashboardMetricsResponse | null>(null);
  readonly loading = input(false);

  readonly vm = computed(() => {
    const m = this.metrics();
    const k = m?.kpis;
    if (!k) {
      return {
        users: '—',
        usersDelta: 0,
        income: '—',
        incomeDelta: 0,
        conversion: '—',
        conversionDelta: 0,
        sessions: '—',
        sessionsDelta: 0
      };
    }
    return {
      users: String(k.activeUsers),
      usersDelta: k.activeUsersDeltaPercent,
      income: formatMoney(k.income, k.incomeCurrency),
      incomeDelta: k.incomeDeltaPercent,
      conversion: `${round1(k.conversionRatePercent)}%`,
      conversionDelta: k.conversionRateDeltaPercent,
      sessions: formatCompact(k.sessionCount),
      sessionsDelta: k.sessionDeltaPercent
    };
  });

  deltaIconName(delta: number): 'cilArrowTop' | 'cilArrowBottom' {
    return delta >= 0 ? 'cilArrowTop' : 'cilArrowBottom';
  }
}

function formatCompact(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  }
  return String(n);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}
