import { ValidatorFn, Validators } from '@angular/forms';

/** Practical email shape aligned with backend `[EmailAddress]` validation. */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const emailFormatValidator: ValidatorFn = control => {
  const value = (control.value ?? '').trim();
  if (!value) {
    return null;
  }
  return EMAIL_PATTERN.test(value) ? null : { email: true };
};

export const emailFieldValidators = [Validators.required, emailFormatValidator];
