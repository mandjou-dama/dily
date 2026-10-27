import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Share as NativeShare,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  type StaticScreenProps,
  useNavigation,
} from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { createURL } from "expo-linking";
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Heart,
  KeyRound,
  MapPin,
  MoreHorizontal,
  RotateCcw,
  Share,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { HANDOVER_DAYS } from "@dily/shared";
import i18n from "@/i18n";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { fonts } from "@/theme/typography";
import {
  type Product,
  useLikedIds,
  useProduct,
  useToggleLike,
} from "@/services/products.service";
import { useDeleteListing, useSetListingSold } from "@/services/sell.service";
import { useOpenConversation } from "@/services/chat.service";
import { useAuth } from "@/providers/auth-provider";
import { ActionButton } from "@/components/action-button";
import {
  Card,
  CardDivider,
  InfoRow,
  SectionTitle,
} from "@/components/checkout/card";
import {
  ModerationReportSheet,
  type ModerationReportSheetRef,
} from "@/components/moderation/report-sheet";
import { useNotify } from "@/components/notify";
import { Spinner } from "@/components/spinner";
import { useBlockUser } from "@/hooks/use-block-user";
import { useHaptics } from "@/hooks/use-haptics";
import { showActionMenu } from "@/lib/action-menu";
import { imageUrl } from "@/lib/image";
import { amountLabel, dealErrorMessage, firstName } from "@/lib/offers";

// Static navigation reads the params type from here
type Props = StaticScreenProps<{ id: string }>;

const GALLERY_HEIGHT = 330;
const SCREEN_WIDTH = spacing.SCREEN_WIDTH;
// Full-width photos at 2x density
const PHOTO_WIDTH = Math.round(SCREEN_WIDTH * 2);
// Icons in the cards, as in the payment steps
const ICON = 20;
const MESSAGE_BUTTON_WIDTH = 210;

const NO_LIKES = new Set<string>();

/** "il y a 3 h", then the date past a month. */
function agoLabel(isoDate: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(isoDate).getTime()) / 60000);
  if (minutes < 1) return i18n.t("product.justNow");
  if (minutes < 60) return i18n.t("product.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("product.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return i18n.t("product.daysAgo", { count: days });
  return i18n.t("product.on", {
    date: new Date(isoDate).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
    }),
  });
}

export const ProductDetailsScreen = ({ route }: Props) => {
  const { id } = route.params;
  const { t } = useTranslation();
  const { data: product, isPending, isError, refetch } = useProduct(id);

  if (isPending) {
    return (
      <StatusScreen>
        <Spinner color={colors.primary} size={28} />
      </StatusScreen>
    );
  }

  if (isError) {
    return (
      <StatusScreen>
        <Text style={styles.statusTitle}>{t("product.loadError")}</Text>
        <Pressable onPress={() => refetch()} hitSlop={12}>
          <Text style={styles.statusAction}>{t("common.retry")}</Text>
        </Pressable>
      </StatusScreen>
    );
  }

  if (!product) {
    return (
      <StatusScreen>
        <Text style={styles.statusTitle}>{t("product.gone")}</Text>
      </StatusScreen>
    );
  }

  return <ProductView product={product} />;
};

/**
 * A listing (design « A · Cartes »): the photos, the serif title with who
 * sells it and its chips, what Dily guarantees, how to get it and the
 * description, then the price and the screen's button at the bottom.
 */
const ProductView = ({ product }: { product: Product }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { notify } = useNotify();
  const { impact, notification } = useHaptics();
  const setSold = useSetListingSold();
  const deleteListing = useDeleteListing();
  const openConversation = useOpenConversation();
  const { confirmBlock } = useBlockUser();
  const reportSheet = useRef<ModerationReportSheetRef>(null);

  const { data: likedIds = NO_LIKES } = useLikedIds();
  const { mutate: toggleLike } = useToggleLike();
  const liked = likedIds.has(product.id);

  const isOwnListing = session?.user.id === product.seller.id;
  const isSold = product.status === "sold";
  // Removed by Dily: only its seller gets here
  const isRemoved = product.status === "archived";
  const sellerName = firstName(product.seller.name);
  // "Hamdallaye ACI, Bamako": the neighbourhood is enough under the title
  const area = product.seller.location.split(",")[0] ?? "";

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // Pull down: the photo stretches. Scroll up: it moves at half speed under
  // the content. Transform only, no layout while scrolling.
  const galleryStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    if (y < 0) {
      return {
        transform: [{ translateY: y / 2 }, { scale: 1 + -y / GALLERY_HEIGHT }],
      };
    }
    return { transform: [{ translateY: y / 2 }] };
  });

  // Once the photo is gone the buttons need a bar behind them
  const topBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [GALLERY_HEIGHT - 160, GALLERY_HEIGHT - 80],
      [0, 1],
      "clamp",
    ),
  }));

  const onToggleLike = () => {
    impact("light");
    toggleLike({ productId: product.id, currentlyLiked: liked });
  };

  const onShare = () => {
    NativeShare.share({
      message: t("product.shareMessage", {
        title: product.title,
        price: amountLabel(product.price),
        url: createURL(`product/${product.id}`),
      }),
    });
  };

  const onMessage = () =>
    openConversation.mutate(product.id, {
      onSuccess: (conversation) =>
        navigation.navigate("Conversation", { id: conversation.id }),
      onError: (error) =>
        notify(t("product.chatError"), {
          description: dealErrorMessage(error),
        }),
    });

  const onEdit = () => navigation.navigate("EditProduct", { id: product.id });

  const onToggleSold = () => {
    impact("light");
    setSold.mutate(
      { id: product.id, sold: !isSold },
      {
        onError: (error) =>
          notify(t("product.notUpdated"), {
            description: dealErrorMessage(error),
          }),
      },
    );
  };

  const confirmDelete = () =>
    Alert.alert(t("product.deleteTitle"), t("product.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("product.deleteConfirm"),
        style: "destructive",
        onPress: () =>
          deleteListing.mutate(
            { id: product.id },
            {
              onSuccess: () => {
                notification("success");
                navigation.goBack();
              },
              onError: (error) =>
                notify(t("product.notDeleted"), {
                  description: dealErrorMessage(error),
                }),
            },
          ),
      },
    ]);

  const onMore = () =>
    showActionMenu(
      t("moderation.more"),
      isOwnListing
        ? [
            {
              label: t("product.delete"),
              destructive: true,
              onPress: confirmDelete,
            },
          ]
        : [
            {
              label: t("moderation.reportListing"),
              onPress: () => reportSheet.current?.open(),
            },
            {
              label: t("moderation.block", { name: sellerName }),
              destructive: true,
              onPress: () =>
                confirmBlock(
                  { id: product.seller.id, name: sellerName },
                  navigation.goBack,
                ),
            },
          ],
      t("common.cancel"),
    );

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={galleryStyle}>
          <Gallery
            imagePaths={product.imagePaths}
            title={product.title}
            meta={t("product.photoMeta", {
              likes: product.likesCount,
              ago: agoLabel(product.createdAt),
            })}
          />
        </Animated.View>

        <View style={styles.content}>
          {isRemoved ? (
            // Same warning block as the chat and the payment steps
            <View style={styles.removed}>
              <CircleAlert
                size={18}
                color={colors.warningText}
                strokeWidth={2}
                style={styles.removedIcon}
              />
              <View style={styles.flex}>
                <Text style={styles.removedTitle}>
                  {t("moderation.removed")}
                </Text>
                <Text style={styles.removedText}>
                  {t("moderation.removedHint")}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.summary}>
            <Text style={styles.title}>{product.title}</Text>
            <Text style={styles.byLine}>
              {isOwnListing
                ? t("product.yourListing", { area })
                : t("product.byLine", { name: product.seller.name, area })}
            </Text>
            <View style={styles.chips}>
              {isSold ? (
                <View style={[styles.chip, styles.chipSold]}>
                  <Text style={[styles.chipText, styles.chipSoldText]}>
                    {t("product.sold")}
                  </Text>
                </View>
              ) : null}
              <View style={styles.chip}>
                <BadgeCheck size={16} color={colors.black} strokeWidth={1.8} />
                <Text style={styles.chipText}>
                  {t(`product.condition_${product.condition}`)}
                </Text>
              </View>
              {product.size ? (
                <View style={styles.chip}>
                  <Tag size={16} color={colors.black} strokeWidth={1.8} />
                  <Text style={styles.chipText}>
                    {t("product.size", { size: product.size })}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.trust}>
            <TrustItem
              icon={
                <ShieldCheck
                  size={24}
                  color={colors.primary}
                  strokeWidth={1.8}
                />
              }
              title={t("product.trustPaid")}
              detail={t("product.trustPaidDetail")}
            />
            <TrustItem
              icon={
                <KeyRound size={24} color={colors.primary} strokeWidth={1.8} />
              }
              title={t("product.trustCode")}
              detail={t("product.trustCodeDetail")}
              middle
            />
            <TrustItem
              icon={
                <RotateCcw size={24} color={colors.primary} strokeWidth={1.8} />
              }
              title={t("product.trustRefund")}
              detail={t("product.trustRefundDetail", { count: HANDOVER_DAYS })}
            />
          </View>

          <View style={styles.section}>
            <SectionTitle>{t("product.howTitle")}</SectionTitle>
            <Card>
              {product.pickup ? (
                <InfoRow
                  icon={
                    <MapPin
                      size={ICON}
                      color={colors.primary}
                      strokeWidth={1.8}
                    />
                  }
                  value={t("checkout.pickup")}
                  detail={product.seller.location}
                />
              ) : null}
              {product.pickup && product.deliveryFee !== null ? (
                <CardDivider />
              ) : null}
              {product.deliveryFee !== null ? (
                <InfoRow
                  icon={
                    <Truck
                      size={ICON}
                      color={colors.primary}
                      strokeWidth={1.8}
                    />
                  }
                  value={t("checkout.delivery")}
                  detail={
                    isOwnListing
                      ? t("product.deliveryByYou", {
                          fee: t("checkout.deliveryFee", {
                            fee: amountLabel(product.deliveryFee),
                          }),
                        })
                      : t("product.deliveryBySeller", {
                          fee: t("checkout.deliveryFee", {
                            fee: amountLabel(product.deliveryFee),
                          }),
                          name: sellerName,
                        })
                  }
                />
              ) : null}
            </Card>
          </View>

          {product.description ? (
            <View style={styles.section}>
              <SectionTitle>{t("product.description")}</SectionTitle>
              <Card style={styles.descriptionCard}>
                <Text style={styles.description}>{product.description}</Text>
              </Card>
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.topBarBackground,
            topBarStyle,
          ]}
        />
        <RoundButton
          label={t("product.back")}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color={colors.black} strokeWidth={1.8} />
        </RoundButton>
        <View style={styles.flex} />
        {isOwnListing ? null : (
          <RoundButton
            label={liked ? t("product.unlike") : t("product.like")}
            selected={liked}
            onPress={onToggleLike}
          >
            <Heart
              size={20}
              color={colors.black}
              fill={liked ? colors.black : "transparent"}
              strokeWidth={1.8}
            />
          </RoundButton>
        )}
        <RoundButton label={t("product.share")} onPress={onShare}>
          <Share size={20} color={colors.black} strokeWidth={1.8} />
        </RoundButton>
        <RoundButton label={t("moderation.more")} onPress={onMore}>
          <MoreHorizontal size={22} color={colors.black} strokeWidth={1.8} />
        </RoundButton>
      </View>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Text
          style={styles.price}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {amountLabel(product.price)}
        </Text>
        {isOwnListing ? (
          <>
            <ActionButton
              label={t("product.edit")}
              variant="outline"
              onPress={onEdit}
              size="large"
              style={styles.ownerButton}
            />
            {isRemoved ? null : (
              <ActionButton
                label={isSold ? t("product.relist") : t("product.markSold")}
                onPress={onToggleSold}
                isLoading={setSold.isPending}
                size="large"
                style={styles.ownerButton}
                accessibilityHint={
                  isSold ? t("product.relistHint") : t("product.markSoldHint")
                }
              />
            )}
          </>
        ) : (
          <ActionButton
            label={
              isSold
                ? t("product.sold")
                : t("product.message", { name: sellerName })
            }
            onPress={onMessage}
            disabled={isSold}
            isLoading={openConversation.isPending}
            size="large"
            style={styles.messageButton}
          />
        )}
      </View>

      {isOwnListing ? null : (
        <ModerationReportSheet
          ref={reportSheet}
          target={{ kind: "listing", productId: product.id }}
          name={sellerName}
        />
      )}
    </View>
  );
};

/** One of Dily's guarantees: an icon, then two short lines. */
const TrustItem = ({
  icon,
  title,
  detail,
  middle = false,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  /** Hairlines on both sides. */
  middle?: boolean;
}) => (
  <View style={[styles.trustItem, middle && styles.trustItemMiddle]}>
    {icon}
    <Text style={styles.trustText}>
      <Text style={styles.trustTitle}>{title}</Text>
      {"\n"}
      <Text style={styles.trustDetail}>{detail}</Text>
    </Text>
  </View>
);

const Gallery = ({
  imagePaths,
  title,
  meta,
}: {
  imagePaths: string[];
  title: string;
  /** "12 · il y a 2 j": likes and age, on the photo. */
  meta: string;
}) => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      setIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)),
    [],
  );

  const renderItem = useCallback(
    ({ item, index: i }: { item: string; index: number }) => (
      <Image
        source={imageUrl(item, PHOTO_WIDTH)}
        accessibilityLabel={t("product.photo", { title, index: i + 1 })}
        recyclingKey={item}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={200}
        style={styles.photo}
      />
    ),
    [title, t],
  );

  return (
    <View style={styles.gallery}>
      {imagePaths.length > 0 ? (
        <FlatList
          data={imagePaths}
          keyExtractor={(path) => path}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, i) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * i,
            index: i,
          })}
        />
      ) : (
        <View style={styles.photo} />
      )}

      <View style={styles.galleryFooter} pointerEvents="none">
        {/* On the same dark pill as the likes: readable on a light photo */}
        {imagePaths.length > 1 ? (
          <View style={[styles.pill, styles.dots]}>
            {imagePaths.map((path, i) => (
              <View
                key={path}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
        ) : (
          <View />
        )}
        <View style={[styles.pill, styles.meta]}>
          <Heart size={11} color={colors.white} fill={colors.white} />
          <Text style={styles.metaText}>{meta}</Text>
        </View>
      </View>
    </View>
  );
};

const RoundButton = ({
  label,
  selected,
  onPress,
  children,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={selected === undefined ? undefined : { selected }}
    style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
  >
    {children}
  </Pressable>
);

const StatusScreen = ({ children }: { children: React.ReactNode }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <RoundButton
          label={t("product.back")}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={22} color={colors.black} strokeWidth={1.8} />
        </RoundButton>
      </View>
      <View style={styles.status}>{children}</View>
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
  pressed: {
    opacity: 0.7,
  },
  gallery: {
    height: GALLERY_HEIGHT,
  },
  photo: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
    backgroundColor: colors.trackOnBackground,
  },
  galleryFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pill: {
    height: 26,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "rgba(30, 30, 30, 0.4)",
  },
  dots: {
    gap: 5,
    paddingHorizontal: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.white,
  },
  meta: {
    gap: 5,
    paddingHorizontal: 10,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  // Covers the photo as it slides up at half speed
  content: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: colors.background,
  },
  removed: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: colors.warning,
  },
  removedIcon: {
    marginTop: 1,
  },
  removedTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.warningText,
  },
  removedText: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    color: colors.warningText,
  },
  summary: {
    paddingTop: 6,
    paddingHorizontal: 4,
    paddingBottom: 4,
    gap: 10,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.4,
    color: colors.black,
  },
  byLine: {
    fontSize: 16,
    color: colors.outlineText,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.trackOnBackground,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.black,
  },
  chipSold: {
    backgroundColor: colors.black,
  },
  chipSoldText: {
    color: colors.white,
  },
  trust: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  trustItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  trustItemMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.hairline,
  },
  trustText: {
    fontSize: 13,
    lineHeight: 17,
    textAlign: "center",
  },
  trustTitle: {
    fontWeight: "600",
    color: colors.black,
  },
  trustDetail: {
    color: colors.muted,
  },
  section: {
    gap: 10,
  },
  descriptionCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.outlineText,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topBarBackground: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  price: {
    flex: 1,
    marginRight: 6,
    fontSize: 22,
    fontWeight: "700",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  messageButton: {
    width: MESSAGE_BUTTON_WIDTH,
  },
  ownerButton: {
    paddingHorizontal: 16,
  },
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
    textAlign: "center",
  },
  statusAction: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
});
