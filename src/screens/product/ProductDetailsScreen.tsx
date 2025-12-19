import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { PrimaryButton } from '../../components/PrimaryButton';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetails'>;

export const ProductDetailsScreen = ({ navigation, route }: Props) => {
  // In a real app, we would fetch product details using route.params.id
  // For now, we use mock data
  const product = {
    title: 'Vintage Denim Jacket',
    price: '25.00 €',
    description: 'Authentic vintage denim jacket from the 90s. Great condition, slightly worn for that perfect look. Size M but fits like L.',
    location: 'Paris, France',
    seller: {
      name: 'Marie Dupont',
      rating: 4.8,
    },
    images: [
      'https://via.placeholder.com/400x400/2F80ED/FFFFFF?text=Image+1',
      'https://via.placeholder.com/400x400/EB5757/FFFFFF?text=Image+2',
      'https://via.placeholder.com/400x400/27AE60/FFFFFF?text=Image+3',
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {product.images.map((img, index) => (
            <Image key={index} source={{ uri: img }} style={styles.image} resizeMode="cover" />
          ))}
        </ScrollView>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.price}>{product.price}</Text>
            <Text style={styles.location}>{product.location}</Text>
          </View>
          
          <Text style={styles.title}>{product.title}</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.sellerContainer}>
            <View style={styles.sellerAvatar} />
            <View>
              <Text style={styles.sellerName}>{product.seller.name}</Text>
              <Text style={styles.sellerRating}>★ {product.seller.rating}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Message Seller" onPress={() => console.log('Message seller')} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  gallery: {
    height: 300,
    backgroundColor: '#F2F2F2',
  },
  image: {
    width: 400, // Should be screen width in real app
    height: 300,
  },
  content: {
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
  },
  sellerName: {
    ...typography.title,
    fontSize: 16,
  },
  sellerRating: {
    ...typography.small,
    color: '#F2994A',
    marginTop: 2,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
