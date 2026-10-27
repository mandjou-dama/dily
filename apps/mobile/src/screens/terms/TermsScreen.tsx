import { HANDOVER_DAYS } from "@dily/shared";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { BottomBar } from "@/components/checkout/bottom-bar";
import {
  Card,
  InfoRow,
  SectionTitle,
  SmallButton,
} from "@/components/checkout/card";
import { CheckoutHeader } from "@/components/checkout/checkout-header";
import { useNotify } from "@/components/notify";
import { useHaptics } from "@/hooks/use-haptics";
import { dealErrorMessage } from "@/lib/offers";
import { openSupportChat, supportWhatsappLabel } from "@/lib/support";
import { useAcceptTerms, useSignOut } from "@/services/auth.service";
import { colors } from "@/theme/colors";

const SECTIONS = ["account", "abuse", "report", "pay", "changes"] as const;

/**
 * The terms of use (App Store guideline 1.2: no tolerance for abuse) and
 * Dily's contact, shared by the acceptance screen and the profile's link.
 */
function TermsBody() {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.version}>{t("terms.version")}</Text>
        <Text style={styles.paragraph}>{t("terms.intro")}</Text>
      </View>
      {SECTIONS.map((key) => (
        <View key={key} style={styles.section}>
          <SectionTitle>{t(`terms.${key}Title`)}</SectionTitle>
          <Text style={styles.paragraph}>
            {t(`terms.${key}Body`, { days: HANDOVER_DAYS })}
          </Text>
        </View>
      ))}
      <View style={styles.section}>
        <SectionTitle>{t("terms.contactTitle")}</SectionTitle>
        <Text style={styles.paragraph}>{t("terms.contactBody")}</Text>
        <Card>
          <InfoRow
            icon={
              <MessageCircle
                size={20}
                color={colors.primary}
                strokeWidth={1.8}
              />
            }
            label={t("support.whatsapp")}
            value={supportWhatsappLabel}
            numeric
            trailing={
              <SmallButton
                label={t("support.write")}
                onPress={openSupportChat}
              />
            }
          />
        </Card>
      </View>
    </>
  );
}

/**
 * After signing in, until the terms in force are accepted: new accounts,
 * existing ones, and everyone again when the terms change.
 */
export function AcceptTermsScreen() {
  const { t } = useTranslation();
  const { notify } = useNotify();
  const { notification } = useHaptics();
  const accept = useAcceptTerms();
  const signOut = useSignOut();

  // Accepted: the root navigator moves on to the profile or the app
  const onAccept = () =>
    accept.mutate(undefined, {
      onSuccess: () => notification("success"),
      onError: (error) =>
        notify(t("terms.notAccepted"), {
          description: dealErrorMessage(error),
        }),
    });

  return (
    <View style={styles.screen}>
      <CheckoutHeader title={t("terms.title")} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <TermsBody />
      </ScrollView>
      <BottomBar>
        <ActionButton
          label={t("terms.accept")}
          onPress={onAccept}
          isLoading={accept.isPending}
          size="large"
        />
        <Pressable
          onPress={() => signOut.mutate()}
          disabled={signOut.isPending || accept.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.textButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.textButtonLabel}>{t("terms.signOut")}</Text>
        </Pressable>
      </BottomBar>
    </View>
  );
}

/** The same terms, to read again from the profile. */
export function TermsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={styles.screen}>
      <CheckoutHeader title={t("terms.title")} onBack={navigation.goBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <TermsBody />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  section: {
    gap: 8,
  },
  version: {
    fontSize: 13,
    color: colors.muted,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.outlineText,
  },
  textButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  textButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  pressed: {
    opacity: 0.6,
  },
});
