import { Component } from '@angular/core';
import { PublicUrsShellComponent } from '../public-urs-shell/public-urs-shell.component';
import { PartnersLandingComponent } from './partners-landing.component';

@Component({
  selector: 'app-partners-page',
  standalone: true,
  imports: [PublicUrsShellComponent, PartnersLandingComponent],
  template: `
    <app-public-urs-shell [fragmentNav]="true" mainTopPadding="6rem">
      <app-partners-landing />
    </app-public-urs-shell>
  `,
})
export class PartnersPageComponent {}
