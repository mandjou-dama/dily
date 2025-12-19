import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
}

export const PrimaryButton = ({ title, style, ...props }: PrimaryButtonProps) => {
  return (
    <TouchableOpacity style={[styles.button, style]} activeOpacity={0.8} {...props}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
