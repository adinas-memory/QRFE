import { CurrencyPipe, NgStyle } from '@angular/common';
import { Component, computed, DestroyRef, DOCUMENT, effect, inject, OnInit, Renderer2, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ChartOptions } from 'chart.js';
import {
  AlertComponent,
  ButtonDirective,
  ButtonGroupComponent,
  CardBodyComponent,
  CardComponent,
  CardFooterComponent,
  ColComponent,
  FormCheckLabelDirective,
  RowComponent
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { filter, map } from 'rxjs';

import { AuthService } from '@app/core/auth/auth.service';
import { DashboardMetricsResponse } from '@app/core/models/dashboard-metrics.model';
import { ReportingService } from '@app/core/services/reporting/reporting.service';

import { DashboardChartsData, IChartProps } from './dashboard-charts-data';
import { DashboardKpiStripComponent } from './dashboard-kpi-strip.component';

@Component({
  templateUrl: 'dashboard.component.html',
  styleUrls: ['dashboard.component.scss'],
  imports: [
    CurrencyPipe,
    DashboardKpiStripComponent,
    AlertComponent,
    CardComponent,
    CardBodyComponent,
    RowComponent,
    ColComponent,
    ButtonDirective,
    IconDirective,
    ReactiveFormsModule,
    ButtonGroupComponent,
    FormCheckLabelDirective,
    ChartjsComponent,
    NgStyle,
    CardFooterComponent,
    TranslocoPipe
  ]
})
export class DashboardComponent implements OnInit {
  readonly #destroyRef = inject(DestroyRef);
  readonly #document: Document = inject(DOCUMENT);
  readonly #renderer = inject(Renderer2);
  readonly #chartsData = inject(DashboardChartsData);
  readonly #auth = inject(AuthService);
  readonly #reporting = inject(ReportingService);
  readonly #transloco = inject(TranslocoService);

  readonly metrics = signal<DashboardMetricsResponse | null>(null);
  readonly loadError = signal<'noRestaurant' | 'requestFailed' | null>(null);
  readonly loadingMetrics = signal(false);
  readonly trafficPeriod = signal<string>('Month');

  readonly trafficFooter = computed(() => {
    const m = this.metrics();
    const p = this.trafficPeriod();
    if (!m) {
      return null;
    }
    return summarizeTrafficWindow(m, p);
  });

  public mainChart: IChartProps = { type: 'line' };
  public mainChartRef: WritableSignal<unknown> = signal(undefined);
  #mainChartRefEffect = effect(() => {
    if (this.mainChartRef()) {
      this.setChartStyles();
    }
  });

  public trafficRadioGroup = new FormGroup({
    trafficRadio: new FormControl('Month')
  });

  ngOnInit(): void {
    this.trafficPeriod.set(this.trafficRadioGroup.value.trafficRadio ?? 'Month');
    this.refreshChartFromMetrics();
    this.updateChartOnColorModeChange();

    this.#auth.hydrateSessionFromStorageIfNeeded();
    this.#auth
      .getUserContext()
      .pipe(
        map(u => (typeof u?.restaurantId === 'string' ? u.restaurantId : null)),
        filter((rid): rid is string => !!rid),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe(() => this.loadMetrics());
  }

  loadMetrics(): void {
    const rid = this.#auth.getUserRestaurantId();
    if (typeof rid !== 'string' || !rid) {
      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'lan-dashboard',hypothesisId:'H-NOCTX',location:'dashboard.component.ts:loadMetrics',message:'no restaurant id; skipping metrics',data:{ridType:typeof rid,ridValue:rid??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      this.loadError.set('noRestaurant');
      this.loadingMetrics.set(false);
      this.refreshChartFromMetrics();
      return;
    }

    this.loadError.set(null);
    this.loadingMetrics.set(true);
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'lan-dashboard',hypothesisId:'H-METRICS',location:'dashboard.component.ts:loadMetrics',message:'requesting dashboard metrics',data:{rid},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    this.#reporting
      .getDashboardMetrics(rid)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: m => {
          // #region agent log
          fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'lan-dashboard',hypothesisId:'H-METRICS',location:'dashboard.component.ts:loadMetrics',message:'metrics loaded',data:{hasKpis:!!(m as any)?.kpis},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          this.metrics.set(m);
          this.loadingMetrics.set(false);
          this.refreshChartFromMetrics();
        },
        error: () => {
          // #region agent log
          fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'lan-dashboard',hypothesisId:'H-METRICS',location:'dashboard.component.ts:loadMetrics',message:'metrics request failed',data:{rid},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          this.loadingMetrics.set(false);
          this.loadError.set('requestFailed');
          this.metrics.set(null);
          this.refreshChartFromMetrics();
        }
      });
  }

  refreshChartFromMetrics(): void {
    const period = this.trafficRadioGroup.value.trafficRadio ?? 'Month';
    const label = this.#transloco.translate('dashboard.trafficSeriesOrders');
    this.#chartsData.applyTrafficFromMetrics(period, this.metrics(), label);
    this.initCharts();
  }

  initCharts(): void {
    const ref = this.mainChartRef() as { stop?: () => void } | undefined;
    ref?.stop?.();
    this.mainChart = this.#chartsData.mainChart;
  }

  setTrafficPeriod(value: string): void {
    this.trafficRadioGroup.setValue({ trafficRadio: value });
    this.trafficPeriod.set(value);
    this.refreshChartFromMetrics();
  }

  handleChartRef($chartRef: unknown) {
    if ($chartRef) {
      this.mainChartRef.set($chartRef);
    }
  }

  updateChartOnColorModeChange() {
    const unListen = this.#renderer.listen(this.#document.documentElement, 'ColorSchemeChange', () => {
      this.setChartStyles();
    });

    this.#destroyRef.onDestroy(() => {
      unListen();
    });
  }

  setChartStyles() {
    const ref = this.mainChartRef() as { options?: ChartOptions; update?: () => void } | undefined;
    if (ref) {
      setTimeout(() => {
        const base = this.mainChart.options?.scales;
        const prev = base && typeof base === 'object' ? base : {};
        const scales = this.#chartsData.getScales();
        ref.options ??= {};
        ref.options.scales = { ...prev, ...scales } as ChartOptions['scales'];
        ref.update?.();
      });
    }
  }
}

function summarizeTrafficWindow(m: DashboardMetricsResponse, period: string) {
  const cc = m.kpis.incomeCurrency;
  const daily = [...m.dailySeries].sort((a, b) => a.date.localeCompare(b.date));
  if (period === 'Year') {
    const mo = m.monthlySeries ?? [];
    const orders = mo.reduce((s, x) => s + x.closedOrders, 0);
    const revenue = mo.reduce((s, x) => s + Number(x.revenue), 0);
    return { orders, revenue, logins: null as number | null, currency: cc };
  }
  const slice = period === 'Day' ? daily.slice(-7) : daily.slice(-30);
  const orders = slice.reduce((s, d) => s + d.closedOrders, 0);
  const revenue = slice.reduce((s, d) => s + Number(d.revenue), 0);
  const logins = slice.reduce((s, d) => s + d.loginEvents, 0);
  return { orders, revenue, logins, currency: cc };
}
