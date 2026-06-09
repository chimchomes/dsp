export type HrDriverDraftForm = {
  first_name: string;
  surname: string;
  email: string;
  password: string;
  operator_id: string;
  contact_phone: string;
  address_line_1: string;
  address_line_2: string;
  address_line_3: string;
  post_code: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  drivers_license_number: string;
  license_expiry_date: string;
  license_picture: string;
  national_insurance_number: string;
  passport_upload: string;
  passport_number: string;
  passport_expiry_date: string;
  photo_upload: string;
  dvla_code: string;
  dbs_check: boolean;
  driver_availability: string;
};

export type HrDriverDraft = {
  currentStep: number;
  form: HrDriverDraftForm;
};

export const emptyHrDriverForm = (): HrDriverDraftForm => ({
  first_name: "",
  surname: "",
  email: "",
  password: "",
  operator_id: "",
  contact_phone: "",
  address_line_1: "",
  address_line_2: "",
  address_line_3: "",
  post_code: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  drivers_license_number: "",
  license_expiry_date: "",
  license_picture: "",
  national_insurance_number: "",
  passport_upload: "",
  passport_number: "",
  passport_expiry_date: "",
  photo_upload: "",
  dvla_code: "",
  dbs_check: false,
  driver_availability: "",
});

export function hrDriverDraftKey(tenantId: string, userId: string) {
  return `dspdev:hr-driver-draft:${tenantId}:${userId}`;
}

export function loadHrDriverDraft(tenantId: string, userId: string): HrDriverDraft | null {
  try {
    const raw = localStorage.getItem(hrDriverDraftKey(tenantId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HrDriverDraft;
    if (!parsed?.form) return null;
    return {
      currentStep: parsed.currentStep || 1,
      form: { ...emptyHrDriverForm(), ...parsed.form },
    };
  } catch {
    return null;
  }
}

export function saveHrDriverDraft(tenantId: string, userId: string, draft: HrDriverDraft) {
  localStorage.setItem(hrDriverDraftKey(tenantId, userId), JSON.stringify(draft));
}

export function clearHrDriverDraft(tenantId: string, userId: string) {
  localStorage.removeItem(hrDriverDraftKey(tenantId, userId));
}
