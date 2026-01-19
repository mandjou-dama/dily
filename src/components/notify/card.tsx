import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { MessageType } from "./type";
import { colors } from "@/theme/colors";
import { Bug, TriangleAlert } from "lucide-react-native";

type CardGlobalProps = {
  shown: SharedValue<boolean>;
};

const useOpacityAnimation = (shown: SharedValue<boolean>) => {
  return useAnimatedStyle(() => {
    return {
      opacity: withSpring(shown.value ? 1 : 0),
    };
  });
};

export const CardPeek = ({
  text,
  options,
  shown,
}: MessageType & CardGlobalProps) => {
  const animatedStyle = useOpacityAnimation(shown);

  return (
    <Animated.View
      style={[styles.container, styles.peekWrapper, animatedStyle]}
    >
      <View style={styles.peekContainer}>
        <View style={styles.imageWrapper}>
          {/* <Image
            source={{ uri: "https://via.placeholder.com/150" }}
            style={styles.image}
          /> */}

          <TriangleAlert strokeWidth={1.5} size={24} color={colors.white} />
        </View>
        <View style={styles.peekContent}>
          <Text style={styles.text} numberOfLines={1} ellipsizeMode="clip">
            {text}
          </Text>
          <Text
            style={styles.description}
            ellipsizeMode="tail"
            numberOfLines={2}
          >
            {options?.description}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const CardHeader = ({ title }: { title: string }) => {
  return (
    <BlurView style={styles.header} intensity={10}>
      <Text style={styles.text}>{title}</Text>
    </BlurView>
  );
};

export const CardExpanded = ({
  children,
  shown,
}: { children?: React.ReactNode } & CardGlobalProps) => {
  const animatedStyle = useOpacityAnimation(shown);

  return (
    <Animated.View style={[styles.expandedContainer, animatedStyle]}>
      <View style={styles.expanded}>{children}</View>
    </Animated.View>
  );
};

export const CardHandle = ({ shown }: CardGlobalProps) => {
  const animatedStyle = useOpacityAnimation(shown);

  return <Animated.View style={[styles.handle, animatedStyle]} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  peekWrapper: {
    justifyContent: "center",
  },
  peekContainer: {
    padding: 12,
    flexDirection: "row",
    // backgroundColor: "blue",
    alignItems: "center",
    gap: 8,
    maxHeight: 78,
  },
  text: {
    fontWeight: "600",
    fontSize: 14,
    color: colors.black,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    borderCurve: "continuous",
    alignSelf: "center",
    position: "absolute",
    bottom: 5,
    backgroundColor: colors.white,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  expanded: {
    flex: 1,
  },
  expandedContainer: {
    ...StyleSheet.absoluteFillObject,
    margin: 1,
    overflow: "hidden",
    borderRadius: 24,
    borderCurve: "continuous",
  },
  imageWrapper: {
    borderRadius: "50%",
    overflow: "hidden",
    height: 60,
    width: 60,
    backgroundColor: colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    height: "100%",
    aspectRatio: 1,
    backgroundColor: "#88888888",
  },
  peekContent: {
    flex: 1,
    gap: 2,
  },
  title: {},
  description: {
    fontSize: 14,
    opacity: 0.9,
  },
});
