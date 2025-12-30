import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppTabParamList } from "@/types/navigation";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { Image } from "expo-image";

type Props = NativeStackScreenProps<AppTabParamList, "Chat">;

interface Message {
  id: string;
  text: string;
  sender: "me" | "other";
  timestamp: number;
}

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    text: "Hi, is this still available?",
    sender: "other",
    timestamp: 1672531200000,
  },
  { id: "2", text: "Yes, it is!", sender: "me", timestamp: 1672531260000 },
  {
    id: "3",
    text: "Can you do 20€?",
    sender: "other",
    timestamp: 1672531320000,
  },
];

export const ChatScreen = ({ navigation }: Props) => {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "me",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.sender === "me";
    return (
      <View
        style={[
          styles.messageBubble,
          isMe ? styles.myMessage : styles.otherMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isMe ? styles.myMessageText : styles.otherMessageText,
          ]}
        >
          {item.text}
        </Text>
      </View>
    );
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
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.xs,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#F2F2F2",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.body,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  otherMessageText: {
    color: colors.textPrimary,
  },
  inputContainer: {
    flexDirection: "row",
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: "#F2F2F2",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    color: colors.textPrimary,
  },
  sendButton: {
    paddingHorizontal: spacing.sm,
  },
  sendButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: "600",
  },
});
