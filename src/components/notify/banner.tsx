import {
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import React, { Fragment, useEffect } from "react";
import Animated, {
  SharedValue,
  SlideInUp,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { MessageType } from "./type";
import { BlurView } from "expo-blur";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { CardExpanded, CardHandle, CardPeek } from "./card";
import { GlassView } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";

const TOP_OFFSET = 60;
const HEIGHT = 78;
const EXPANDED_HEIGHT = 500;
const RESISTANCE_FACTOR = 0.15;
const HIDE_DELAY = 3000;
const THRESHOLD = HEIGHT / 2;
const SLIDE_UP_DISTANCE = HEIGHT + TOP_OFFSET;
const VELOCITY_THRESHOLD = 500;
const DRAG_THRESHOLD = 30;
const HANDLE_HEIGHT = 10;
const KEYBOARD_OFFSET = 20;

const isAndroid = Platform.OS === "android";
const isWeb = Platform.OS === "web";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

const isLiquidGlass = false;

export default function Banner({
  message,
  index,
  messageCount,
  keyboardHeight,
}: {
  message: MessageType;
  index: number;
  messageCount: SharedValue<number>;
  keyboardHeight: SharedValue<number>;
}) {
  const hidden = useSharedValue(false);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const scheduleHide = useSharedValue(0);
  const hasExceededThreshold = useSharedValue(false);
  const mounted = useSharedValue(false);
  const height = useSharedValue(HEIGHT);
  const { top } = useSafeAreaInsets();
  const { options } = message;
  const bg = colors.black;
  const theme = useColorScheme();
  const isDark = theme === "light";

  const { height: windowHeight } = useWindowDimensions();

  const expandedChild = options?.expandedChild;

  const EXPANDED_TOP = windowHeight / 2 - EXPANDED_HEIGHT / 2 - top;

  const notExpanded = useDerivedValue(() => {
    return !hasExceededThreshold.value;
  });

  const overLayIntensity = useDerivedValue<number | undefined>(() => {
    return withSpring(hasExceededThreshold.value ? 80 : 0);
  });

  useEffect(() => {
    mounted.set(true);
    return () => {
      mounted.set(false);
    };
  }, [message]);

  const toggleExpand = (expand: boolean) => {
    "worklet";
    const target = expand ? EXPANDED_HEIGHT : HEIGHT;
    height.set(withSpring(target));
  };

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin(() => {
      isDragging.set(true);
    })
    .onUpdate((e) => {
      if (hidden.value || hasExceededThreshold.value) return;
      if (e.translationY > 0) {
        translateY.set(e.translationY * RESISTANCE_FACTOR);
        if (translateY.value > DRAG_THRESHOLD && expandedChild) {
          hasExceededThreshold.set(true);
        }
      } else {
        translateY.set(e.translationY);
      }
    })
    .onEnd((e) => {
      isDragging.set(false);
      if (hasExceededThreshold.value) return;
      if (translateY.value < -THRESHOLD || e.velocityY < -VELOCITY_THRESHOLD) {
        hidden.set(true);
      } else {
        translateY.set(withSpring(0));
      }
    });

  useAnimatedReaction(
    () => isDragging.value,
    (current) => {
      if (hidden.value) return;
      if (current) {
        scheduleHide.set(0);
      } else if (!hasExceededThreshold.value) {
        scheduleHide.set(withTiming(
          1,
          { duration: HIDE_DELAY },
          (finished) => {
            if (finished) {
              hidden.set(true);
            }
          }
        ));
      }
    }
  );

  useAnimatedReaction(
    () => hidden.value,
    (current) => {
      if (current) {
        hasExceededThreshold.set(false);
      }
    }
  );

  useAnimatedReaction(
    () => hasExceededThreshold.value,
    (current) => {
      if (hidden.value) return;
      if (current) {
        translateY.set(withSpring(EXPANDED_TOP));
        // scheduleOnRN(snapFeedback);
        toggleExpand(true);
      } else {
        translateY.set(withSpring(0));
        toggleExpand(false);
      }
    }
  );

  const animatedStyle = useAnimatedStyle(() => {
    const isCurrent = index === messageCount.value - 1;
    const isHidden = hidden.value || !isCurrent;
    const maxHeight =
      windowHeight -
      keyboardHeight.value -
      EXPANDED_TOP -
      TOP_OFFSET -
      KEYBOARD_OFFSET;
    const finalHeight = Math.min(height.value, maxHeight);

    return {
      transform: [
        {
          scale: withTiming(!isCurrent ? 0.8 : 1, {
            duration: 300,
          }),
        },
      ],
      top: hidden.value
        ? withSpring(-TOP_OFFSET)
        : 0 + translateY.value + TOP_OFFSET,
      opacity: withTiming(isHidden && mounted.value ? 0 : 1),
      pointerEvents: isHidden ? "none" : "auto",
      height: finalHeight,
    };
  });

  const overlayAnimatedStyle = useAnimatedStyle(() => {
    return {
      pointerEvents: hasExceededThreshold.value ? "auto" : "none",
      backgroundColor: isLiquidGlass ? "rgb(0, 0, 0)" : "transparent",
      opacity:
        isLiquidGlass || isAndroid
          ? withTiming(hasExceededThreshold.value ? (isAndroid ? 1 : 0.3) : 0)
          : 1,
    };
  });

  const Blur = isLiquidGlass ? Fragment : isAndroid ? View : BlurView;
  const blurProps = isLiquidGlass
    ? {}
    : {
        intensity: 100,
        style: [
          styles.content,
          {
            backgroundColor: bg + `${isAndroid ? "FF" : "99"}`,
          },
        ],
      };

  const Wrapper = isLiquidGlass ? AnimatedGlassView : Animated.View;

  const handlePress = () => {
    hidden.set(true);
    options?.action?.onClick();
  };

  if (message === null) return null;

  return (
    <>
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, overlayAnimatedStyle]}
        onPress={() => {
          hidden.set(true);
        }}
      >
        {isLiquidGlass ? (
          <Fragment />
        ) : isAndroid ? (
          <View style={{ flex: 1 }} />
        ) : (
          <AnimatedBlurView intensity={overLayIntensity} style={{ flex: 1 }} />
        )}
      </AnimatedPressable>
      <Animated.View
        entering={
          isWeb
            ? SlideInUp
            : SlideInUp.withInitialValues({
                originY: -SLIDE_UP_DISTANCE * 2,
              }).springify()
        }
      >
        <Wrapper
          style={[
            styles.banner,
            {
              boxShadow:
                isLiquidGlass || isDark || isAndroid
                  ? ""
                  : "0 4px 20px #00000010",
            },
            animatedStyle,
          ]}
          isInteractive={true}
        >
          <Blur {...blurProps}>
            <GestureDetector gesture={panGesture}>
              <Pressable style={styles.innerContent} onPress={handlePress}>
                <CardPeek shown={notExpanded} {...message} />
                {expandedChild && <CardHandle shown={notExpanded} />}
              </Pressable>
            </GestureDetector>
            {expandedChild && (
              <CardExpanded shown={hasExceededThreshold}>
                {expandedChild}
              </CardExpanded>
            )}
          </Blur>
        </Wrapper>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 24,
    zIndex: 999,
    borderCurve: "continuous",
    overflow: isLiquidGlass ? "visible" : "hidden",

    // top: TOP_OFFSET,
  },
  text: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  innerContent: {
    flex: 1,
    // paddingBottom: HANDLE_HEIGHT / 2,
  },
  expanded: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    borderCurve: "continuous",
    overflow: "hidden",
  },
});
