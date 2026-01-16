import { Bell, Search } from "lucide-react-native";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "react-native-collapsible-tab-view";
import { Marquee } from "@/components/header-marquee";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppTabParamList } from "@/types/navigation";
import React, { useRef, useState } from "react";
import { colors } from "@/theme/colors";
import { colorKit } from "reanimated-color-picker";
import { Image } from "expo-image";
import ProductCard from "@/components/product-card";
import { spacing } from "@/theme/spacing";
import { setHeaderLogoLayout } from "@/components/header-logo-layout.ts";
import { TopTabs } from "@/components/top-tab";
import { useScrollToTop } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Button from "@/components/Button";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

type Props = NativeStackScreenProps<AppTabParamList, "Home">;

type MarqueeItemProps = {
  icon?: React.ReactNode;
  text?: string;
};

const TabItems = ["All", "Designers", "Electronics"];

const ProductData = [
  {
    user: {
      name: "Aïcha Traoré",
      image: "https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg",
    },
    product: {
      name: "Vintage Denim Jacket",
      image:
        "https://images.pexels.com/photos/13662420/pexels-photo-13662420.jpeg",
      price: "23 000",
      size: "M",
      state: "Like new",
    },
    like: {
      liked: true,
      number: 12,
    },
  },
  {
    user: {
      name: "Mamadou Diallo",
      image: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg",
    },
    product: {
      name: "Nike Air Force 1",
      image:
        "https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg",
      price: "17 200",
      size: "42",
      state: "Used",
    },
    like: {
      liked: false,
      number: 34,
    },
  },
  {
    user: {
      name: "Fatou Koné",
      image: "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg",
    },
    product: {
      name: "Minimalist Leather Handbag",
      image:
        "https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg",
      price: "35 000",
      size: "One size",
      state: "New",
    },
    like: {
      liked: false,
      number: 5,
    },
  },
  {
    user: {
      name: "Ibrahim Touré",
      image:
        "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg",
    },
    product: {
      name: "Oversized Hoodie",
      image:
        "https://images.pexels.com/photos/9367505/pexels-photo-9367505.jpeg",
      price: "40 000",
      size: "L",
      state: "Good condition",
    },
    like: {
      liked: false,
      number: 0,
    },
  },
  {
    user: {
      name: "Sira Coulibaly",
      image: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg",
    },
    product: {
      name: "Summer Floral Dress",
      image:
        "https://images.pexels.com/photos/19895983/pexels-photo-19895983.jpeg",
      price: "28 000",
      size: "S",
      state: "Like new",
    },
    like: {
      liked: false,
      number: 10,
    },
  },
  {
    user: {
      name: "Yacouba Sanogo",
      image: "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg",
    },
    product: {
      name: "Casual Canvas Sneakers",
      image:
        "https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg",
      price: "32 000",
      size: "43",
      state: "Used",
    },
    like: {
      liked: true,
      number: 20,
    },
  },
];

const FixedHeader = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeHeader, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Image
          source={require("assets/splash-icon-light.png")}
          style={{
            width: 70,
            aspectRatio: 16 / 9,
            marginBottom: -7,
            marginTop: -5,
          }}
          onLayout={(e) => {
            const { x, y, width, height } = e.nativeEvent.layout;

            setHeaderLogoLayout({
              x,
              y: y + insets.top,
              width,
              height,
            });
          }}
        />

        <View style={styles.iconRow}>
          <Pressable>
            <Search size={20} color="black" strokeWidth={1.5} />
          </Pressable>
          <Bell size={20} color="black" strokeWidth={1.5} />
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

export default function HomeScreen({ navigation }: Props) {
  const containerRef = useRef(null);
  useScrollToTop(containerRef);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <FixedHeader />
      <Tabs.Container
        ref={containerRef}
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
  const tabBarHeight = useBottomTabBarHeight();
  const listRef = useRef<any>(null);
  useScrollToTop(listRef);

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
      data={ProductData}
      renderItem={({ item }) => (
        <ProductCard
          user={{
            name: item.user.name,
            image: item.user.image,
          }}
          product={{
            name: item.product.name,
            image: item.product.image,
            price: item.product.price,
            size: item.product.size,
            state: item.product.state,
          }}
          like={{
            liked: item.like.liked,
            number: item.like.number,
          }}
        />
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
    borderBottomColor: colorKit.setAlpha("#1e1e1e", 0.07).hex(),
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
