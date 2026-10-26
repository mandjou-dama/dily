import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { colors } from "@/theme/colors";

export type Step = {
  title: string;
  detail?: string;
  /**
   * done: filled with a check; current: green ring; next: grey ring;
   * plain: filled with its number (instructions).
   */
  state: "done" | "current" | "next" | "plain";
};

/** Numbered steps joined by a line: what happens next, or what to do. */
function StepListBase({ steps }: { steps: Step[] }) {
  return (
    <View style={styles.list}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const filled = step.state === "done" || step.state === "plain";
        return (
          <View key={step.title} style={styles.step}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  filled && styles.dotFilled,
                  step.state === "current" && styles.dotCurrent,
                  step.state === "next" && styles.dotNext,
                ]}
              >
                {step.state === "done" ? (
                  <Check size={14} color={colors.white} strokeWidth={3} />
                ) : (
                  <Text
                    style={[
                      styles.number,
                      step.state === "plain" && styles.numberFilled,
                      step.state === "next" && styles.numberNext,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              {last ? null : (
                <View
                  style={[
                    styles.line,
                    step.detail ? styles.lineTall : null,
                    step.state === "done" && styles.lineDone,
                    step.state === "plain" && styles.linePlain,
                  ]}
                />
              )}
            </View>
            <View style={styles.text}>
              <Text
                style={[
                  styles.title,
                  step.state === "current" && styles.titleCurrent,
                  step.state === "done" && styles.titleDone,
                ]}
              >
                {step.title}
              </Text>
              {step.detail ? (
                <Text style={styles.detail}>{step.detail}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export const StepList = memo(StepListBase);

const DOT = 26;

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  step: {
    flexDirection: "row",
    gap: 12,
  },
  rail: {
    alignItems: "center",
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  dotFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    borderColor: colors.primary,
  },
  dotNext: {
    borderColor: colors.stepNext,
  },
  number: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  numberFilled: {
    color: colors.white,
  },
  numberNext: {
    color: colors.muted,
  },
  line: {
    width: 2,
    height: 22,
    backgroundColor: colors.divider,
  },
  lineTall: {
    height: 30,
  },
  lineDone: {
    backgroundColor: colors.primary,
  },
  linePlain: {
    backgroundColor: colors.noteLine,
  },
  text: {
    flex: 1,
    paddingTop: 3,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.black,
  },
  titleCurrent: {
    fontWeight: "600",
  },
  titleDone: {
    color: colors.muted,
  },
  detail: {
    fontSize: 13,
    color: colors.muted,
  },
});
