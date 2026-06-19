import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import idTranslation from './locales/id/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation
      },
      id: {
        translation: idTranslation
      }
    },
    lng: 'id', // Default language
    fallbackLng: 'id',
    interpolation: {
      escapeValue: false // React already safes from xss
    }
  });

export default i18n;
