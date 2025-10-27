import React, { createContext, useState, useContext, useEffect } from 'react';
import { languages } from './languages';

const LanguageContext = createContext();

/**
 * Get the browser's preferred language
 * @returns {string} 'en' or 'fr'
 */
function getBrowserLanguage() {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';

  // Normalize to 'en' or 'fr'
  if (browserLang.toLowerCase().startsWith('fr')) {
    return 'fr';
  }
  return 'en'; // Default to English for all other languages
}

/**
 * Get the initial language from localStorage or browser preference
 * @returns {string} 'en' or 'fr'
 */
function getInitialLanguage() {
  // First, check if user has a saved preference
  const savedLanguage = localStorage.getItem('preferredLanguage');
  if (savedLanguage === 'en' || savedLanguage === 'fr') {
    return savedLanguage;
  }

  // Fall back to browser language
  return getBrowserLanguage();
}

export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(getInitialLanguage);
  const t = (key) => languages[currentLanguage][key] || key;

  // Save language preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('preferredLanguage', currentLanguage);
  }, [currentLanguage]);

  const toggleLanguage = () => {
    setCurrentLanguage(currentLanguage === 'en' ? 'fr' : 'en');
  };

  const setLanguage = (language) => {
    if (language === 'en' || language === 'fr') {
      setCurrentLanguage(language);
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, t, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
