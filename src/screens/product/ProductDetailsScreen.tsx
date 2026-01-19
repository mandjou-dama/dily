import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  FlatList,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/types/navigation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { ProductData } from "@/mock/products";
import {
  ArrowLeft,
  ArrowLeftToLine,
  Heart,
  HeartCrack,
  Share,
} from "lucide-react-native";
import { colorKit } from "reanimated-color-picker";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  SharedValue,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { FlashList } from "@shopify/flash-list";
import { IconButton } from "@/components/icon-button";

type Props = NativeStackScreenProps<RootStackParamList, "ProductDetails">;

const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

const FULL_HEADER_HEIGHT = 350;
const COLLAPSED_HEADER_HEIGHT = 0;

const DATA = {
  name: "Solarin",
  username: "S0LARIN",
  profileImage:
    "https://pbs.twimg.com/profile_images/1840756205716635648/3HOkBe_W_400x400.jpg",
  coverImage:
    "https://pbs.twimg.com/profile_banners/1674810013007659014/1752253038/1500x500",
  postCount: "491",
  bio: "18, I write design code —Web, Mobile",
  link: "github.com/Solarin-Johnson",
  followers: "1.4K",
  following: "222",
};

// In a real app, we would fetch product details using route.params.id
// For now, we use mock data
const product = {
  title: "Vintage Denim Jacket",
  price: "25.00 €",
  description:
    "Authentic vintage denim jacket from the 90s. Great condition, slightly worn for that perfect look. Size M but fits like L.",
  location: "Paris, France",
  seller: {
    name: "Marie Dupont",
    rating: 4.8,
  },
  images: [
    ProductData[0].product.image,
    ProductData[1].product.image,
    ProductData[2].product.image,
  ],
};

const HeaderImage = ({ scrollY }: { scrollY: SharedValue<number> }) => {
  const { top } = useSafeAreaInsets();
  const swapDistance = FULL_HEADER_HEIGHT - top - COLLAPSED_HEADER_HEIGHT;

  const intensity = useDerivedValue<number | undefined>(() =>
    interpolate(
      Math.abs(scrollY.value),
      [0, FULL_HEADER_HEIGHT],
      [0, 32],
      Extrapolation.CLAMP,
    ),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, swapDistance],
      [FULL_HEADER_HEIGHT, COLLAPSED_HEADER_HEIGHT],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          -scrollY.value,
          [0, FULL_HEADER_HEIGHT],
          [1, 1.3],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const fixedHeaderImgStyle = useAnimatedStyle(() => ({
    opacity: scrollY.value >= swapDistance ? 1 : 0,
  }));

  const underlayHeaderImgStyle = useAnimatedStyle(() => ({
    opacity: scrollY.value < swapDistance ? 1 : 0,
  }));

  const headerStyle = [
    styles.headerImage,
    { marginTop: top + 16 + 30, zIndex: -2 },
    animatedStyle,
  ];

  return (
    <>
      <Animated.View style={headerStyle} pointerEvents="box-none">
        <ProductImage intensity={intensity} style={underlayHeaderImgStyle} />
      </Animated.View>
      <Animated.View
        style={[...headerStyle, { zIndex: -1 }]}
        pointerEvents="box-none"
      >
        <ProductImage intensity={intensity} style={fixedHeaderImgStyle} />
      </Animated.View>
    </>
  );
};

const ProductImage = ({
  style,
  intensity,
}: {
  style?: object;
  intensity: SharedValue<number | undefined>;
}) => (
  <Animated.View
    style={[
      StyleSheet.absoluteFillObject,
      { height: FULL_HEADER_HEIGHT, overflow: "hidden" },
      style,
    ]}
    pointerEvents="none"
  >
    <Image
      source={ProductData[0].product.image}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
    />
    <AnimatedBlurView
      intensity={intensity}
      style={StyleSheet.absoluteFillObject}
    />
  </Animated.View>
);

const MainContent = ({ scrollY }: { scrollY: SharedValue<number> }) => {
  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [0, COLLAPSED_HEADER_HEIGHT],
          [1, 0.6],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return <View></View>;
};

export const ProductDetailsScreen = ({ route }: Props) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const SECTIONS = [{ id: "main" }];

  const renderItem = ({ item }: { item: any }) => {
    switch (item.id) {
      case "main":
        return (
          <View
            style={{
              height: 1500,
            }}
          >
            <MainContent scrollY={scrollY} />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IconButton
          iconProps={{
            color: colors.primary,
          }}
          icon={ArrowLeft}
        />

        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            alignItems: "center",
          }}
        >
          <IconButton
            iconProps={{
              color: colors.primary,
            }}
            icon={Share}
          />
          <IconButton
            iconProps={{
              color: colors.primary,
            }}
            icon={Heart}
          />
        </View>
      </View>
      <HeaderImage scrollY={scrollY} />
      <AnimatedFlashList
        data={SECTIONS}
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        style={styles.container}
        onScroll={scrollHandler}
        contentContainerStyle={{ paddingTop: FULL_HEADER_HEIGHT }}
        showsVerticalScrollIndicator={false}
      />
    </>
  );

  // return (
  //   <View
  //     style={[
  //       styles.container,
  //       { paddingBottom: insets.bottom, paddingTop: insets.top },
  //     ]}
  //   >
  //     <View style={styles.header}>
  //       <Pressable hitSlop={20} onPress={() => navigation.goBack()}>
  //         <ArrowLeft
  //           style={{ pointerEvents: "none" }}
  //           size={20}
  //           strokeWidth={1}
  //           color={colors.primary}
  //         />
  //       </Pressable>

  //       <View
  //         style={{
  //           flexDirection: "row",
  //           gap: spacing.md,
  //           alignItems: "center",
  //         }}
  //       >
  //         <Pressable hitSlop={20} onPress={() => navigation.goBack()}>
  //           <Share
  //             style={{ pointerEvents: "none" }}
  //             size={20}
  //             strokeWidth={1}
  //             color={colors.primary}
  //           />
  //         </Pressable>
  //         <Pressable hitSlop={20} onPress={() => navigation.goBack()}>
  //           <Heart
  //             style={{ pointerEvents: "none" }}
  //             size={20}
  //             strokeWidth={1}
  //             color={colors.primary}
  //           />
  //         </Pressable>
  //       </View>
  //     </View>

  //     <ScrollView showsVerticalScrollIndicator={false}>
  //       <ScrollView
  //         horizontal
  //         pagingEnabled
  //         showsHorizontalScrollIndicator={false}
  //         style={styles.gallery}
  //       >
  //         {product.images.map((img, index) => (
  //           <AnimatedImage
  //             sharedTransitionTag="product-image"
  //             key={index}
  //             source={{ uri: img }}
  //             style={styles.image}
  //             contentFit="cover"
  //           />
  //         ))}
  //       </ScrollView>

  //       <View style={styles.content}>
  //         <View style={styles.titleRow}>
  //           <Text style={styles.price}>{product.price}</Text>
  //           <Text style={styles.location}>{product.location}</Text>
  //         </View>

  //         <Text style={styles.title}>{product.title}</Text>

  //         <View style={styles.divider} />

  //         <Text style={styles.sectionTitle}>Description</Text>
  //         <Text style={styles.description}>{product.description}</Text>

  //         <View style={styles.divider} />

  //         <View style={styles.sellerContainer}>
  //           <View style={styles.sellerAvatar} />
  //           <View>
  //             <Text style={styles.sellerName}>{product.seller.name}</Text>
  //             <Text style={styles.sellerRating}>★ {product.seller.rating}</Text>
  //           </View>
  //         </View>
  //       </View>
  //     </ScrollView>

  //     <View style={styles.footer}>
  //       <PrimaryButton
  //         title="Message Seller"
  //         onPress={() => console.log("Message seller")}
  //       />
  //     </View>
  //   </View>
  // );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.8,
    backgroundColor: colors.background,
    borderBottomColor: colorKit.setAlpha("#3C5627", 0.07).hex(),
    width: "100%",
  },
  headerImage: {
    width: "100%",
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  headerNav: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2,
    marginHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  navCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  gallery: {
    height: 360,
  },
  image: {
    width: spacing.SCREEN_WIDTH,
    height: "100%",
  },
  content: {
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.xs,
  },
  price: {
    ...typography.title,
    fontSize: 24,
    color: colors.textPrimary,
  },
  location: {
    ...typography.body,
    color: colors.textSecondary,
  },
  title: {
    ...typography.body,
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  sellerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E0E0E0",
  },
  sellerName: {
    ...typography.title,
    fontSize: 16,
  },
  sellerRating: {
    ...typography.small,
    color: "#F2994A",
    marginTop: 2,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
