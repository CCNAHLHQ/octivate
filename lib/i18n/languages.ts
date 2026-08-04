export type TranslateLanguage = {
  label: string;
  value: string;
  /** ISO 3166-1 alpha-2 for optional flag art */
  flag?: string;
};

/** Caribbean-first set + major world languages for Octivate i18n catalogs. */
export const TRANSLATE_LANGUAGES: TranslateLanguage[] = [
  { label: "English", value: "en", flag: "gb" },
  { label: "Español", value: "es", flag: "es" },
  { label: "Français", value: "fr", flag: "fr" },
  { label: "Kreyòl", value: "ht", flag: "ht" },
  { label: "Nederlands", value: "nl", flag: "nl" },
  { label: "Português", value: "pt", flag: "pt" },
  { label: "Deutsch", value: "de", flag: "de" },
  { label: "中文", value: "zh-CN", flag: "cn" },
  { label: "العربية", value: "ar", flag: "sa" },
  { label: "हिन्दी", value: "hi", flag: "in" },
];

export const TRANSLATE_STORAGE_KEY = "octivate_lang";
export const PAGE_LANGUAGE = "en";
