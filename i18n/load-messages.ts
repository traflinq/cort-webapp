import type { Locale } from "./config";
import enCommon from "../messages/en/common.json";
import enCompany from "../messages/en/company.json";
import arCommon from "../messages/ar/common.json";
import arCompany from "../messages/ar/company.json";

export function loadMessages(locale: Locale) {
  if (locale === "ar") return { ...arCommon, ...arCompany };
  return { ...enCommon, ...enCompany };
}
