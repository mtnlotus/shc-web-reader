import React, { createContext, useState, useContext, useEffect } from 'react';
import { languages } from './languages';

const LanguageContext = createContext();

/**
 * Get the browser's preferred language
 * @returns {string} 'en' or 'fr'
 */
function getBrowserLanguage() {
  // Check navigator.languages array if available
  if (navigator.languages && navigator.languages.length > 0) {
    // Determine whether fr or en is a preferred language
    for (const lang of navigator.languages) {
      const lowerLang = lang.toLowerCase();
      if (lowerLang.startsWith('fr')) {
        return 'fr';
      }
      if (lowerLang.startsWith('en')) {
        return 'en';
      }
    }
  }

  // Fall back to navigator.language
  const browserLang = navigator.language || 'en';
  if (browserLang.toLowerCase().startsWith('fr')) {
    return 'fr';
  }

  return 'en';
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
