import { FormControl } from '@angular/forms';
import { emailFieldValidators, emailFormatValidator } from './email.validator';

describe('emailFormatValidator', () => {
  it('accepts a typical email', () => {
    const control = new FormControl('user@example.com', emailFieldValidators);
    expect(control.valid).toBeTrue();
  });

  it('rejects missing @', () => {
    const control = new FormControl('not-an-email', emailFieldValidators);
    expect(control.hasError('email')).toBeTrue();
  });

  it('rejects domain without TLD', () => {
    const control = new FormControl('user@domain', emailFieldValidators);
    expect(control.hasError('email')).toBeTrue();
  });

  it('requires a value when used with required validator', () => {
    const control = new FormControl('', emailFieldValidators);
    expect(control.hasError('required')).toBeTrue();
  });

  it('ignores empty value for format check alone', () => {
    const control = new FormControl('', emailFormatValidator);
    expect(control.valid).toBeTrue();
  });
});
