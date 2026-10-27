import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  type CSSAnimationKeyframes,
  cubicBezier,
  useReducedMotion,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";

// The native splash draws assets/splash-icon-light.png (1024 px) 210 pt wide,
// centered. The word and its dot are cut from that same image, so the swap
// cannot show: assets/splash/logo-body.png is its logo box without the dot.
const PX = 210 / 1024;
const MARK_BOX = { x: 117, y: 346, width: 794, height: 332 };
// assets/splash/logo-dot.png, placed in the logo box
const DOT_BOX = { x: 332, y: 22, width: 62, height: 60 };
const JUMP = 0.26 * MARK_BOX.width * PX;

// The "F′" timeline of the design canvas, in ms from the start of the animation
const DURATION = 1200;
const IMPACT = 450; // the dot lands back on the i
const FADE = 200; // with reduce motion on, the splash only fades out
// Once the native splash is hidden, a beat for it to be gone and the first
// screen drawn, or the start of the jump would be lost
const HANDOFF = 150;

type Keyframe = CSSAnimationKeyframes[string];

const timeline = (steps: [number, Keyframe][]): CSSAnimationKeyframes =>
  Object.fromEntries(steps.map(([ms, frame]) => [ms / DURATION, frame]));

// The curve runs from this keyframe to the next one, as in CSS
const eased = (frame: Keyframe, curve?: ReturnType<typeof cubicBezier>) =>
  curve ? { ...frame, animationTimingFunction: curve } : frame;

// `lift` is a share of the jump height
const dot = (lift: number, tilt: number, scaleX: number, scaleY: number) => ({
  transform: [
    { translateY: -lift * JUMP },
    { rotate: `${tilt}deg` },
    { scaleX },
    { scaleY },
  ],
});
const word = (scaleX: number, scaleY: number) => ({
  transform: [{ scaleX }, { scaleY }],
});
const breath = (scale: number, opacity: number) => ({
  transform: [{ scale }],
  opacity,
});

const HOP = timeline([
  [0, eased(dot(0, 0, 1, 1), cubicBezier(0.45, 0, 0.55, 1))],
  // Crouches, takes off stretched, is round again and tilted at the top
  [100, eased(dot(0, 0, 1.24, 0.74), cubicBezier(0.3, 0.7, 0.5, 1))],
  [145, eased(dot(0.32, -3, 0.82, 1.22), cubicBezier(0.2, 0.6, 0.4, 1))],
  [300, eased(dot(1, -10, 1, 1), cubicBezier(0.6, 0, 0.9, 0.45))],
  // Lands, squashes, settles
  [IMPACT, eased(dot(0, 0, 0.86, 1.16), cubicBezier(0.2, 0.7, 0.4, 1))],
  [500, eased(dot(0, 0, 1.32, 0.66), cubicBezier(0.3, 0, 0.3, 1))],
  [570, eased(dot(0, 0, 0.95, 1.06), cubicBezier(0.4, 0, 0.6, 1))],
  [640, dot(0, 0, 1, 1)],
  [DURATION, dot(0, 0, 1, 1)],
]);

// The word bends a little under the dot's push, then takes its landing
const PRESS = timeline([
  [0, eased(word(1, 1), cubicBezier(0.45, 0, 0.55, 1))],
  [100, eased(word(1.012, 0.972), cubicBezier(0.25, 0.7, 0.4, 1))],
  [180, eased(word(0.997, 1.01), cubicBezier(0.4, 0, 0.6, 1))],
  [260, word(1, 1)],
  [IMPACT, eased(word(1, 1), cubicBezier(0.2, 0.7, 0.4, 1))],
  [500, eased(word(1.04, 0.91), cubicBezier(0.3, 0, 0.3, 1))],
  [610, word(1, 1)],
  [DURATION, word(1, 1)],
]);

// The logo gathers itself, holds its breath, then breathes out and fades
const BREATH = timeline([
  [0, breath(1, 1)],
  [470, eased(breath(1, 1), cubicBezier(0.25, 0.6, 0.35, 1))],
  [610, breath(0.92, 1)],
  [680, eased(breath(0.92, 1), cubicBezier(0.32, 0, 0.2, 1))],
  [1060, breath(1.55, 0)],
  [DURATION, breath(1.55, 0)],
]);

const COVER = timeline([
  [0, { opacity: 1 }],
  [720, eased({ opacity: 1 }, cubicBezier(0.3, 0, 0.2, 1))],
  [1080, { opacity: 0 }],
  [DURATION, { opacity: 0 }],
]);

// The app settles underneath while the logo breathes out
const APP = timeline([
  [0, { transform: [{ scale: 1.04 }] }],
  [680, eased({ transform: [{ scale: 1.04 }] }, cubicBezier(0.2, 0.6, 0.3, 1))],
  [DURATION, { transform: [{ scale: 1 }] }],
]);

const FADE_OUT = { from: { opacity: 1 }, to: { opacity: 0 } };

type Props = {
  /** The first screen is ready: the native splash hides and the animation plays. */
  ready: boolean;
  children: ReactNode;
};

/**
 * Takes over from the native splash, drawn the same: the dot of the i jumps,
 * the logo breathes out and the app settles underneath.
 */
export function AnimatedSplash({ ready, children }: Props) {
  const reduceMotionSetting = useReducedMotion();
  // Read once: the animation does not switch style halfway
  const [reduceMotion] = useState(reduceMotionSetting);
  const [phase, setPhase] = useState<"waiting" | "playing" | "done">("waiting");
  // Both pieces of the logo must be drawn before the native splash goes. One
  // that fails counts too: the app must not stay behind the splash
  const [loaded, setLoaded] = useState(0);
  const onLoad = () => setLoaded((n) => n + 1);
  const canStart = ready && loaded >= 2;

  useEffect(() => {
    if (!canStart) return;
    // Nothing changes on screen: the overlay looks exactly like the native splash
    SplashScreen.hide();

    const length = reduceMotion ? FADE : DURATION;
    const timers = [
      setTimeout(() => setPhase("playing"), HANDOFF),
      setTimeout(() => setPhase("done"), HANDOFF + length),
    ];
    if (!reduceMotion) {
      timers.push(
        setTimeout(
          () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
          HANDOFF + IMPACT,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [canStart, reduceMotion]);

  const animated = phase === "playing" && !reduceMotion;
  const play = (keyframes: CSSAnimationKeyframes) =>
    animated
      ? {
          animationName: keyframes,
          animationDuration: DURATION,
          animationTimingFunction: "linear" as const,
          animationFillMode: "both" as const,
        }
      : null;

  return (
    <>
      <Animated.View
        style={[
          styles.fill,
          phase === "waiting" && !reduceMotion && styles.zoomed,
          play(APP),
        ]}
      >
        {children}
      </Animated.View>

      {phase !== "done" && (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            StyleSheet.absoluteFill,
            phase === "playing" &&
              reduceMotion && {
                animationName: FADE_OUT,
                animationDuration: FADE,
                animationFillMode: "both",
              },
          ]}
        >
          <Animated.View style={[styles.cover, play(COVER)]} />
          <View style={styles.center}>
            <View style={styles.splashImage}>
              <Animated.View style={[styles.mark, play(BREATH)]}>
                <Animated.View style={[styles.word, play(PRESS)]}>
                  <Image
                    source={require("assets/splash/logo-body.png")}
                    style={styles.body}
                    fadeDuration={0}
                    onLoad={onLoad}
                    onError={onLoad}
                  />
                  <Animated.View style={[styles.dot, play(HOP)]}>
                    <Image
                      source={require("assets/splash/logo-dot.png")}
                      style={styles.dotImage}
                      fadeDuration={0}
                      onLoad={onLoad}
                      onError={onLoad}
                    />
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Where the app starts from, hidden under the splash
  zoomed: { transform: [{ scale: 1.04 }] },
  cover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  splashImage: { width: 1024 * PX, height: 1024 * PX },
  mark: {
    position: "absolute",
    left: MARK_BOX.x * PX,
    top: MARK_BOX.y * PX,
    width: MARK_BOX.width * PX,
    height: MARK_BOX.height * PX,
  },
  // Bends on its baseline, at 72% of the logo's height
  word: { flex: 1, transformOrigin: "50% 72%" },
  // Sized outright: stretched, the images go back to their pixel size once
  // the animation starts
  body: { width: MARK_BOX.width * PX, height: MARK_BOX.height * PX },
  dot: {
    position: "absolute",
    left: DOT_BOX.x * PX,
    top: DOT_BOX.y * PX,
    transformOrigin: "50% 100%",
  },
  dotImage: { width: DOT_BOX.width * PX, height: DOT_BOX.height * PX },
});
