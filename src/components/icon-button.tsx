import { LucideIcon, LucideProps } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";

export const IconButton = memo(
  ({
    onPress,
    icon: Icon,
    iconProps = {},
  }: {
    onPress?: () => void;
    icon: LucideIcon;
    iconProps?: LucideProps;
  }) => {
    return (
      <Pressable style={styles.button} onPress={onPress}>
        <Icon
          style={{ pointerEvents: "none" }}
          size={20}
          strokeWidth={1}
          {...iconProps}
        />
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  button: {
    width: 50 - 15,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
