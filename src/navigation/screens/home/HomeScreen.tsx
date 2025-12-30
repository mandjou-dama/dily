import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Button,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppTabParamList } from "@/types/navigation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { ProductCard } from "@/components/ProductCard";

import {
  Confetti,
  ConfettiMethods,
  PIConfetti,
  PIConfettiMethods,
} from "react-native-fast-confetti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHaptics } from "@/hooks/use-haptics";
import { Spinner } from "@/components/spinner";
import { Image } from "expo-image";

type Props = NativeStackScreenProps<AppTabParamList, "Home">;

const CATEGORIES = [
  "All",
  "Women",
  "Men",
  "Kids",
  "Home",
  "Entertainment",
  "Pet Care",
];

const PRODUCTS = [
  {
    id: "1",
    title: "Vintage Denim Jacket",
    price: "25.00 €",
    location: "Paris, France",
  },
  {
    id: "2",
    title: "Nike Air Force 1",
    price: "45.00 €",
    location: "Lyon, France",
  },
  {
    id: "3",
    title: "Wooden Coffee Table",
    price: "15.00 €",
    location: "Marseille, France",
  },
  {
    id: "4",
    title: "Harry Potter Collection",
    price: "30.00 €",
    location: "Bordeaux, France",
  },
  {
    id: "5",
    title: "Zara Summer Dress",
    price: "12.00 €",
    location: "Nice, France",
  },
  {
    id: "6",
    title: "PS4 Controller",
    price: "20.00 €",
    location: "Lille, France",
  },
];

export const HomeScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { impact } = useHaptics();

  const confettiRef = useRef<ConfettiMethods>(null);

  const [isLoading, setIsLoading] = useState(true);

  const runConfetti = () => {
    confettiRef.current?.restart();
    impact();
  };

  // useEffect(() => {
  //   setTimeout(() => {
  //     {
  //       setIsLoading(false);
  //     }
  //   }, 2000);
  // }, []);

  const renderHeader = () => (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {CATEGORIES.map((category, index) => (
          <TouchableOpacity key={index} style={styles.categoryItem}>
            <Text style={styles.categoryText}>{category}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>New items</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* {isLoading ? (
        <Spinner color={colors.primary} size={24} />
      ) : (
        <>{runConfetti()}</>
      )} */}

      {/* <Button title="Run again" onPress={runConfetti}></Button> */}

      <Image
        style={{
          width: 100,
          aspectRatio: 1 / 1,
          marginTop: 80,
        }}
        source={require("assets/splash-icon-light.png")}
      />

      <Confetti
        colors={[colors.primary, "#2a9d8f", "#ffd166", "#ffafcc"]}
        sizeVariation={0.9}
        height={spacing.SCREEN_HEIGHT}
        count={450}
        ref={confettiRef}
        isInfinite={false}
        autoStartDelay={1000}
        // blastDuration={150}
        // cannonsPositions={[
        //   { x: -400, y: 0 },
        //   { x: 400, y: 800 },
        // ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  categoriesContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  categoryItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  categoryText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 18,
    color: colors.textPrimary,
  },
  seeAll: {
    ...typography.body,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
});
