import { Bell, Search } from "lucide-react-native";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/colors";
import { colorKit } from "reanimated-color-picker";
import { Image } from "expo-image";
import ProductCard from "@/components/product-card";
import { TOP_TABS_HEIGHT, TopTabs } from "@/components/top-tab";
import {
  SPOTLIGHT_HEADER_HEIGHT,
  SpotlightHeader,
} from "@/components/home/spotlight-header";
import { useNavigation, useScrollToTop } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useProducts } from "@/services/products.service";
import { ProductData } from "@/mock/products";
import { SpotlightPicks } from "@/mock/spotlight";
import { thumbnailUrl } from "@/lib/image";

type Product = (typeof ProductData)[number];

// Cards are ~180pt wide: 400px covers 2x density without decoding full photos
const CARD_IMAGE_WIDTH = 400;

const CATEGORIES = ["All", "Designers", "Electronics"] as const;
type Category = (typeof CATEGORIES)[number];

// Designers and Electronics have no data source yet: they show the empty
// state until categories exist in the backend (phase 1).
const NO_PRODUCTS: Product[] = [];

// One list for the whole screen (no pager, no per-tab lists to keep in sync):
// the cheapest setup for low-end Android.
const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList,
) as unknown as typeof FlashList<Product>;

const FixedHeader = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeHeader, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Image
          source={require("assets/splash-icon-light.png")}
          style={styles.logo}
        />

        <View style={styles.iconRow}>
          {/* TODO: open search and notifications once those screens exist */}
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Search size={22} color={colors.primary} strokeWidth={1.5} />
          </Pressable>
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Bell size={22} color={colors.primary} strokeWidth={1.5} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const keyExtractor = (item: Product) => item.id.toString();

const EmptyState = () => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>Nothing here yet</Text>
  </View>
);

export default function HomeScreen() {
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const listRef = useRef<FlashListRef<Product>>(null);
  useScrollToTop(listRef);

  // One subscription for the whole screen; cells only receive primitives
  const { data: products = NO_PRODUCTS } = useProducts();

  const [category, setCategory] = useState<Category>("All");
  const tabIndex = useSharedValue(0);
  const scrollY = useSharedValue(0);

  const data = category === "All" ? products : NO_PRODUCTS;

  // TODO: pass the product id once ProductDetails reads it (phase 3)
  const openProduct = useCallback(
    (_id: string) => navigation.navigate("ProductDetails"),
    [navigation],
  );

  const selectCategory = useCallback(
    (name: string) => {
      const index = CATEGORIES.indexOf(name as Category);
      if (index === -1) return;
      tabIndex.set(withTiming(index, { duration: 250 }));
      setCategory(name as Category);
    },
    [tabIndex],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // The tab bar rides up with the header, then sticks under the logo.
  // Transform only: no layout pass while scrolling.
  const pinnedTabsStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: Math.max(0, SPOTLIGHT_HEADER_HEIGHT - scrollY.get()),
      },
    ],
  }));

  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard
        id={item.id.toString()}
        name={item.product.name}
        price={item.product.price}
        imageUri={thumbnailUrl(item.product.image, CARD_IMAGE_WIDTH)}
        sellerName={item.user.name}
        likeCount={item.like.number}
        liked={item.like.liked}
        onPress={openProduct}
      />
    ),
    [openProduct],
  );

  // Stable element: switching category must not remount the spotlight
  // (it would lose the current pick and restart its timer)
  const listHeader = useMemo(
    () => (
      <View>
        <SpotlightHeader picks={SpotlightPicks} onPressPick={openProduct} />
        {/* Room for the pinned tab bar drawn above the list */}
        <View style={styles.tabsSpacer} />
      </View>
    ),
    [openProduct],
  );

  return (
    <View style={styles.screen}>
      <FixedHeader />

      <View style={styles.body}>
        <AnimatedFlashList
          ref={listRef}
          data={data}
          numColumns={2}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={EmptyState}
          contentContainerStyle={{
            paddingHorizontal: 6,
            paddingBottom: tabBarHeight + 16,
          }}
        />

        <Animated.View style={[styles.pinnedTabs, pinnedTabsStyle]}>
          <TopTabs
            tabNames={CATEGORIES}
            indexDecimal={tabIndex}
            onTabPress={selectCategory}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    overflow: "hidden",
  },
  safeHeader: {
    backgroundColor: colors.background,
    zIndex: 50,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.8,
    borderBottomColor: colorKit.setAlpha("#3C5627", 0.07).hex(),
  },
  logo: {
    width: 70,
    aspectRatio: 16 / 9,
    marginBottom: -7,
    marginTop: -5,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  tabsSpacer: {
    height: TOP_TABS_HEIGHT + 6,
  },
  pinnedTabs: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: colorKit.setAlpha("#1e1e1e", 0.07).hex(),
  },
  empty: {
    paddingTop: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
