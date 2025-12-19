import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface ProductCardProps {
  title: string;
  price: string;
  location: string;
  imageUrl?: string;
  onPress?: () => void;
}

export const ProductCard = ({ title, price, location, imageUrl, onPress }: ProductCardProps) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.location} numberOfLines={1}>{location}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '48%', // Approx 2 columns
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageContainer: {
    height: 150,
    backgroundColor: '#F2F2F2',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  content: {
    padding: spacing.sm,
  },
  price: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  title: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  location: {
    ...typography.small,
    fontSize: 10,
    color: '#999',
  },
});
