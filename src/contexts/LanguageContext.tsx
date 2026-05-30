import React, { createContext, useContext, useEffect, useState } from 'react';
import { getTranslation } from '../utils/i18n';

interface LanguageContextType {
  lang: string;
  setLang: (lang: string) => void;
  t: (keyPath: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (keyPath) => keyPath,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
      setLangState(savedLang);
    } else {
      const systemLang = navigator.language.split('-')[0];
      const supported = ['en', 'es', 'ru', 'fr'];
      if (supported.includes(systemLang)) {
        setLangState(systemLang);
        localStorage.setItem('language', systemLang);
      }
    }
  }, []);

  const setLang = (newLang: string) => {
    setLangState(newLang);
    localStorage.setItem('language', newLang);
  };

  const t = (keyPath: string) => getTranslation(lang, keyPath);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
