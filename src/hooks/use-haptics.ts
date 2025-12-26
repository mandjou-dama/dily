import * as Haptics from "expo-haptics";

type ImpactStyle = "light" | "medium" | "heavy";
type NotificationType = "success" | "warning" | "error";

export const useHaptics = () => {
  const impact = (style: ImpactStyle = "medium") => {
    const map = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };

    Haptics.impactAsync(map[style]);
  };

  const notification = (type: NotificationType) => {
    const map = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    };

    Haptics.notificationAsync(map[type]);
  };

  const selection = () => {
    Haptics.selectionAsync();
  };

  return {
    impact,
    notification,
    selection,
  };
};
