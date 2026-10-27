import { ActionSheetIOS, Alert, Platform } from "react-native";

export type MenuAction = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * The "…" menus: the system's action sheet on iOS; on Android an alert
 * with the same buttons (three at most, cancel included when there's room),
 * closed by tapping outside.
 */
export function showActionMenu(
  title: string,
  actions: MenuAction[],
  cancelLabel: string,
) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...actions.map((action) => action.label), cancelLabel],
        destructiveButtonIndex: actions.flatMap((action, index) =>
          action.destructive ? [index] : [],
        ),
        cancelButtonIndex: actions.length,
      },
      (index) => actions[index]?.onPress(),
    );
    return;
  }
  const buttons = actions.map((action) => ({
    text: action.label,
    style: action.destructive ? ("destructive" as const) : undefined,
    onPress: action.onPress,
  }));
  Alert.alert(
    title,
    undefined,
    buttons.length < 3
      ? [...buttons, { text: cancelLabel, style: "cancel" }]
      : buttons,
    { cancelable: true },
  );
}
