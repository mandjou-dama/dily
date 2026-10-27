import { Linking } from "react-native";

import i18n from "@/i18n";
import { formatPhone } from "@/lib/format";

/** Dily's WhatsApp, the contact the App Store asks for (guideline 1.2). */
export const SUPPORT_WHATSAPP = "+22378437323";

/** "+223 78 43 73 23" */
export const supportWhatsappLabel = formatPhone(SUPPORT_WHATSAPP);

/** Opens a chat with Dily in WhatsApp (or wa.me in the browser without the app). */
export const openSupportChat = () =>
  Linking.openURL(
    `https://wa.me/${SUPPORT_WHATSAPP.slice(1)}?text=${encodeURIComponent(i18n.t("support.greeting"))}`,
  );
