/** Matches backend `RegisterRequestModel` for manager register-staff. */
export interface RegisterStaffRequestModel {
  name: string;
  surname: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}
