import React from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppTabParamList } from '@/types/navigation';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { ProductCard } from '@/components/ProductCard';

type Props = NativeStackScreenProps<AppTabParamList, 'Home'>;

const CATEGORIES = ['All', 'Women', 'Men', 'Kids', 'Home', 'Entertainment', 'Pet Care'];

const PRODUCTS = [
  { id: '1', title: 'Vintage Denim Jacket', price: '25.00 €', location: 'Paris, France' },
  { id: '2', title: 'Nike Air Force 1', price: '45.00 €', location: 'Lyon, France' },
  { id: '3', title: 'Wooden Coffee Table', price: '15.00 €', location: 'Marseille, France' },
  { id: '4', title: 'Harry Potter Collection', price: '30.00 €', location: 'Bordeaux, France' },
  { id: '5', title: 'Zara Summer Dress', price: '12.00 €', location: 'Nice, France' },
  { id: '6', title: 'PS4 Controller', price: '20.00 €', location: 'Lille, France' },
];

export const HomeScreen = ({ navigation }: Props) => {
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
    <SafeAreaView style={styles.container}>
      <FlatList
        data={PRODUCTS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard
            title={item.title}
            price={item.price}
            location={item.location}
            onPress={() => console.log('Product pressed', item.id)}
          />
        )}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    justifyContent: 'space-between',
  },
});
