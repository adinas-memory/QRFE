import { Component } from '@angular/core';
import { FooterComponent } from '@coreui/angular';
import { environment } from '../../../../../../environments/environment';
import { AppFooterContentComponent } from '../../app-footer-content.component';

@Component({
  selector: 'app-default-footer',
  templateUrl: './default-footer.component.html',
  styleUrls: ['./default-footer.component.scss'],
  imports: [AppFooterContentComponent],
})
export class DefaultFooterComponent extends FooterComponent {
  readonly year = new Date().getFullYear();
  readonly poweredBy = environment.poweredBy;
  readonly poweredByUrl = 'https://universalrestaurant.systems/';

  constructor() {
    super();
  }
}
