import type { Dictionary, Locale } from "../types";
import { en } from "./en";
import { uk } from "./uk";

export const dictionaries: Record<Locale, Dictionary> = { en, uk };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}
