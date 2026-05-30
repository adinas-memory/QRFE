import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@app/core/auth/auth.service';
import { formatStaffDisplayName } from '@app/core/auth/user-display-name';
import { LANG_STORAGE_KEY, APP_LANGS, type AppLang } from '@app/core/i18n/transloco.config';
import { FeedbackLaunchComponent } from '@app/shared/components/feedback/feedback-launch.component';

import {
  AvatarComponent,
  BadgeComponent,
  BreadcrumbRouterComponent,
  ColorModeService,
  ContainerComponent,
  DropdownComponent,
  DropdownDividerDirective,
  DropdownHeaderDirective,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  HeaderComponent,
  HeaderNavComponent,
  HeaderTogglerDirective,
  NavItemComponent,
  NavLinkDirective,
  SidebarToggleDirective
} from '@coreui/angular';

import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map, startWith, take } from 'rxjs';

function flagClassForLang(id: AppLang): string {
  const m: Record<AppLang, string> = {
    ro: 'cif-ro',
    en: 'cif-gb',
    it: 'cif-it',
    fr: 'cif-fr',
    es: 'cif-es',
    de: 'cif-de',
    sv: 'cif-se',
  };
  return m[id];
}

@Component({
  selector: 'app-default-header',
  standalone: true,
  templateUrl: './default-header.component.html',
  styleUrl: './default-header.component.scss',
  imports: [ContainerComponent, HeaderTogglerDirective, SidebarToggleDirective, IconDirective, HeaderNavComponent, NavItemComponent, NavLinkDirective, RouterLink, RouterLinkActive, NgTemplateOutlet, BreadcrumbRouterComponent, DropdownComponent, DropdownToggleDirective, AvatarComponent, DropdownMenuDirective, DropdownHeaderDirective, DropdownItemDirective, BadgeComponent, DropdownDividerDirective, FeedbackLaunchComponent, TranslocoPipe]
})
export class DefaultHeaderComponent extends HeaderComponent {

  readonly #colorModeService = inject(ColorModeService);
  readonly #authService = inject(AuthService);
  readonly #router = inject(Router);
  readonly #transloco = inject(TranslocoService);
  private profilePingRequested = false;
  readonly colorMode = this.#colorModeService.colorMode;

  /** Settings / Payments rows: only manager & global admin */
  readonly user = toSignal(this.#authService.user$, {
    initialValue: this.#authService.getUserSnapshot()
  });
  readonly showManagerAccountMenu = computed(() => {
    const r = this.user()?.role?.toLowerCase();
    return r === 'manager' || r === 'gadmin';
  });

  readonly staffDisplayName = computed(() => {
    const u = this.user();
    if (!u) return null;
    const label = formatStaffDisplayName({
      displayName: u.displayName,
      name: u.name,
      surname: u.surname,
      email: u.email,
    });
    return label || null;
  });

  readonly colorModes = [
    { name: 'light' as const, icon: 'cilSun' },
    { name: 'dark' as const, icon: 'cilMoon' },
    { name: 'auto' as const, icon: 'cilContrast' }
  ];

  readonly langOptions = APP_LANGS.map((id: AppLang) => ({
    id,
    label: id.toUpperCase(),
    flag: flagClassForLang(id),
  }));

  readonly activeLang = toSignal(
    this.#transloco.langChanges$.pipe(
      startWith(this.#transloco.getActiveLang()),
      map(() => this.#transloco.getActiveLang() as AppLang),
    ),
    { initialValue: this.#transloco.getActiveLang() as AppLang },
  );

  setLanguage(lang: AppLang): void {
    this.#transloco.setActiveLang(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }

  themeLabel(modeName: string): string {
    const key =
      modeName === 'light'
        ? 'header.themeLight'
        : modeName === 'dark'
          ? 'header.themeDark'
          : 'header.themeAuto';
    return this.#transloco.translate(key);
  }

  readonly icons = computed(() => {
    const currentMode = this.colorMode();
    return this.colorModes.find(mode => mode.name === currentMode)?.icon ?? 'cilSun';
  });

  constructor() {
    super();
    effect(() => {
      const u = this.user();
      const label = this.staffDisplayName();
      if (u && !label && !this.profilePingRequested) {
        this.profilePingRequested = true;
        this.#authService.pingSession(false).pipe(take(1)).subscribe();
      }
    });
  }

  sidebarId = input('sidebar1');

  onLogout(): void {
    this.#authService.logout().subscribe(() => {
      this.#router.navigate(['/login']);
    });
  }

  public newMessages = [
    {
      id: 0,
      from: 'Jessica Williams',
      avatar: '7.jpg',
      status: 'success',
      title: 'Urgent: System Maintenance Tonight',
      time: 'Just now',
      link: 'apps/email/inbox/message',
      message: 'Attention team, we\'ll be conducting critical system maintenance tonight from 10 PM to 2 AM. Plan accordingly...'
    },
    {
      id: 1,
      from: 'Richard Johnson',
      avatar: '6.jpg',
      status: 'warning',
      title: 'Project Update: Milestone Achieved',
      time: '5 minutes ago',
      link: 'apps/email/inbox/message',
      message: 'Kudos on hitting sales targets last quarter! Let\'s keep the momentum. New goals, new victories ahead...'
    },
    {
      id: 2,
      from: 'Angela Rodriguez',
      avatar: '5.jpg',
      status: 'danger',
      title: 'Social Media Campaign Launch',
      time: '1:52 PM',
      link: 'apps/email/inbox/message',
      message: 'Exciting news! Our new social media campaign goes live tomorrow. Brace yourselves for engagement...'
    },
    {
      id: 3,
      from: 'Jane Lewis',
      avatar: '4.jpg',
      status: 'info',
      title: 'Inventory Checkpoint',
      time: '4:03 AM',
      link: 'apps/email/inbox/message',
      message: 'Team, it\'s time for our monthly inventory check. Accurate counts ensure smooth operations. Let\'s nail it...'
    },
    {
      id: 4,
      from: 'Ryan Miller',
      avatar: '3.jpg',
      status: 'info',
      title: 'Customer Feedback Results',
      time: '3 days ago',
      link: 'apps/email/inbox/message',
      message: 'Our latest customer feedback is in. Let\'s analyze and discuss improvements for an even better service...'
    }
  ];

  public newNotifications = [
    { id: 0, title: 'New user registered', icon: 'cilUserFollow', color: 'success' },
    { id: 1, title: 'User deleted', icon: 'cilUserUnfollow', color: 'danger' },
    { id: 2, title: 'Sales report is ready', icon: 'cilChartPie', color: 'info' },
    { id: 3, title: 'New client', icon: 'cilBasket', color: 'primary' },
    { id: 4, title: 'Server overloaded', icon: 'cilSpeedometer', color: 'warning' }
  ];

  public newStatus = [
    { id: 0, title: 'CPU Usage', value: 25, color: 'info', details: '348 Processes. 1/4 Cores.' },
    { id: 1, title: 'Memory Usage', value: 70, color: 'warning', details: '11444GB/16384MB' },
    { id: 2, title: 'SSD 1 Usage', value: 90, color: 'danger', details: '243GB/256GB' }
  ];

  public newTasks = [
    { id: 0, title: 'Upgrade NPM', value: 0, color: 'info' },
    { id: 1, title: 'ReactJS Version', value: 25, color: 'danger' },
    { id: 2, title: 'VueJS Version', value: 50, color: 'warning' },
    { id: 3, title: 'Add new layouts', value: 75, color: 'info' },
    { id: 4, title: 'Angular Version', value: 100, color: 'success' }
  ];

}
