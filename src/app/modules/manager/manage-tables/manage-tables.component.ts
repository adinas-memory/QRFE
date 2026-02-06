import { Component, OnInit, OnDestroy, viewChild, ChangeDetectorRef } from '@angular/core';
import {
  Tabs2Module, FormControlDirective, FormLabelDirective,
  AccordionButtonDirective, AccordionComponent, AccordionItemComponent,
  ToasterComponent, TemplateIdDirective, ToasterPlacement,
  ButtonDirective, ButtonCloseDirective,
  ModalBodyComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, ModalComponent
} from '@coreui/angular';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { Subject, filter, switchMap, take, takeUntil, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { UserContextModel } from '../../../core/models/userContextModel';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { ToastBaseComponent } from '../../../shared/components/toast-base/toast-base.component';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';

@Component({
  selector: 'app-manage-tables',
  standalone: true,
  imports: [
    Tabs2Module, FormControlDirective, FormLabelDirective,
    NgFor, ReactiveFormsModule, NgIf, ModalFooterComponent, ModalHeaderComponent,
    ModalTitleDirective, ModalBodyComponent, ModalComponent,
    AccordionButtonDirective, AccordionComponent, AccordionItemComponent,
    ToasterComponent, TemplateIdDirective,
    ButtonDirective, ButtonCloseDirective

  ],
  templateUrl: './manage-tables.component.html'
})
export class ManageTablesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private restaurantId = '';

  tables: TableDTO[] = [];
  selectedTable: TableDTO | null = null;
  tablesForm: FormGroup;
  addTablesForm: FormGroup;
  placement = ToasterPlacement.TopEnd;
  editModalVisible = false;
  restaurantLimits: any | null = null;
  restaurantType: string | null = null;
  activeTab = '0';
  numberToAdd: number = 0;
  existing: number = 0;
  maxAllowed: number = 0;
  remaining: number = 0;

  readonly toaster = viewChild.required(ToasterComponent);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private tablesService: TablesService,
    private miscService: MiscellaneousService,
  ) {
    this.addTablesForm = this.fb.group({
      numberOfTables: [1, [Validators.required, Validators.min(1)]],
    });

    this.tablesForm = this.fb.group({
      tableName: ['', Validators.required]
    });

  }

  onAddTables(): void {
    if (this.addTablesForm.invalid || !this.restaurantLimits) return;

    this.numberToAdd = this.addTablesForm.value.numberOfTables;
    this.existing = this.tables.length;
    this.maxAllowed = this.restaurantLimits.maxTables;

    if (this.existing + this.numberToAdd > this.maxAllowed) {
      this.remaining = this.maxAllowed - this.existing;

      this.addToast(
        'Limit exceeded',
        `You already reached the maximum number of tables (${this.maxAllowed}).`,
        4000,
        'danger'
      );
      this.activeTab = '0';
      console.log('this.activeTab:', this.activeTab);
      return;
    }

    const payload = { numberOfTables: this.numberToAdd };

    this.tablesService.create(this.restaurantId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addToast('Tables Created:', `${payload.numberOfTables}`, 3000, 'success');
          this.addTablesForm.reset({ numberOfTables: 1 });
          setTimeout(() => { this.loadTables(); }, 150);
        },
        error: (err) => {
          this.addToast('Error:', err?.Message ?? 'Failed to create tables', 5000, 'danger');
        }
      });
  }


  loadTables(): void {
    console.log("restaurantId:", this.restaurantId);
    this.tablesService.getAll(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => { this.tables = [...response]; },
        error: err => console.error('[ManageTablesComponent] Error loading tables', err)
      });
  }

  onEdit(table: TableDTO): void {
    this.selectedTable = table;
    this.tablesForm.patchValue(table);
    this.editModalVisible = true;
    this.activeTab = '0';
  }

  closeEditModal(): void {
    this.editModalVisible = false;
    this.selectedTable = null;
  }

  onDelete(table: TableDTO): void {
    if (confirm(`Delete table #${table.tableName}`)) {
      this.tablesService.delete(this.restaurantId, table.tableId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadTables();
          this.activeTab = '0';
        });
    }
  }

  onSubmit(): void {
    if (!this.selectedTable) return;

    const payload = { tableName: this.tablesForm.value.tableName };

    this.tablesService.update(this.restaurantId, this.selectedTable.tableId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.addToast('Table Updated:', payload.tableName, 3000, 'success');
        this.resetForm();
        this.loadTables();
        this.closeEditModal();
        this.activeTab = '0';
        console.log('this.activeTab:', this.activeTab);
      });

  }

  addToast(title: string, message: string, delay: number, color: string) {
    const options = { title, message, delay, placement: this.placement, color, autohide: true };
    this.toaster()?.addToast(ToastBaseComponent, { ...options });
  }

  resetForm(): void {
    this.selectedTable = null;
    this.tablesForm.reset({ capacity: 1, status: 'Available' });
  }

  get remainingTables(): number {
    if (!this.restaurantLimits)
      return 0;
    return this.restaurantLimits.maxTables - this.tables.length;
  }

  ngOnInit(): void {
    this.restaurantType = this.authService.getRestaurantCtx()?.type ?? null;

    this.authService.getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user && !!user.restaurantId),
        take(1),
        tap(user => this.restaurantId = user.restaurantId ?? ''),
        switchMap(() => this.miscService.getRestaurantLimits()),
        tap(limits => this.restaurantLimits = limits.find(x => x.type === this.restaurantType) ?? null),
        switchMap(() => this.tablesService.getAll(this.restaurantId))
      )
      .subscribe(tables => {
        this.tables = [...tables];
        this.activeTab = '0';
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
