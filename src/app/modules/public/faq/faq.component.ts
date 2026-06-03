import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AccordionButtonDirective,
  AccordionComponent,
  AccordionItemComponent,
  ButtonDirective,
  ContainerComponent,
  TemplateIdDirective
} from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { environment } from '../../../../environments/environment';

/** FAQ entries must match `faq.items.<id>` in i18n JSON. */
const FAQ_ITEM_IDS = [
  'pwaSupportedBrowsers',
  'settingsCurrencyBeforeUse',
  'printerAgentDownload',
  'printerAgentInstall',
  'printerAgentReconnectAfterNetwork',
  'byodStaffDevices',
  'qrSignedSecurity',
  'bookingsSlotDuration',
  'guestOrderItemList',
  'confirmedOrderAddItems',
  'waiterCallVisual',
  'tableColors',
  'kitchenBarSse',
  'kitchenBarToastDismiss',
  'offlineOrders',
  'realtimeSync',
  'rolesAccess',
  'guestQrMenu',
  'orderEditsBlockedDuringPayment',
  'moveOrderConstraints',
  'dashboardReporting',
  'bookings',
  'languages',
  'subscriptionStripe'
] as const;

export type FaqItemId = (typeof FAQ_ITEM_IDS)[number];

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [
    AccordionComponent,
    AccordionItemComponent,
    AccordionButtonDirective,
    TemplateIdDirective,
    ContainerComponent,
    ButtonDirective,
    RouterLink,
    TranslocoPipe
  ],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss'
})
export class FaqComponent {
  protected readonly printerAgentDownloadUrl = environment.printerAgentDownloadUrl?.trim() ?? '';

  protected readonly printerAgentInstallSteps = [
    'step1',
    'step2',
    'step3',
    'step4',
    'step5',
    'step6',
    'step7',
    'step8',
  ] as const;

  /** On the landing page: show only the first questions + link to `/faq`. */
  readonly compact = input(false);
  /** On the landing page: tighter section without “back home”. */
  readonly embedded = input(false);

  protected readonly allItemIds: readonly FaqItemId[] = FAQ_ITEM_IDS;

  protected readonly visibleItemIds = computed(() => {
    const ids = [...this.allItemIds];
    return this.compact() ? ids.slice(0, 6) : ids;
  });
}
