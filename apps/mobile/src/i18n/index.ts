import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";

export const defaultNS = "translation";
export const resources = { fr: { translation: fr } } as const;

const i18n = createInstance();

// French only for now, screen by screen: the older screens are still in
// English until they move here
void i18n.use(initReactI18next).init({
  resources,
  lng: "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
