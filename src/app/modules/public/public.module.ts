import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconModule,IconSetService } from '@coreui/icons-angular';
import { routes } from './public.routes';

@NgModule({
  imports: [
    CommonModule,
    IconModule,
    RouterModule.forChild(routes)
  ],
  providers: [IconSetService],
})
export class PublicModule {}
