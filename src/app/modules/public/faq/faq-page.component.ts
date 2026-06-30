import { Component } from '@angular/core';
import { FaqComponent } from '../faq/faq.component';
import { PublicUrsShellComponent } from '../public-urs-shell/public-urs-shell.component';

@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [PublicUrsShellComponent, FaqComponent],
  template: `
    <app-public-urs-shell [fragmentNav]="true" mainTopPadding="6rem">
      <app-faq />
    </app-public-urs-shell>
  `,
})
export class FaqPageComponent {}
