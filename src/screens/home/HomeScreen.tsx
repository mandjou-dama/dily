import { Bell, Search } from "lucide-react-native";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "react-native-collapsible-tab-view";
import { Marquee } from "@/components/header-marquee";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppTabParamList } from "@/types/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { colors } from "@/theme/colors";
import { colorKit } from "reanimated-color-picker";
import { Image } from "expo-image";
import ProductCard from "@/components/product-card";
import { spacing } from "@/theme/spacing";
import { setHeaderLogoLayout } from "@/components/header-logo-layout.ts";
import { TopTabs } from "@/components/top-tab";
import { useFocusEffect, useScrollToTop } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Button from "@/components/Button";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ProductData } from "@/mock/products";
import { useProducts } from "@/services/products.service";

import { useNotify } from "@/components/notify";
import { MessageType } from "@/components/notify/type";

type Props = NativeStackScreenProps<AppTabParamList, "Home">;

const FixedHeader = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeHeader, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Image
          onLayout={(e) => {
            const { x, y, width, height } = e.nativeEvent.layout;

            // setHeaderLogoLayout({
            //   x,
            //   y: y + insets.top,
            //   width,
            //   height,
            // });
          }}
          source={require("assets/splash-icon-light.png")}
          style={{
            width: 70,
            aspectRatio: 16 / 9,
            marginBottom: -7,
            marginTop: -5,
          }}
        />

        <View style={styles.iconRow}>
          <Pressable>
            <Search size={20} color={colors.primary} strokeWidth={1.5} />
          </Pressable>
          <Bell size={20} color={colors.primary} strokeWidth={1.5} />
        </View>
      </View>
    </View>
  );
};

const CollapsibleSearch = () => {
  const searchRef = useRef<any>(null);
  const [search, setSearch] = useState("");

  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        backgroundColor: colors.background,
      }}
    >
      <View style={[styles.inputContainer]}>
        <Search strokeWidth={1.5} color={colors.primary} />
        <TextInput
          ref={searchRef}
          style={styles.input}
          placeholder="Search for products"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={(value) => setSearch(value)}
          // onFocus={() => setFocusedField("fullname")}
          // onBlur={() => setFocusedField(null)}
          returnKeyType="search"
          onSubmitEditing={() => console.log("Search")}
        />
      </View>
    </View>
  );
};

const CollapsibleProduct = () => {
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        paddingTop: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          height: 220,
          width: "100%",
          borderRadius: 22,
          borderCurve: "continuous",
          overflow: "hidden",
        }}
      >
        <Image
          source={require("assets/banner_3.png")}
          style={{ height: "100%", width: "100%", position: "absolute" }}
          transition={1000}
          onLayout={(e) => {
            const { x, y, width, height } = e.nativeEvent.layout;
          }}
        />

        {/* <LinearGradient
          colors={["transparent", "rgba(0, 0, 0, 0.7)"]}
          style={styles.gradient}
        /> */}

        <View
          style={{
            zIndex: 10,
            padding: spacing.md,
            justifyContent: "space-between",
            height: "100%",
          }}
        >
          <View style={{ width: "60%", paddingTop: 15 }}>
            <Text
              style={{
                color: colors.black + "80",
                marginBottom: 5,
              }}
            >
              Super Sale Discount
            </Text>
            <Text
              style={{
                color: colors.black,
                fontSize: 26,
                marginBottom: 20,
              }}
            >
              Get Your Special Sale Up to{" "}
              <Text style={{ color: colors.primary, fontWeight: "600" }}>
                40%
              </Text>
            </Text>
          </View>

          <View style={{ width: "50%" }}>
            <Button title="Shop now" />
          </View>
        </View>
      </View>
    </View>
  );
};

const notifPayload: MessageType = {
  text: "Welcome",
  options: {
    description: "This is a normal notification",
    action: {
      label: "OK",
      onClick: () => {
        console.log("Notification action clicked");
      },
    },
  },
};

export default function HomeScreen({ navigation }: Props) {
  const containerRef = useRef(null);
  useScrollToTop(containerRef);

  const { notify } = useNotify();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <FixedHeader />
      {/* <Button
        title="Notify"
        onPress={() => notify(notifPayload.text, notifPayload.options)}
      /> */}
      <Tabs.Container
        ref={containerRef}
        // allowHeaderOverscroll
        snapThreshold={0.3}
        lazy
        renderHeader={() => <CollapsibleProduct />}
        headerContainerStyle={{
          backgroundColor: colors.background,
          borderBottomWidth: 0.5,
          borderBottomColor: colorKit.setAlpha("#1e1e1e", 0.07).hex(),
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: "transparent",
        }}
        renderTabBar={(props) => <TopTabs {...props} />}
        initialTabName="All"
        revealHeaderOnScroll
      >
        <Tabs.Tab name="All">
          <AllContent />
        </Tabs.Tab>
        <Tabs.Tab name="Designers">
          <Content />
        </Tabs.Tab>
        <Tabs.Tab name="Electronics">
          <Content />
        </Tabs.Tab>
      </Tabs.Container>
    </View>
  );
}

const AllContent = () => {
  const [products, setProducts] = useState<any>();
  const [loading, setLoading] = useState(true);

  const tabBarHeight = useBottomTabBarHeight();
  const listRef = useRef<any>(null);
  useScrollToTop(listRef);
  const { notify } = useNotify();

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
      setProducts(ProductData);
    }, 1000);
  }, []);

  // const { data: products } = useProducts();

  return (
    <Tabs.FlashList
      ref={listRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingBottom: tabBarHeight + 16,
        },
      ]}
      numColumns={2}
      masonry
      data={products}
      ListEmptyComponent={
        <View
          style={{
            marginTop: 50,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size={24} color={colors.primary} />
        </View>
      }
      renderItem={({ item }: { item: any }) => (
        <ProductCard productId={item.id.toString()} />
      )}
    />
  );
};

const Content = () => {
  return (
    <Tabs.ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.hero}>
        <View style={styles.heroLineSmall} />
        <View style={styles.heroLineMedium} />
        <View style={styles.heroLineLarge} />
      </View>

      {[1, 2, 3].map((_, index) => (
        <View key={index} style={styles.section}>
          <View style={styles.sectionLineSmall} />
          <View style={styles.sectionLineMedium} />

          <View style={styles.cardRow}>
            <View style={styles.card} />
            <View style={styles.card} />
          </View>
        </View>
      ))}
    </Tabs.ScrollView>
  );
};

const styles = StyleSheet.create({
  marqueeContainer: {
    paddingVertical: 8,
    borderBottomWidth: 0.8,
    borderBottomColor: colorKit.setAlpha("#1e1e1e", 0.07).hex(),
    backgroundColor: colors.background,
  },
  marqueeRow: {
    flexDirection: "row",
    alignItems: "center",
    // gap: 100,
  },
  marqueeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  marqueeText: {
    fontSize: 14,
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "300",
    color: "black",
  },
  marqueeImage: {
    height: 35,
    width: 250,
  },

  /** Top bar */
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
  title: {
    fontSize: 18,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },

  /** Tabs */
  tabBar: {
    flexDirection: "row",
    gap: 0,
    paddingHorizontal: 0,
    // paddingVertical: 16,
    borderBottomWidth: 0.8,
    borderBottomColor: colorKit.setAlpha("#1e1e1e", 0.07).hex(),
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabText: {
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "300",
    color: colors.black,
    // textAlign: "left",
  },
  tabTextActive: {
    fontWeight: "300",
    color: colors.primary,
  },

  /** Scroll */
  scrollContent: {
    backgroundColor: colors.background,
    marginTop: spacing.md,
    paddingHorizontal: 4,
  },

  /** Hero */
  hero: {
    height: 600,
    backgroundColor: "#f5f5f4",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  heroLineSmall: {
    height: 24,
    width: 100,
    backgroundColor: "white",
    marginBottom: 4,
  },
  heroLineMedium: {
    height: 24,
    width: 130,
    backgroundColor: "white",
    marginBottom: 16,
  },
  heroLineLarge: {
    height: 48,
    width: "100%",
    backgroundColor: "white",
  },

  /** Sections */
  section: {
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  sectionLineSmall: {
    height: 24,
    width: 110,
    backgroundColor: "#f5f5f4",
    marginBottom: 4,
  },
  sectionLineMedium: {
    height: 24,
    width: 140,
    backgroundColor: "#f5f5f4",
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    height: 300,
    width: "45%",
    backgroundColor: "#f5f5f4",
  },

  /** Utils */
  noShadow: {
    elevation: 0,
    shadowOpacity: 0,
    shadowColor: "transparent",
  },

  inputContainer: {
    height: 48,
    borderWidth: 0.8,
    borderRadius: 13,
    borderColor: colorKit.setAlpha("#1e1e1e", 0.07).hex(),
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    fontSize: 14,
    color: colors.textPrimary,
    gap: spacing.md,
  },
  input: {
    fontSize: 14,
    color: colors.textPrimary,
    // backgroundColor: "red",
    width: "80%",
    height: "100%",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: "50%",
  },
});
