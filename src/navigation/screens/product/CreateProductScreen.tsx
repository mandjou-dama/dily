import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppTabParamList } from "@/types/navigation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { InputField } from "@/components/InputField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Image } from "expo-image";

type Props = NativeStackScreenProps<AppTabParamList, "Sell">;

export const CreateProductScreen = ({ navigation }: Props) => {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    console.log("Create product", { title, price, description });
    navigation.navigate("Home");
  };

  return (
    <View style={styles.container}>
      <Image
        style={{
          width: 100,
          aspectRatio: 1 / 1,
          marginTop: 80,
        }}
        source={require("assets/splash-icon-light.png")}
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
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
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
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    backgroundColor: "#FAFAFA",
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
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
