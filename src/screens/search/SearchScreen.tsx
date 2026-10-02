import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { ArrowLeft, Search, X } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { useProductFeed } from "@/services/products.service";
import { productKeyExtractor, useProductGrid } from "@/hooks/use-product-grid";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  GridError,
  GridLoading,
  GridMessage,
} from "@/components/product-grid-states";

// One query per pause in typing, not per keystroke
const SEARCH_DEBOUNCE_MS = 300;
// One letter matches nearly everything and can't use the trigram index
const MIN_SEARCH_LENGTH = 2;

export default function SearchScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState("");
  const term = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const hasTerm = term.length >= MIN_SEARCH_LENGTH;

  // An empty search shows the latest listings, so the screen is never blank
  const feed = useProductFeed(hasTerm ? { search: term } : {}, {
    keepPrevious: true,
  });
  const { data, renderItem, loadMore } = useProductGrid(feed);

  const empty = feed.isPending ? (
    <GridLoading />
  ) : feed.isError ? (
    <GridError onRetry={() => feed.refetch()} />
  ) : (
    <GridMessage
      title={`No results for "${term}"`}
      text="Try a shorter or different word, like jacket or sneakers."
    />
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
        >
          <ArrowLeft size={22} color={colors.black} strokeWidth={1.8} />
        </Pressable>

        <View style={styles.field}>
          <Search size={18} color="#8A877C" strokeWidth={2} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search Dily"
            placeholderTextColor="#8A877C"
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="never"
            maxLength={80}
            accessibilityLabel="Search listings"
            style={styles.input}
          />
          {text ? (
            <Pressable
              onPress={() => setText("")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={18} color="#8A877C" strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlashList
        data={data}
        numColumns={2}
        keyExtractor={productKeyExtractor}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={empty}
        contentContainerStyle={{
          paddingHorizontal: 6,
          paddingTop: 6,
          paddingBottom: insets.bottom + 16,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 6,
    paddingRight: 16,
    paddingBottom: 8,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: colors.black,
  },
});
