import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppTabParamList } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { InputField } from '../../components/InputField';
import { PrimaryButton } from '../../components/PrimaryButton';

type Props = NativeStackScreenProps<AppTabParamList, 'Sell'>;

export const CreateProductScreen = ({ navigation }: Props) => {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    console.log('Create product', { title, price, description });
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sell an Item</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.imageUpload}>
          <Text style={styles.uploadText}>+ Add Photos</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          <InputField
            label="Title"
            placeholder="What are you selling?"
            value={title}
            onChangeText={setTitle}
          />
          
          <InputField
            label="Price"
            placeholder="0.00 €"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />
          
          <InputField
            label="Description"
            placeholder="Describe your item..."
            multiline
            numberOfLines={4}
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Upload Item" onPress={handleSubmit} />
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
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.md,
  },
  imageUpload: {
    height: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    backgroundColor: '#FAFAFA',
  },
  uploadText: {
    ...typography.body,
    color: colors.primary,
  },
  form: {
    gap: spacing.sm,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
