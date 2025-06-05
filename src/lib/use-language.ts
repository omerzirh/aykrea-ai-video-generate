import { useContext } from 'react';
import { LanguageContext } from './language-context';
import { LanguageContextType } from './language-types';

export const useLanguageHook = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
