export const UK_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  postcode: /^[A-Z]{1,2}[0-9][0-9A-Z]? [0-9][A-Z]{2}$/,
  phone: /^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$/,
  drivingLicence: /^[A-Z9]{5}[0-9]{6}[A-Z0-9]{5}$/,
  niNumber: /^(?!BG|GB|NK|KN|TN|NT|ZZ)[ABCEGHJ-PRSTW-Z]{2}[0-9]{6}[A-D]$/,
  passportNumber: /^[0-9]{9}$/,
  dvlaCode: /^[A-Z0-9]{8}$/,
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePostcode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  return trimmed.replace(/\D/g, "");
}

function normalizeAlphaNumeric(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function assertUkEmail(value: string | undefined | null, label = "email"): void {
  if (!value?.trim()) return;
  if (!UK_PATTERNS.email.test(normalizeEmail(value))) {
    throw new Error(`Invalid ${label} format`);
  }
}

export function assertUkPostcode(value: string | undefined | null, label = "postcode"): void {
  if (!value?.trim()) return;
  if (!UK_PATTERNS.postcode.test(normalizePostcode(value))) {
    throw new Error(`Invalid ${label} format`);
  }
}

export function assertUkPhone(value: string | undefined | null, label = "phone number"): void {
  if (!value?.trim()) return;
  if (!UK_PATTERNS.phone.test(normalizePhone(value))) {
    throw new Error(`Invalid ${label} format`);
  }
}

export function assertUkDrivingLicence(value: string | undefined | null, label = "driving licence number"): void {
  if (!value?.trim()) return;
  if (!UK_PATTERNS.drivingLicence.test(normalizeAlphaNumeric(value))) {
    throw new Error(`Invalid ${label} format`);
  }
}

export function assertUkNiNumber(value: string | undefined | null, label = "National Insurance number"): void {
  if (!value?.trim()) return;
  if (!UK_PATTERNS.niNumber.test(normalizeAlphaNumeric(value))) {
    throw new Error(`Invalid ${label} format`);
  }
}

export function assertUkPassportNumber(value: string | undefined | null, label = "passport number"): void {
  if (!value?.trim()) return;
  if (!UK_PATTERNS.passportNumber.test(value.trim().replace(/\s+/g, ""))) {
    throw new Error(`Invalid ${label} format`);
  }
}

export function assertUkDvlaCode(value: string | undefined | null, label = "DVLA check code"): void {
  if (!value?.trim()) return;
  if (!UK_PATTERNS.dvlaCode.test(normalizeAlphaNumeric(value))) {
    throw new Error(`Invalid ${label} format`);
  }
}

export function assertDriverOnboardingFields(input: {
  email?: string | null;
  postCode?: string | null;
  contactPhone?: string | null;
  emergencyContactPhone?: string | null;
  licenseNumber?: string | null;
  nationalInsurance?: string | null;
  passportNumber?: string | null;
  dvlaCode?: string | null;
}): void {
  assertUkEmail(input.email);
  assertUkPostcode(input.postCode);
  assertUkPhone(input.contactPhone, "contact phone");
  assertUkPhone(input.emergencyContactPhone, "emergency contact phone");
  assertUkDrivingLicence(input.licenseNumber);
  assertUkNiNumber(input.nationalInsurance);
  assertUkPassportNumber(input.passportNumber);
  assertUkDvlaCode(input.dvlaCode);
}
