import * as z from "zod";

export const UK_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  postcode: /^[A-Z]{1,2}[0-9][0-9A-Z]? [0-9][A-Z]{2}$/,
  phone: /^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$/,
  drivingLicence: /^[A-Z9]{5}[0-9]{6}[A-Z0-9]{5}$/,
  niNumber: /^(?!BG|GB|NK|KN|TN|NT|ZZ)[ABCEGHJ-PRSTW-Z]{2}[0-9]{6}[A-D]$/,
  passportNumber: /^[0-9]{9}$/,
  dvlaCode: /^[A-Z0-9]{8}$/,
} as const;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePostcode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  return trimmed.replace(/\D/g, "");
}

export function normalizeAlphaNumeric(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidUkEmail(value: string): boolean {
  return UK_PATTERNS.email.test(normalizeEmail(value));
}

export function isValidUkPostcode(value: string): boolean {
  return UK_PATTERNS.postcode.test(normalizePostcode(value));
}

export function isValidUkPhone(value: string): boolean {
  return UK_PATTERNS.phone.test(normalizePhone(value));
}

export function isValidUkDrivingLicence(value: string): boolean {
  return UK_PATTERNS.drivingLicence.test(normalizeAlphaNumeric(value));
}

export function isValidUkNiNumber(value: string): boolean {
  return UK_PATTERNS.niNumber.test(normalizeAlphaNumeric(value));
}

export function isValidUkPassportNumber(value: string): boolean {
  return UK_PATTERNS.passportNumber.test(value.trim().replace(/\s+/g, ""));
}

export function isValidUkDvlaCode(value: string): boolean {
  return UK_PATTERNS.dvlaCode.test(normalizeAlphaNumeric(value));
}

const optionalFormat = (
  validator: (value: string) => boolean,
  message: string,
  max = 50,
) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v?.trim() || validator(v), { message });

export const ukRequiredEmail = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(255, "Email is too long")
  .refine(isValidUkEmail, { message: "Enter a valid email address" });

export const ukOptionalEmail = optionalFormat(isValidUkEmail, "Enter a valid email address", 255);

export const ukOptionalPostcode = optionalFormat(
  isValidUkPostcode,
  "Enter a valid UK postcode (e.g. SW1A 1AA)",
  20,
);

export const ukOptionalPhone = optionalFormat(
  isValidUkPhone,
  "Enter a valid UK phone number (e.g. 07123 456789)",
  20,
);

export const ukOptionalDrivingLicence = optionalFormat(
  isValidUkDrivingLicence,
  "Enter a valid 16-character UK driving licence number",
  50,
);

export const ukOptionalNiNumber = optionalFormat(
  isValidUkNiNumber,
  "Enter a valid National Insurance number (e.g. QQ 12 34 56 C)",
  20,
);

export const ukOptionalPassportNumber = optionalFormat(
  isValidUkPassportNumber,
  "Enter a valid UK passport number (9 digits)",
  50,
);

export const ukOptionalDvlaCode = optionalFormat(
  isValidUkDvlaCode,
  "Enter a valid DVLA check code (8 characters)",
  50,
);

export const ukDriverPersonalFields = {
  email: ukRequiredEmail,
  contact_phone: ukOptionalPhone,
  post_code: ukOptionalPostcode,
  emergency_contact_phone: ukOptionalPhone,
  drivers_license_number: ukOptionalDrivingLicence,
  national_insurance_number: ukOptionalNiNumber,
  passport_number: ukOptionalPassportNumber,
  dvla_code: ukOptionalDvlaCode,
};

export const ONBOARDING_OWN_FORMAT_STEP_FIELDS: Record<number, string[]> = {
  1: ["email", "post_code", "emergency_contact_phone", "contact_phone"],
  2: ["drivers_license_number"],
  3: ["national_insurance_number", "passport_number"],
  4: ["dvla_code"],
};

export const ONBOARDING_LEASE_FORMAT_STEP_FIELDS: Record<number, string[]> = {
  1: ["email", "post_code", "emergency_contact_phone", "contact_phone"],
  2: ["drivers_license_number"],
  3: ["national_insurance_number", "passport_number"],
  5: ["dvla_code"],
};

export const HR_DRIVER_FORMAT_STEP_FIELDS = ONBOARDING_OWN_FORMAT_STEP_FIELDS;

export function getFieldFormatError(field: string, value: unknown): string | null {
  if (value == null || String(value).trim() === "") return null;
  const v = String(value);
  switch (field) {
    case "email":
      return isValidUkEmail(v) ? null : "Enter a valid email address";
    case "post_code":
      return isValidUkPostcode(v) ? null : "Enter a valid UK postcode (e.g. SW1A 1AA)";
    case "contact_phone":
    case "emergency_contact_phone":
      return isValidUkPhone(v) ? null : "Enter a valid UK phone number (e.g. 07123 456789)";
    case "drivers_license_number":
      return isValidUkDrivingLicence(v) ? null : "Enter a valid 16-character UK driving licence number";
    case "national_insurance_number":
      return isValidUkNiNumber(v) ? null : "Enter a valid National Insurance number (e.g. QQ 12 34 56 C)";
    case "passport_number":
      return isValidUkPassportNumber(v) ? null : "Enter a valid UK passport number (9 digits)";
    case "dvla_code":
      return isValidUkDvlaCode(v) ? null : "Enter a valid DVLA check code (8 characters)";
    default:
      return null;
  }
}

export function validateStepFormatFields(
  values: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const field of fields) {
    const err = getFieldFormatError(field, values[field]);
    if (err) return err;
  }
  return null;
}
