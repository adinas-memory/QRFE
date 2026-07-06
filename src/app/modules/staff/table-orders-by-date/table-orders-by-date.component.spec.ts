import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { TableOrdersByDateComponent } from './table-orders-by-date.component';
import { AuthService } from '../../../core/auth/auth.service';
import { OrdersService } from '../../../core/services/order-service/orders.service';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { Currency } from '../../../core/models/restaurantTablesModel';

describe('TableOrdersByDateComponent', () => {
  let component: TableOrdersByDateComponent;
  let fixture: ComponentFixture<TableOrdersByDateComponent>;
  let ordersService: jasmine.SpyObj<OrdersService>;
  let tablesService: jasmine.SpyObj<TablesService>;

  beforeEach(async () => {
    ordersService = jasmine.createSpyObj('OrdersService', ['listOrdersForTableByDate']);
    tablesService = jasmine.createSpyObj('TablesService', ['getAll']);
    tablesService.getAll.and.returnValue(
      of([
        {
          restaurantId: 'r1',
          tableId: 't1',
          isTableOpen: true,
          tableName: 'Table 1',
          isWaiterCalled: false
        },
        {
          restaurantId: 'r1',
          tableId: 't2',
          isTableOpen: false,
          tableName: 'Table 2',
          isWaiterCalled: false
        }
      ])
    );
    ordersService.listOrdersForTableByDate.and.callFake((_r, tableId) =>
      of(
        tableId === 't1'
          ? [
              {
                orderId: 'o1',
                createdOn: '2026-07-06T10:00:00Z',
                currency: Currency.RON,
                isOrderOpen: false,
                subTotal: { amount: 50, currency: Currency.RON },
                orderItems: []
              }
            ]
          : []
      )
    );

    await TestBed.configureTestingModule({
      imports: [
        TableOrdersByDateComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: { orderHistory: { error: 'err', noRestaurant: 'no rest' } } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' }
        })
      ],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getUserSnapshot: () => ({ restaurantId: 'r1', role: 'staff' })
          }
        },
        { provide: OrdersService, useValue: ordersService },
        { provide: TablesService, useValue: tablesService },
        { provide: AppToastService, useValue: jasmine.createSpyObj('AppToastService', ['error']) },
        {
          provide: MiscellaneousService,
          useValue: jasmine.createSpyObj('MiscellaneousService', ['getFirstErrorMessage'])
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TableOrdersByDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load merged orders with table names', () => {
    expect(component).toBeTruthy();
    expect(tablesService.getAll).toHaveBeenCalledWith('r1');
    expect(ordersService.listOrdersForTableByDate).toHaveBeenCalledTimes(2);
    expect(component.orderRows.length).toBe(1);
    expect(component.orderRows[0].tableName).toBe('Table 1');
    expect(component.startDate).toBe(component.endDate);
  });

  it('should compute period totals by currency', () => {
    expect(component.periodTotals.length).toBe(1);
    expect(component.periodTotals[0].orderCount).toBe(1);
    expect(component.periodTotals[0].totalAmount).toBe(50);
    expect(component.periodTotals[0].currency).toBe(Currency.RON);
  });

  it('should use admin scope for manager role', () => {
    const user = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService> & {
      getUserSnapshot: () => { restaurantId: string; role: string };
    };
    spyOn(user, 'getUserSnapshot').and.returnValue({ restaurantId: 'r1', role: 'manager' });
    component.ngOnInit();
    component.loadReport();
    expect(ordersService.listOrdersForTableByDate).toHaveBeenCalledWith(
      'r1',
      jasmine.any(String),
      jasmine.any(String),
      jasmine.any(String),
      'admin'
    );
  });

  it('should show toast on load error', () => {
    const toast = TestBed.inject(AppToastService) as jasmine.SpyObj<AppToastService>;
    ordersService.listOrdersForTableByDate.and.returnValue(throwError(() => new Error('fail')));
    component.loadReport();
    expect(toast.error).toHaveBeenCalled();
  });
});
