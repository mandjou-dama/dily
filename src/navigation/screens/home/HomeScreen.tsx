import {
  Car,
  PawPrint,
  Percent,
  Search,
  ShoppingBag,
  UserRound,
} from "lucide-react-native";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MaterialTabBarProps,
  MaterialTabItem,
  MaterialTabItemProps,
  TabBarProps,
  Tabs,
  useFocusedTab,
  useHeaderMeasurements,
} from "react-native-collapsible-tab-view";
import { Marquee } from "@/components/header-marquee";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppTabParamList } from "@/types/navigation";
import {
  TabName,
  TabsWithProps,
} from "react-native-collapsible-tab-view/lib/typescript/src/types";
import React, { useState } from "react";
import { colors } from "@/theme/colors";
import { colorKit } from "reanimated-color-picker";
import { Image } from "expo-image";
import ProductCard from "@/components/product-card";
import { spacing } from "@/theme/spacing";

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
        "https://images.pexels.com/photos/6311392/pexels-photo-6311392.jpeg",
      price: 85,
      size: "M",
      state: "Like new",
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
      price: 120,
      size: "42",
      state: "Used",
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
      price: 150,
      size: "One size",
      state: "New",
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
        "https://images.pexels.com/photos/8532616/pexels-photo-8532616.jpeg",
      price: 60,
      size: "L",
      state: "Good condition",
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
        "https://images.pexels.com/photos/1488463/pexels-photo-1488463.jpeg",
      price: 95,
      size: "S",
      state: "Like new",
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
      price: 70,
      size: "43",
      state: "Used",
    },
  },
];

const Header = () => {
  return (
    <View style={styles.marqueeContainer}>
      <Marquee spacing={18} speed={0.6}>
        <View style={styles.marqueeRow}>
          <MarqueeItem
            icon={<Car size={18} color="black" strokeWidth={1} />}
            text="Best free shipping on orders over 2500 UAH"
          />
          <MarqueeItem
            icon={<Percent size={18} color="black" strokeWidth={1} />}
            text="Discount 5% when paid with a bank card"
          />
          <MarqueeItem
            icon={
              <PawPrint size={18} color="black" fill="black" strokeWidth={1} />
            }
            text="Purchase in installments from monobank"
          />
        </View>
      </Marquee>
    </View>
  );
};

const MarqueeItem = ({ icon, text }: MarqueeItemProps) => {
  return (
    <View style={styles.marqueeItem}>
      {icon}
      <Text style={styles.marqueeText}>{text}</Text>
      {/* <Image
        contentFit="cover"
        style={styles.marqueeImage}
        source={require("assets/banner_1.png")}
      /> */}
    </View>
  );
};

type TabItemProps = {
  label: string;
  isActive?: boolean;
  onPress?: () => void;
};

const TabItem = ({ label, isActive, onPress }: TabItemProps) => {
  return (
    <Pressable onPress={onPress}>
      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
};

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ref = React.useRef<any>(null);

  const getFocusedTab = (label: TabName) => {
    if (ref.current) {
      ref.current.jumpToTab(label);
    }
    return null;
  };

  return (
    <>
      <View style={[styles.safeHeader, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Image
            style={{
              width: 70,
              aspectRatio: 16 / 9,
              marginBottom: -7,
              marginTop: -5,
            }}
            source={require("assets/splash-icon-light.png")}
          />

          <View style={styles.iconRow}>
            <Pressable onPress={() => console.log("Search")}>
              <Search
                style={{ pointerEvents: "none" }}
                size={20}
                color="black"
                strokeWidth={1.5}
              />
            </Pressable>
            <ShoppingBag size={20} color="black" strokeWidth={1.5} />
          </View>
        </View>
      </View>

      <Tabs.Container
        ref={ref}
        containerStyle={{
          backgroundColor: colors.background,
        }}
        renderHeader={Header}
        renderTabBar={(props) => {
          return (
            <View style={styles.tabBar}>
              {TabItems.map((item, index) => (
                <MaterialTabItem
                  key={item}
                  name={item}
                  index={index}
                  indexDecimal={props.indexDecimal}
                  label={item}
                  onPress={() => getFocusedTab(item)}
                  labelStyle={[
                    styles.tabText,
                    // props.focusedTab && styles.tabTextActive,
                  ]}
                  activeColor={colors.primary}
                  inactiveColor={colors.black + "80"}
                  pressOpacity={0.8}
                  style={{
                    flex: index === 0 ? 0.15 : index === 1 ? 0.28 : 0.35,
                  }}
                  // delayHoverIn={200}
                />
              ))}
            </View>
          );
        }}
        headerContainerStyle={styles.noShadow}
      >
        <Tabs.Tab name="All">
          <View style={{ flex: 1 }}>
            <AllContent />
          </View>
        </Tabs.Tab>

        <Tabs.Tab name="Designers">
          <Content />
        </Tabs.Tab>

        <Tabs.Tab name="Electronics">
          <Content />
        </Tabs.Tab>
      </Tabs.Container>
    </>
  );
}

const AllContent = () => {
  return (
    <Tabs.FlashList
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      masonry
      numColumns={2}
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
    color: "black",
    textAlign: "left",
  },
  tabTextActive: {
    fontWeight: "300",
    color: colors.primary,
  },

  /** Scroll */
  scrollContent: {
    backgroundColor: colors.background,
    marginTop: 4,
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
});
