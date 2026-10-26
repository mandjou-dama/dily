import {
  type Conversation,
  type Fulfilment,
  LANDMARK_MAX_LENGTH,
  DELIVERY_AREA_MAX_LENGTH,
} from "@dily/shared";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  StackActions,
  type StaticScreenProps,
  useNavigation,
} from "@react-navigation/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { MapPin, Phone, Truck } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ActionButton } from "@/components/action-button";
import { BottomBar, STICKY_BAR_ROOM } from "@/components/checkout/bottom-bar";
import {
  Card,
  CardDivider,
  InfoRow,
  SectionTitle,
  SmallButton,
} from "@/components/checkout/card";
import {
  CheckoutHeader,
  CheckoutLoading,
} from "@/components/checkout/checkout-header";
import { ProductSummary } from "@/components/checkout/product-summary";
import { type Segment, SegmentedControl } from "@/components/segmented-control";
import { areaOf, unpaidOrderOf } from "@/lib/checkout";
import { formatPhone } from "@/lib/format";
import { amountLabel, firstName } from "@/lib/offers";
import { useAuth } from "@/providers/auth-provider";
import { useConversation } from "@/services/chat.service";
import { colors } from "@/theme/colors";

// Static navigation reads the params type from here
type Props = StaticScreenProps<{ conversationId: string }>;

const ICON = 20;

/** Step 1 of paying: pickup or delivery, and where. */
export const CheckoutScreen = ({ route }: Props) => {
  const { conversationId } = route.params;
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { data: conversation } = useConversation(conversationId);

  if (!conversation) {
    return (
      <CheckoutLoading
        title={t("checkout.pickupTitle")}
        subtitle={t("checkout.step", { current: 1, total: 2 })}
        onBack={navigation.goBack}
      />
    );
  }
  return <PickupStep conversation={conversation} />;
};

const PickupStep = ({ conversation }: { conversation: Conversation }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { product, otherUser } = conversation;
  const sellerName = firstName(otherUser.name);
  const sellerArea = areaOf(otherUser.location);
  const canDeliver = product.deliveryFee !== null;

  // An accepted offer fixed the way of getting the item; a direct buy not
  // paid yet only suggests it
  const unpaid = unpaidOrderOf(conversation);
  const agreed = unpaid?.offerId ? unpaid : null;
  const [chosen, setChosen] = useState<Fulfilment>(
    () => unpaid?.fulfilment ?? (canDeliver ? "delivery" : "pickup"),
  );
  const fulfilment = agreed?.fulfilment ?? chosen;
  const delivery = fulfilment === "delivery";

  const [typedArea, setTypedArea] = useState(
    () => unpaid?.deliveryArea ?? profile?.neighbourhood ?? "",
  );
  const area = agreed?.deliveryArea ?? typedArea;
  // The neighbourhood is typed in place: right away when there's none yet
  const [editingArea, setEditingArea] = useState(!area);
  const [focusArea, setFocusArea] = useState(false);
  const [landmark, setLandmark] = useState(unpaid?.landmark ?? "");
  const canContinue = !delivery || area.trim().length > 0;

  const onChangeAgreed = () =>
    Alert.alert(
      t("checkout.changeAgreedTitle"),
      t("checkout.changeAgreedBody", { name: sellerName }),
      [
        { text: t("checkout.keep"), style: "cancel" },
        {
          text: t("checkout.makeOffer"),
          // Back to the chat, where the offer sheet opens
          onPress: () =>
            navigation.dispatch(
              StackActions.popTo("Conversation", {
                id: conversation.id,
                makeOffer: true,
              }),
            ),
        },
      ],
    );

  const onContinue = () => {
    if (!canContinue) return;
    navigation.navigate("CheckoutPay", {
      conversationId: conversation.id,
      fulfilment,
      deliveryArea: delivery ? area.trim() : null,
      landmark: delivery ? landmark.trim() || null : null,
    });
  };

  const segments: Segment<Fulfilment>[] = [
    {
      value: "pickup",
      title: t("checkout.pickup"),
      subtitle: sellerArea,
      leading: (selected) => (
        <MapPin
          size={ICON}
          color={selected ? colors.primary : colors.muted}
          strokeWidth={1.8}
        />
      ),
    },
    {
      value: "delivery",
      title: t("checkout.delivery"),
      subtitle: t("checkout.deliveryFee", {
        fee: amountLabel(product.deliveryFee ?? 0),
      }),
      leading: (selected) => (
        <Truck
          size={ICON}
          color={selected ? colors.primary : colors.muted}
          strokeWidth={1.8}
        />
      ),
    },
  ];

  let mode;
  if (agreed) {
    mode = (
      <View style={styles.locked}>
        {delivery ? (
          <Truck size={22} color={colors.primary} strokeWidth={1.8} />
        ) : (
          <MapPin size={22} color={colors.primary} strokeWidth={1.8} />
        )}
        <View style={styles.flex}>
          <Text style={styles.lockedTitle}>
            {delivery
              ? t("checkout.deliveredTo", { area })
              : t("checkout.pickupAt", { area: sellerArea })}
          </Text>
          <Text style={styles.lockedDetail}>
            {t("checkout.agreedWith", { name: sellerName })}
          </Text>
        </View>
        <Pressable
          onPress={onChangeAgreed}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.textButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.textButtonLabel}>{t("checkout.change")}</Text>
        </Pressable>
      </View>
    );
  } else if (product.pickup && canDeliver) {
    mode = (
      <SegmentedControl
        segments={segments}
        value={fulfilment}
        onChange={setChosen}
        accessibilityLabel={t("checkout.howTitle")}
        surface="background"
      />
    );
  } else {
    // One way only: said, not chosen
    const only = segments.find((segment) => segment.value === fulfilment);
    mode = only ? (
      <Card>
        <InfoRow
          icon={only.leading?.(true)}
          value={only.title}
          detail={only.subtitle}
        />
      </Card>
    ) : null;
  }

  return (
    <View style={styles.screen}>
      <CheckoutHeader
        title={t("checkout.pickupTitle")}
        subtitle={t("checkout.step", { current: 1, total: 2 })}
        onBack={navigation.goBack}
      />
      <KeyboardAwareScrollView
        bottomOffset={STICKY_BAR_ROOM}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card>
          <ProductSummary product={product} agreed={agreed} />
        </Card>

        <View style={styles.section}>
          <SectionTitle>{t("checkout.howTitle")}</SectionTitle>
          {mode}
        </View>

        {delivery ? (
          <View style={styles.section}>
            <SectionTitle>{t("checkout.whereDeliver")}</SectionTitle>
            <Card>
              <InfoRow
                icon={
                  <MapPin
                    size={ICON}
                    color={colors.primary}
                    strokeWidth={1.8}
                  />
                }
                label={t("checkout.neighbourhood")}
                value={
                  editingArea && !agreed ? (
                    <TextInput
                      value={typedArea}
                      onChangeText={setTypedArea}
                      onBlur={() => setEditingArea(!typedArea.trim())}
                      autoFocus={focusArea}
                      placeholder={t("checkout.neighbourhoodPlaceholder")}
                      placeholderTextColor={colors.muted}
                      maxLength={DELIVERY_AREA_MAX_LENGTH}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      accessibilityLabel={t("checkout.neighbourhood")}
                      style={styles.inlineInput}
                    />
                  ) : (
                    area
                  )
                }
                trailing={
                  agreed || editingArea ? null : (
                    <SmallButton
                      label={t("checkout.change")}
                      onPress={() => {
                        setFocusArea(true);
                        setEditingArea(true);
                      }}
                    />
                  )
                }
              />
              <CardDivider />
              <View style={styles.landmark}>
                <Text style={styles.label}>{t("checkout.landmark")}</Text>
                <TextInput
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholder={t("checkout.landmarkPlaceholder")}
                  placeholderTextColor={colors.muted}
                  maxLength={LANDMARK_MAX_LENGTH}
                  returnKeyType="done"
                  accessibilityLabel={t("checkout.landmark")}
                  style={styles.input}
                />
              </View>
              <CardDivider />
              <InfoRow
                icon={
                  <Phone size={ICON} color={colors.primary} strokeWidth={1.8} />
                }
                label={t("checkout.courierCalls")}
                value={profile ? formatPhone(profile.phone) : ""}
                numeric
              />
            </Card>
          </View>
        ) : (
          <View style={styles.section}>
            <SectionTitle>
              {t("checkout.whereMeet", { name: sellerName })}
            </SectionTitle>
            <Card>
              <InfoRow
                icon={
                  <MapPin
                    size={ICON}
                    color={colors.primary}
                    strokeWidth={1.8}
                  />
                }
                value={otherUser.location}
                detail={t("checkout.meetHint")}
              />
            </Card>
          </View>
        )}
      </KeyboardAwareScrollView>

      <BottomBar sticky>
        <ActionButton
          label={t("checkout.continue")}
          onPress={onContinue}
          disabled={!canContinue}
          size="large"
        />
      </BottomBar>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  section: {
    gap: 10,
  },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  lockedTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  lockedDetail: {
    fontSize: 13,
    color: colors.muted,
  },
  textButton: {
    height: 44,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  textButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  pressed: {
    opacity: 0.6,
  },
  inlineInput: {
    padding: 0,
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  landmark: {
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderCurve: "continuous",
    fontSize: 16,
    color: colors.black,
    backgroundColor: colors.background,
  },
});
