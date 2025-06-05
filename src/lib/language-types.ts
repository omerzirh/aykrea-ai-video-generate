// Define language types to avoid circular dependencies
export type Language = 'en' | 'tr';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}
