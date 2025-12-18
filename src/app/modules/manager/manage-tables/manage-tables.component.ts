import { Component, OnInit, OnDestroy, viewChild } from '@angular/core';
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
import { Subject, filter, take, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { UserContextModel } from '../../../core/models/userContextModel';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { ToastBaseComponent } from '../../../shared/components/toast-base/toast-base.component';

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

  readonly toaster = viewChild(ToasterComponent);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private tablesService: TablesService
  ) {
    this.addTablesForm = this.fb.group({
      numberOfTables: [1, [Validators.required, Validators.min(1)]],
    });

    this.tablesForm = this.fb.group({
      tableName: ['', Validators.required]
    });

  }

  onAddTables(): void {
    if (this.addTablesForm.invalid) return;

    const payload = { numberOfTables: this.addTablesForm.value.numberOfTables };

    this.tablesService.create(this.restaurantId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addToast('Tables Created:', `${payload.numberOfTables}`, 3000, 'success');
          this.addTablesForm.reset({ numberOfTables: 1 });
          this.loadTables();
        },
        error: (err) => {
          this.addToast('Error:', err?.Message ?? 'Failed to create tables', 5000, 'danger');
        }
      });
  }

  loadTables(): void {
    this.tablesService.getAll(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => this.tables = response,
        error: err => console.error('[ManageTablesComponent] Error loading tables', err)
      });
  }

  onEdit(table: TableDTO): void {
    this.selectedTable = table;
    this.tablesForm.patchValue(table);
    this.editModalVisible = true;
  }

  closeEditModal(): void {
    this.editModalVisible = false;
    this.selectedTable = null;
  }

  onDelete(table: TableDTO): void {
    if (confirm(`Delete table #${table.tableName}`)) {
      this.tablesService.delete(this.restaurantId, table.tableId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.loadTables());
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

  ngOnInit(): void {
    this.authService.getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user && !!user.restaurantId),
        take(1)
      )
      .subscribe(user => {
        this.restaurantId = user.restaurantId ?? '';
        this.loadTables();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
