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
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';

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
    private appToast: AppToastService,
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

      this.appToast.error(`You can only add ${this.remaining} more table(s).`);

      this.activeTab = '0';
      return;
    }

    const payload = { numberOfTables: this.numberToAdd };

    this.tablesService.create(this.restaurantId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.appToast.success('Tables Created:', `${payload.numberOfTables}`);
          this.addTablesForm.reset({ numberOfTables: 1 });
          setTimeout(() => { this.loadTables(); }, 150);
        },
        error: (err) => {
          this.appToast.error(`Error: ${err?.Message} Failed to create tables`);
        }
      });
  }


  loadTables(): void {
    this.tablesService.getAll(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => { this.tables = [...response]; },
        error: err => this.appToast.error(`Error: ${err?.Message} Failed to load tables`)
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
        .subscribe({
          next: () => {
            this.loadTables();
            this.activeTab = '0';
            this.appToast.success(`Table Deleted: ${table.tableName}`);
          },
          error: (err) => this.appToast.error(`Error: ${err?.Message} Failed to delete table`)
        });
    }
  }

  onSubmit(): void {
    if (!this.selectedTable) return;

    const payload = { tableName: this.tablesForm.value.tableName };

    this.tablesService.update(this.restaurantId, this.selectedTable.tableId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.appToast.success('Table Updated:', payload.tableName);
          this.resetForm();
          this.loadTables();
          this.closeEditModal();
          this.activeTab = '0';
        },
        error: (err) => this.appToast.error(`Error: ${err?.Message} Failed to update table`)
      });
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
      .subscribe({
        next: (tables) => {
          this.tables = [...tables],
            this.activeTab = '0';
        },
        error: err => this.appToast.error(`Error: ${err?.Message} Failed to load tables`)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
