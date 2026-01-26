import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  type CountryCode,
  type NumberFormat,
  type PhoneNumber,
  type Extension,
} from "libphonenumber-js";

export type PhoneNumberJson = {
  input?: string;
  defaultCountry?: string;
  number?: string;
  country?: string;
  countryCallingCode?: string;
  nationalNumber?: string;
  extension?: string;
  carrierCode?: string;
  type?: string;
  isPossible?: boolean;
  isValid?: boolean;
  formats?: {
    e164?: string;
    international?: string;
    national?: string;
    rfc3966?: string;
  };
};

export const OUTPUT_FORMATS = [
  "E.164",
  "INTERNATIONAL",
  "NATIONAL",
  "RFC3966",
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

const emptyPhoneNumber: PhoneNumberJson = {
  input: "",
  defaultCountry: "",
  number: "",
  country: "",
  countryCallingCode: "",
  nationalNumber: "",
  extension: "",
  carrierCode: "",
  type: "",
  isPossible: false,
  isValid: false,
  formats: {
    e164: "",
    international: "",
    national: "",
    rfc3966: "",
  },
};

export function getEmptyPhoneNumberJson(): PhoneNumberJson {
  return JSON.parse(JSON.stringify(emptyPhoneNumber)) as PhoneNumberJson;
}

export function formatPhoneNumberJson(data: PhoneNumberJson): string {
  return JSON.stringify(stripEmptyValues(data), null, 2);
}

export function parsePhoneNumberJson(text: string): {
  data: PhoneNumberJson;
  error: string | null;
} {
  if (!text.trim()) {
    return { data: getEmptyPhoneNumberJson(), error: null };
  }
  try {
    const parsed = JSON.parse(text) as PhoneNumberJson;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { data: getEmptyPhoneNumberJson(), error: "JSON must be an object." };
    }
    return { data: normalizePhoneNumberJson(parsed), error: null };
  } catch (error) {
    console.error(error);
    return {
      data: getEmptyPhoneNumberJson(),
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export function parsePhoneNumberString(
  text: string,
  defaultCountry?: string,
): { json: string; error: string | null } {
  const cleaned = normalizePhoneInput(text);
  if (!cleaned) {
    return { json: "", error: null };
  }

  try {
    const parsed = parsePhoneNumberFromString(
      cleaned,
      normalizeCountry(defaultCountry),
    );
    if (!parsed) {
      return { json: "", error: "Unable to parse phone number." };
    }

    const output = buildJsonFromPhoneNumber(parsed, cleaned, defaultCountry);
    return { json: formatPhoneNumberJson(output), error: null };
  } catch (error) {
    console.error(error);
    return {
      json: "",
      error: error instanceof Error ? error.message : "Failed to parse phone number.",
    };
  }
}

export function buildPhoneNumberFromJson(
  text: string,
  defaultCountry: string | undefined,
  outputFormat: OutputFormat,
): { number: string; error: string | null } {
  if (!text.trim()) {
    return { number: "", error: null };
  }

  const parsed = parsePhoneNumberJson(text);
  if (parsed.error) {
    return { number: "", error: parsed.error };
  }

  const data = parsed.data;
  const country = normalizeCountry(
    data.country || data.defaultCountry || defaultCountry,
  );

  let raw = (data.number || data.input || "").trim();
  if (!raw) {
    const national = (data.nationalNumber || "").trim();
    if (!national) {
      return { number: "", error: "Provide a number or national number." };
    }
    if (data.countryCallingCode) {
      raw = `+${data.countryCallingCode}${national}`;
    } else if (country) {
      raw = `+${getCountryCallingCode(country)}${national}`;
    } else {
      return { number: "", error: "Country or calling code is required." };
    }
  }

  try {
    const phoneNumber = parsePhoneNumberFromString(raw, country);
    if (!phoneNumber) {
      return { number: "", error: "Unable to parse phone number." };
    }
    if (data.extension) {
      phoneNumber.setExt(data.extension as Extension);
    }

    return {
      number: formatPhoneNumber(phoneNumber, outputFormat),
      error: null,
    };
  } catch (error) {
    console.error(error);
    return {
      number: "",
      error: error instanceof Error ? error.message : "Failed to build phone number.",
    };
  }
}

function buildJsonFromPhoneNumber(
  phoneNumber: PhoneNumber,
  input: string,
  defaultCountry?: string,
): PhoneNumberJson {
  return {
    input,
    defaultCountry: defaultCountry || undefined,
    number: phoneNumber.number,
    country: phoneNumber.country,
    countryCallingCode: phoneNumber.countryCallingCode,
    nationalNumber: phoneNumber.nationalNumber,
    extension: phoneNumber.ext,
    carrierCode: phoneNumber.carrierCode,
    type: phoneNumber.getType(),
    isPossible: phoneNumber.isPossible(),
    isValid: phoneNumber.isValid(),
    formats: {
      e164: phoneNumber.format("E.164"),
      international: phoneNumber.formatInternational(),
      national: phoneNumber.formatNational(),
      rfc3966: phoneNumber.getURI(),
    },
  };
}

function formatPhoneNumber(
  phoneNumber: PhoneNumber,
  outputFormat: OutputFormat,
): string {
  switch (outputFormat) {
    case "INTERNATIONAL":
      return phoneNumber.formatInternational();
    case "NATIONAL":
      return phoneNumber.formatNational();
    case "RFC3966":
      return phoneNumber.format("RFC3966");
    case "E.164":
    default:
      return phoneNumber.format("E.164");
  }
}

function normalizePhoneInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^tel:/i, "").trim();
}

function normalizeCountry(value?: string): CountryCode | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.toUpperCase() as CountryCode;
}

function normalizePhoneNumberJson(value: PhoneNumberJson): PhoneNumberJson {
  return {
    input: value.input ?? "",
    defaultCountry: value.defaultCountry ?? "",
    number: value.number ?? "",
    country: value.country ?? "",
    countryCallingCode: value.countryCallingCode ?? "",
    nationalNumber: value.nationalNumber ?? "",
    extension: value.extension ?? "",
    carrierCode: value.carrierCode ?? "",
    type: value.type ?? "",
    isPossible: value.isPossible ?? false,
    isValid: value.isValid ?? false,
    formats: {
      e164: value.formats?.e164 ?? "",
      international: value.formats?.international ?? "",
      national: value.formats?.national ?? "",
      rfc3966: value.formats?.rfc3966 ?? "",
    },
  };
}

function stripEmptyValues(value: PhoneNumberJson): PhoneNumberJson {
  const next: PhoneNumberJson = {};

  if (value.input) next.input = value.input;
  if (value.defaultCountry) next.defaultCountry = value.defaultCountry;
  if (value.number) next.number = value.number;
  if (value.country) next.country = value.country;
  if (value.countryCallingCode) next.countryCallingCode = value.countryCallingCode;
  if (value.nationalNumber) next.nationalNumber = value.nationalNumber;
  if (value.extension) next.extension = value.extension;
  if (value.carrierCode) next.carrierCode = value.carrierCode;
  if (value.type) next.type = value.type;
  if (value.isPossible !== undefined) next.isPossible = value.isPossible;
  if (value.isValid !== undefined) next.isValid = value.isValid;

  const formats = value.formats ? { ...value.formats } : {};
  if (formats.e164 || formats.international || formats.national || formats.rfc3966) {
    next.formats = formats;
  }

  return next;
}
