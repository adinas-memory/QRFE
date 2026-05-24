import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageTablesComponent } from './manage-tables.component';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';

describe('ManageTablesComponent', () => {
  let component: ManageTablesComponent;
  let fixture: ComponentFixture<ManageTablesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageTablesComponent],
      providers: [...COMMON_TEST_PROVIDERS],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageTablesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
