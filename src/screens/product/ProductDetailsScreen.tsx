import React, { useCallback, useState } from "react";
import {
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
import { Image } from "expo-image";
import { createURL } from "expo-linking";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  MapPin,
  MessageCircle,
  Share,
} from "lucide-react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import {
  CONDITION_LABELS,
  type Product,
  useLikedIds,
  useProduct,
  useToggleLike,
} from "@/services/products.service";
import { useAuth } from "@/providers/auth-provider";
import { useNotify } from "@/components/notify";
import { Spinner } from "@/components/spinner";
import { useHaptics } from "@/hooks/use-haptics";
import { imageUrl } from "@/lib/image";
import { formatPrice, timeAgo } from "@/lib/format";

// Static navigation reads the params type from here
type Props = StaticScreenProps<{ id: string }>;

const GALLERY_HEIGHT = 452;
// The sheet slides this far over the photo
const SHEET_OVERLAP = 30;
const SCREEN_WIDTH = spacing.SCREEN_WIDTH;
// Full-width photos at 2x density
const PHOTO_WIDTH = Math.round(SCREEN_WIDTH * 2);

const NO_LIKES = new Set<string>();

export const ProductDetailsScreen = ({ route }: Props) => {
  const { id } = route.params;
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
        <Text style={styles.statusTitle}>{"Couldn't load this listing"}</Text>
        <Pressable onPress={() => refetch()} hitSlop={12}>
          <Text style={styles.statusAction}>Try again</Text>
        </Pressable>
      </StatusScreen>
    );
  }

  if (!product) {
    return (
      <StatusScreen>
        <Text style={styles.statusTitle}>
          This listing is no longer available
        </Text>
      </StatusScreen>
    );
  }

  return <ProductView product={product} />;
};

const ProductView = ({ product }: { product: Product }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { notify } = useNotify();
  const { impact } = useHaptics();

  const { data: likedIds = NO_LIKES } = useLikedIds();
  const { mutate: toggleLike } = useToggleLike();
  const liked = likedIds.has(product.id);

  const isOwnListing = session?.user.id === product.seller.id;
  const isSold = product.status === "sold";

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // Pull down: the photo stretches. Scroll up: it moves at half speed under
  // the sheet. Transform only, no layout while scrolling.
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
      message: `${product.title}, ${formatPrice(product.price)} F CFA on Dily\n${createURL(`product/${product.id}`)}`,
    });
  };

  // TODO: open the conversation once chat exists (phase 6)
  const onMessage = () =>
    notify("Chat is coming soon", {
      description: `You'll be able to message ${product.seller.name} here.`,
    });

  const avatarUri = imageUrl("avatars", product.seller.avatarPath, 96);
  const tags = [
    CONDITION_LABELS[product.condition],
    product.size && `Size ${product.size}`,
    product.categoryName,
  ].filter((tag): tag is string => !!tag);

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Animated.View style={galleryStyle}>
          <Gallery imagePaths={product.imagePaths} title={product.title} />
        </Animated.View>

        <View style={styles.sheet}>
          <View style={styles.tags}>
            {tags.map((tag, index) => (
              <View
                key={tag}
                style={[styles.tag, index === 0 && styles.tagHighlight]}
              >
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>{product.title}</Text>
            <View style={styles.meta}>
              <Heart size={14} color={colors.primary} fill={colors.primary} />
              <Text style={styles.metaText}>
                {product.likesCount}{" "}
                {product.likesCount === 1 ? "like" : "likes"} · Listed{" "}
                {timeAgo(product.createdAt)}
              </Text>
            </View>
          </View>

          {/* TODO: open the seller's profile once it exists (phase 5) */}
          <View style={styles.sellerCard}>
            {avatarUri ? (
              <Image
                source={avatarUri}
                style={styles.avatar}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {product.seller.name.charAt(0)}
                </Text>
              </View>
            )}
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{product.seller.name}</Text>
              <View style={styles.sellerLocation}>
                <MapPin size={12} color="#5A5A52" strokeWidth={2} />
                <Text style={styles.sellerSub} numberOfLines={1}>
                  {isOwnListing
                    ? `Your listing · ${product.seller.location}`
                    : product.seller.location}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.primary} strokeWidth={2} />
          </View>

          {product.description ? (
            <Text style={styles.description}>{product.description}</Text>
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
        <RoundButton label="Back" onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.primary} strokeWidth={1.8} />
        </RoundButton>
        <View style={styles.flex} />
        <RoundButton label="Share" onPress={onShare}>
          <Share size={20} color={colors.primary} strokeWidth={1.8} />
        </RoundButton>
        <RoundButton
          label={liked ? "Unlike" : "Like"}
          selected={liked}
          onPress={onToggleLike}
        >
          <Heart
            size={20}
            color={colors.primary}
            fill={liked ? colors.primary : "transparent"}
            strokeWidth={1.8}
          />
        </RoundButton>
      </View>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View>
          <Text style={styles.priceLabel}>PRICE</Text>
          <Text style={styles.price}>
            {formatPrice(product.price)}{" "}
            <Text style={styles.priceCurrency}>F CFA</Text>
          </Text>
        </View>
        <View style={styles.flex} />
        {isOwnListing ? null : (
          <Pressable
            onPress={onMessage}
            disabled={isSold}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.messageButton,
              isSold && styles.messageButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {isSold ? null : (
              <MessageCircle size={18} color={colors.white} strokeWidth={2} />
            )}
            <Text style={styles.messageText} numberOfLines={1}>
              {isSold ? "Sold" : `Message ${product.seller.name.split(" ")[0]}`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const Gallery = ({
  imagePaths,
  title,
}: {
  imagePaths: string[];
  title: string;
}) => {
  const [index, setIndex] = useState(0);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      setIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)),
    [],
  );

  const renderItem = useCallback(
    ({ item, index: i }: { item: string; index: number }) => (
      <Image
        source={imageUrl("product-images", item, PHOTO_WIDTH)}
        accessibilityLabel={`${title}, photo ${i + 1}`}
        recyclingKey={item}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={200}
        style={styles.photo}
      />
    ),
    [title],
  );

  if (imagePaths.length === 0) {
    return <View style={[styles.photo, styles.photoPlaceholder]} />;
  }

  return (
    <View style={styles.gallery}>
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

      {imagePaths.length > 1 ? (
        <View style={styles.galleryFooter} pointerEvents="none">
          <View style={styles.dots}>
            {imagePaths.map((path, i) => (
              <View
                key={path}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {index + 1} / {imagePaths.length}
            </Text>
          </View>
        </View>
      ) : null}
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

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <RoundButton label="Back" onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color={colors.primary} strokeWidth={1.8} />
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
    backgroundColor: "#EAE7DC",
  },
  photoPlaceholder: {
    height: GALLERY_HEIGHT,
  },
  galleryFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: SHEET_OVERLAP + 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(247, 245, 237, 0.55)",
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.background,
  },
  counter: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(30, 30, 30, 0.55)",
  },
  counterText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
    fontVariant: ["tabular-nums"],
  },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    paddingTop: 22,
    paddingHorizontal: 20,
    gap: 14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.background,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  tagHighlight: {
    backgroundColor: "#DFE3D2",
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2F4420",
  },
  titleBlock: {
    gap: 6,
  },
  title: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.black,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: "#5A5A52",
  },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DFE3D2",
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primary,
  },
  sellerInfo: {
    flex: 1,
    gap: 2,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  sellerLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sellerSub: {
    flexShrink: 1,
    fontSize: 12,
    color: "#5A5A52",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3A3A35",
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
    borderBottomColor: "rgba(60, 86, 39, 0.12)",
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2DED2",
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "#5A5A52",
  },
  price: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.black,
    fontVariant: ["tabular-nums"],
  },
  priceCurrency: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5A5A52",
  },
  messageButton: {
    height: 52,
    maxWidth: 220,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
  },
  messageButtonDisabled: {
    backgroundColor: "#8A877C",
  },
  messageText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
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
