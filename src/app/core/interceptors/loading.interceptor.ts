import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
    const loading = inject(LoadingService);
    loading.show();

    if (req.url.includes('/sse')) {
        return next(req);
    }

    return next(req).pipe(
        finalize(() => {            
            loading.hide();
        })
    );
};