import { Component, OnDestroy, OnInit, viewChild } from '@angular/core';
import {
  Tabs2Module, FormControlDirective,
  FormLabelDirective, AccordionButtonDirective,
  AccordionComponent, AccordionItemComponent,
  ToasterComponent, TemplateIdDirective,
  ToasterPlacement,
  FormSelectDirective,
  ButtonDirective,
  ButtonCloseDirective,
  ButtonGroupComponent,
  FormCheckLabelDirective,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  ModalComponent
} from '@coreui/angular';
import { } from '@coreui/angular';
import { MenuItemServiceService } from '../../../core/services/menu-item-service/menu-item-service.service';
import { filter, Subject, take, takeUntil } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MenuItem, MenuManagementResponse } from '../../../core/models/menu/menuItem';
import { AuthService } from '../../../core/auth/auth.service';
import { NgFor, NgIf, CurrencyPipe } from '@angular/common';
import { UserContextModel } from '../../../core/models/userContextModel';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-manage-menu',
  imports: [Tabs2Module, FormControlDirective,
    FormLabelDirective,
    NgFor, NgIf, ReactiveFormsModule,
    AccordionButtonDirective,
    AccordionComponent, AccordionItemComponent,
    TemplateIdDirective, CurrencyPipe,
    ToasterComponent, FormSelectDirective,
    ButtonDirective,
    ButtonGroupComponent,
    FormCheckLabelDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ModalBodyComponent,
    ModalFooterComponent
    ,
    TranslocoPipe
  ],
  standalone: true,
  templateUrl: './manage-menu.component.html'
})
export class ManageMenuComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private restaurantId = '';


  menuItems: MenuItem[] = [];
  /** Built from `menuItems` after each load (public for strict template checking). */
  groupedMenuItems: { [category: string]: MenuItem[] } = {};
  categories: string[] = [];
  selectedItem: MenuItem | null = null;
  menuItemsForm: FormGroup;
  presentationForm: FormGroup;
  weeklyDayForm: FormGroup;
  weeklyMenuItems: MenuItem[] = [];
  selectedFile: File | null = null;
  placement = ToasterPlacement.TopEnd;
  editModalVisible = false;
  forceRefreshAfterUpdate = Date.now();
  readonly weekdayIndexes = [0, 1, 2, 3, 4, 5, 6] as const;
  private presentationModeInitialized = false;

  // readonly toaster = viewChild(ToasterComponent);

  constructor(private menuItemService: MenuItemServiceService,
    private fb: FormBuilder, private authService: AuthService,
    private appToast: AppToastService,
    private transloco: TranslocoService) {
    this.presentationForm = this.fb.group({
      menuPresentationMode: ['fixed'],
    });
    this.weeklyDayForm = this.fb.group({
      selectedWeekday: [new Date().getDay()],
    });
    this.menuItemsForm = this.fb.group({
      menuItemName: ['', Validators.required],
      menuItemDescription: ['', Validators.required],
      menuItemPriceAmount: [0, [Validators.required, Validators.min(0.01)]],
      menuItemCategory: ['', Validators.required],
      menuItemIcon: [null, Validators.required],
      menuItemScheduleKind: ['permanent'],
      scheduledOnDate: [''],
      scheduledWeekday: [''],
    });
  }

  private rebuildGroupedMenuItems(): void {
    this.groupedMenuItems = this.menuItems.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(item);
      return acc;
    }, {} as { [category: string]: MenuItem[] });
  }

  weekdayLabel(d: number | string | null | undefined): string {
    const n = this.normalizeWeekday(d);
    return this.transloco.translate(`menu.manageMenu.weekdays.${n ?? 0}`);
  }

  private normalizeWeekday(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    };
    const key = String(value).toLowerCase();
    if (key in dayMap) return dayMap[key];
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  get selectedWeeklyDay(): number {
    return Number(this.weeklyDayForm.value.selectedWeekday ?? new Date().getDay());
  }

  setWeeklyDay(d: number): void {
    this.weeklyDayForm.setValue({ selectedWeekday: d });
  }

  private applyWeeklyDayFilter(): void {
    const day = this.selectedWeeklyDay;
    this.menuItems = this.weeklyMenuItems.filter(
      (i) => this.normalizeWeekday(i.scheduledWeekday) === day
    );
    this.rebuildGroupedMenuItems();
  }

  /** Local calendar date as `yyyy-MM-dd` (browser timezone). */
  localTodayIso(): string {
    return new Date().toLocaleDateString('en-CA');
  }

  loadMenuItems(): void {
    const clientDate = this.localTodayIso();
    const mode = this.selectedPresentationMode;
    const viewAs = mode;
    this.menuItemService.getManagementMenu(this.restaurantId, clientDate, viewAs)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: MenuManagementResponse) => {
          this.categories = response?.categories ?? [];
          const savedMode = (response.menuPresentationMode ?? 'Fixed').toLowerCase();
          if (!this.presentationModeInitialized) {
            this.presentationForm.patchValue(
              { menuPresentationMode: savedMode },
              { emitEvent: false }
            );
            this.presentationModeInitialized = true;
          }
          const activeMode = this.selectedPresentationMode;
          if (activeMode === 'weekly') {
            this.weeklyMenuItems = response?.menu?.menuItems ?? [];
            this.applyWeeklyDayFilter();
          } else {
            this.weeklyMenuItems = [];
            this.menuItems = response?.menu?.menuItems ?? [];
            this.rebuildGroupedMenuItems();
          }
          this.syncAddFormToPresentationMode(activeMode);
        },
        error: err => console.error('[ManageMenuComponent] Error loading menu items', err)
      });
  }

  savePresentation(): void {
    const mode = (this.presentationForm.getRawValue().menuPresentationMode as string) ?? 'fixed';
    this.menuItemService
      .updateMenuPresentation(this.restaurantId, { menuPresentationMode: mode })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.appToast.success(this.transloco.translate('menu.manageMenu.toastPresentationSaved'));
          this.syncAddFormToPresentationMode(mode);
          this.loadMenuItems();
        },
        error: () => {
          this.appToast.error(this.transloco.translate('menu.manageMenu.toastPresentationError'));
        },
      });
  }

  /** Align add/edit schedule fields with the selected presentation mode in the dropdown. */
  syncAddFormToPresentationMode(mode: string): void {
    const m = (mode ?? 'fixed').toLowerCase();
    if (m === 'daily') {
      this.menuItemsForm.patchValue({
        menuItemScheduleKind: 'dated',
        scheduledOnDate: this.localTodayIso(),
        scheduledWeekday: '',
      }, { emitEvent: false });
    } else if (m === 'weekly') {
      this.menuItemsForm.patchValue({
        menuItemScheduleKind: 'weekday',
        scheduledOnDate: '',
        scheduledWeekday: String(this.selectedWeeklyDay),
      }, { emitEvent: false });
    } else {
      this.menuItemsForm.patchValue({
        menuItemScheduleKind: 'permanent',
        scheduledOnDate: '',
        scheduledWeekday: '',
      }, { emitEvent: false });
    }
  }

  get selectedPresentationMode(): string {
    return (this.presentationForm.value.menuPresentationMode as string) ?? 'fixed';
  }

  private appendScheduleToFormData(formData: FormData): void {
    const sk = (this.menuItemsForm.value.menuItemScheduleKind as string) ?? 'permanent';
    const kindMap: Record<string, string> = { permanent: 'Permanent', dated: 'Dated', weekday: 'Weekday' };
    formData.append('menuItemScheduleKind', kindMap[sk.toLowerCase()] ?? 'Permanent');
    if (sk === 'dated') {
      const today = this.localTodayIso();
      formData.append('scheduledOnDate', today);
      this.menuItemsForm.patchValue({ scheduledOnDate: today }, { emitEvent: false });
    } else if (sk === 'weekday') {
      const w = this.menuItemsForm.value.scheduledWeekday;
      if (w !== '' && w !== null && w !== undefined) {
        formData.append('scheduledWeekday', String(w));
      }
    }
  }


  /**
   * Title-cases words whose letter count is greater than 3; shorter words stay as typed.
   * Uses Romanian locale for upper/lower casing (ă, î, ș, ț, etc.).
   */
  formatMenuItemName(): void {
    const control = this.menuItemsForm.get('menuItemName');
    if (!control || typeof control.value !== 'string') return;
    const raw = control.value;
    const trimmed = raw.trim();
    if (!trimmed) return;

    const formatted = trimmed
      .split(/\s+/)
      .map((word) => {
        const letterCount = [...word].filter((ch) => /\p{L}/u.test(ch)).length;
        if (letterCount <= 3) return word;
        let seenLetter = false;
        return [...word]
          .map((ch) => {
            if (!/\p{L}/u.test(ch)) {
              seenLetter = false;
              return ch;
            }
            if (!seenLetter) {
              seenLetter = true;
              return ch.toLocaleUpperCase('ro-RO');
            }
            return ch.toLocaleLowerCase('ro-RO');
          })
          .join('');
      })
      .join(' ');

    if (formatted !== raw) {
      control.setValue(formatted, { emitEvent: false });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      // optional: preview
      const previewUrl = URL.createObjectURL(this.selectedFile);
      this.menuItemsForm.patchValue({ menuItemIcon: this.selectedFile });
    }
  }

  onEdit(item: MenuItem): void {
    this.selectedItem = item;
    // this.menuItemsForm.patchValue(item);
    this.menuItemsForm.patchValue({
      menuItemName: item.menuItemName,
      menuItemDescription: item.menuItemDescription,
      menuItemPriceAmount: item.menuItemPriceAmount,
      menuItemCategory: item.category, // map correctly
      menuItemIcon: null, // don’t prefill file input
      menuItemScheduleKind: (item.menuItemScheduleKind ?? 'permanent').toString().toLowerCase(),
      scheduledOnDate: item.scheduledOnDate ?? '',
      scheduledWeekday:
        item.scheduledWeekday !== null && item.scheduledWeekday !== undefined
          ? String(item.scheduledWeekday)
          : '',
    });
    this.editModalVisible = true;
  }

  closeEditModal() {
    this.editModalVisible = false;
    this.selectedItem = null;
  }

  onDelete(item: MenuItem): void {
    if (confirm(`Delete "${item.menuItemName}"?`)) {
      this.menuItemService.delete(this.restaurantId, item.menuItemId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.loadMenuItems());
    }
  }

  toggleAvailability(item: MenuItem): void {
    const next = !(item.isAvailable ?? true);
    this.menuItemService.setAvailability(this.restaurantId, item.menuItemId, next)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          item.isAvailable = next;
          this.appToast.success(
            next
              ? this.transloco.translate('menu.availability.manager.toastAvailable')
              : this.transloco.translate('menu.availability.manager.toastUnavailable')
          );
        },
        error: (error) => {
          this.appToast.error(this.transloco.translate('menu.availability.manager.toastError'));
        }
      });
  }

  onSubmit(): void {
    this.formatMenuItemName();
    const formData = new FormData();
    formData.append('menuItemName', this.menuItemsForm.value.menuItemName);
    formData.append('menuItemDescription', this.menuItemsForm.value.menuItemDescription);
    formData.append('menuItemPriceAmount', this.menuItemsForm.value.menuItemPriceAmount);
    formData.append('menuItemCategory', this.menuItemsForm.value.menuItemCategory.toString());
    this.appendScheduleToFormData(formData);

    if (this.selectedFile) {
      formData.append('menuItemIcon', this.selectedFile);
    }

    if (this.selectedItem) {
      this.menuItemService.update(this.restaurantId, this.selectedItem.menuItemId, formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.appToast.success(`Menu Item Updated: ${this.menuItemsForm.get('menuItemName')?.value ?? ''}`);
            this.resetForm();
            this.loadMenuItems();
            this.closeEditModal();
          },
          error: (error) => {
            this.appToast.error(`Error updating Menu Item: ${error?.Message}`);
            this.resetForm();
            this.closeEditModal();
            this.loadMenuItems();
          }
        })
    } else {
      this.menuItemService.create(this.restaurantId, formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.appToast.success(`Menu Item Created: ${this.menuItemsForm.get('menuItemName')?.value ?? ''}`);
            this.resetForm();
            this.loadMenuItems();
          },
          error: (error) => {
            this.appToast.error(`Error creating Menu Item: ${error?.Message}`);
            this.resetForm();
            this.loadMenuItems();
          }
        });
    }
  }

  onUpdate() {
    this.formatMenuItemName();
    if (this.menuItemsForm.valid && this.selectedItem) {
      const updated = { ...this.selectedItem, ...this.menuItemsForm.value, menuItemPriceCurrency: this.selectedItem.menuItemPriceCurrency };
      this.menuItemService.update(this.restaurantId, this.selectedItem.menuItemId, updated)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadMenuItems();
            this.closeEditModal();
            this.resetForm();
            this.appToast.success(`Menu Item Updated: ${updated.menuItemName}`);
          },
          error: (error) => {

            this.closeEditModal();
            this.loadMenuItems();
            this.resetForm();
            this.appToast.error(`Error updating Menu Item: ${error?.Message}`);
          }
        });
      // .subscribe(() => {
      //   this.addToast('Menu Item Updated:', 'Success', 3000, 'success');
      //   this.closeEditModal();
      //   this.loadMenuItems();
      // },
      //   error => {
      //     this.closeEditModal();
      //     this.loadMenuItems();
      //     this.addToast('Error:', error.Message, 5000, 'danger');
      //   });
    }
  }

  ngOnInit(): void {
    this.presentationForm.get('menuPresentationMode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode: string) => {
        this.syncAddFormToPresentationMode(mode);
        this.loadMenuItems();
      });

    this.weeklyDayForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.selectedPresentationMode === 'weekly') {
          this.applyWeeklyDayFilter();
          this.syncAddFormToPresentationMode('weekly');
        }
      });

    this.authService.getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user && !!user.restaurantId),
        take(1)
      )
      .subscribe({
        next: (user) => {
          this.restaurantId = user?.restaurantId ?? '';
          this.loadMenuItems();
        },
        error: (err) => {
          this.appToast.error(`Error fetching menu items: ${err?.Message}`);
        }
      });
  }

  resetForm(): void {
    this.selectedItem = null;
    this.menuItemsForm.reset({
      menuItemPriceAmount: 0,
      menuItemScheduleKind: 'permanent',
      scheduledOnDate: '',
      scheduledWeekday: '',
    });
    this.syncAddFormToPresentationMode(this.selectedPresentationMode);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
