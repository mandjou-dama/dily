import { type ReactNode, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { formatPrice } from "@/lib/format";
import { Spinner } from "@/components/spinner";
import { PhotoStrip } from "@/components/sell/photo-strip";
import {
  CONDITION_LABELS,
  type ProductCondition,
} from "@/services/products.service";
import {
  type ListingInput,
  type ListingPhoto,
  type UploadProgress,
  useCategories,
} from "@/services/sell.service";

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;
const SIZE_MAX = 20;
// Whole F CFA: no item on Dily sells below 100 F
const PRICE_MIN = 100;
const PRICE_MAX = 50_000_000;

const CONDITIONS = Object.keys(CONDITION_LABELS) as ProductCondition[];

export type ListingFormValues = {
  photos: ListingPhoto[];
  title: string;
  description: string;
  categoryId: number | null;
  size: string;
  condition: ProductCondition | null;
  // Digits only; shown with spaces
  price: string;
};

export const EMPTY_LISTING: ListingFormValues = {
  photos: [],
  title: "",
  description: "",
  categoryId: null,
  size: "",
  condition: null,
  price: "",
};

type Errors = Partial<Record<keyof ListingFormValues, string>>;

function validate(values: ListingFormValues): Errors {
  const errors: Errors = {};
  const price = Number(values.price);

  if (values.photos.length === 0) errors.photos = "Add at least one photo.";
  if (values.title.trim().length < TITLE_MIN) {
    errors.title = "Give your item a title of at least 3 letters.";
  }
  if (values.categoryId === null) errors.categoryId = "Pick a category.";
  if (values.condition === null) errors.condition = "Pick the condition.";
  if (!values.price) {
    errors.price = "Set a price.";
  } else if (price < PRICE_MIN || price > PRICE_MAX) {
    errors.price = `Between ${formatPrice(PRICE_MIN)} and ${formatPrice(PRICE_MAX)} F CFA.`;
  }
  return errors;
}

type Props = {
  heading: string;
  submitLabel: string;
  initialValues?: ListingFormValues;
  isSubmitting: boolean;
  progress: UploadProgress | null;
  onSubmit: (input: ListingInput) => void;
  // Edit opens as a pushed screen: it needs a way back
  onClose?: () => void;
};

export function ListingForm({
  heading,
  submitLabel,
  initialValues = EMPTY_LISTING,
  isSubmitting,
  progress,
  onSubmit,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { data: categories } = useCategories();

  const [values, setValues] = useState(initialValues);
  // Errors appear after the first attempt, then update as the user fixes them
  const [showErrors, setShowErrors] = useState(false);
  const errors = showErrors ? validate(values) : {};

  const set = <K extends keyof ListingFormValues>(
    key: K,
    value: ListingFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    setShowErrors(true);
    if (Object.keys(validate(values)).length > 0) return;

    onSubmit({
      photos: values.photos,
      title: values.title,
      description: values.description,
      categoryId: values.categoryId!,
      size: values.size,
      condition: values.condition!,
      price: Number(values.price),
    });
  };

  const buttonLabel = progress
    ? progress.total > 0
      ? `Uploading photos ${Math.min(progress.done + 1, progress.total)}/${progress.total}…`
      : "Saving…"
    : isSubmitting
      ? "Saving…"
      : submitLabel;

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 32,
        }}
      >
        <View style={styles.header}>
          {onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.back}
            >
              <ArrowLeft size={22} color={colors.black} strokeWidth={1.8} />
            </Pressable>
          ) : null}
          <Text style={styles.heading} accessibilityRole="header">
            {heading}
          </Text>
        </View>

        <PhotoStrip
          photos={values.photos}
          onChange={(photos) => set("photos", photos)}
          hasError={!!errors.photos}
        />

        <View style={styles.sections}>
          <Section>
            <Field label="Title" error={errors.title}>
              <Input
                value={values.title}
                onChangeText={(text) => set("title", text)}
                placeholder="Vintage denim jacket"
                maxLength={TITLE_MAX}
                autoCapitalize="sentences"
                returnKeyType="next"
              />
            </Field>
            <Divider />
            <Field
              label="Description"
              hint={`${values.description.length}/${DESCRIPTION_MAX}`}
            >
              <Input
                value={values.description}
                onChangeText={(text) => set("description", text)}
                placeholder="Size, fit, flaws, why you're selling…"
                maxLength={DESCRIPTION_MAX}
                multiline
                style={styles.multiline}
              />
            </Field>
          </Section>

          <Section>
            <Field label="Category" error={errors.categoryId}>
              <View style={styles.chips}>
                {categories?.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={values.categoryId === category.id}
                    onPress={() => set("categoryId", category.id)}
                  />
                )) ?? <Spinner color={colors.primary} />}
              </View>
            </Field>
            <Divider />
            <Field label="Size" hint="Optional">
              <Input
                value={values.size}
                onChangeText={(text) => set("size", text)}
                placeholder="M, 42, One size…"
                maxLength={SIZE_MAX}
                autoCapitalize="characters"
              />
            </Field>
            <Divider />
            <Field label="Condition" error={errors.condition}>
              <View style={styles.chips}>
                {CONDITIONS.map((condition) => (
                  <Chip
                    key={condition}
                    label={CONDITION_LABELS[condition]}
                    selected={values.condition === condition}
                    onPress={() => set("condition", condition)}
                  />
                ))}
              </View>
            </Field>
          </Section>

          <Section>
            <Field label="Price" error={errors.price}>
              <View style={styles.priceRow}>
                <Input
                  value={values.price ? formatPrice(Number(values.price)) : ""}
                  onChangeText={(text) =>
                    set("price", text.replace(/\D/g, "").slice(0, 9))
                  }
                  placeholder="0"
                  keyboardType="number-pad"
                  style={styles.priceInput}
                  accessibilityLabel="Price in F CFA"
                />
                <Text style={styles.currency}>F CFA</Text>
              </View>
            </Field>
          </Section>
        </View>
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.footer,
          // In the Sell tab the tab bar already sits below the footer
          { paddingBottom: onClose ? Math.max(insets.bottom, 16) : 12 },
        ]}
      >
        <Pressable
          onPress={submit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityState={{ busy: isSubmitting }}
          style={({ pressed }) => [
            styles.submit,
            (pressed || isSubmitting) && styles.submitPressed,
          ]}
        >
          {isSubmitting ? <Spinner color={colors.white} size={18} /> : null}
          <Text style={styles.submitText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const Section = ({ children }: { children: ReactNode }) => (
  <View style={styles.section}>{children}</View>
);

const Divider = () => <View style={styles.divider} />;

const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) => (
  <View style={styles.field}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
    {children}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>
);

const Input = ({ style, ...props }: TextInputProps) => (
  <TextInput
    placeholderTextColor="#9A978C"
    style={[styles.input, style]}
    {...props}
  />
);

const Chip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    style={[styles.chip, selected && styles.chipSelected]}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  back: {
    width: 44,
    height: 44,
    marginLeft: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: colors.primary,
  },
  sections: {
    marginTop: 22,
    paddingHorizontal: 16,
    gap: 14,
  },
  section: {
    paddingHorizontal: 16,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E2DED2",
  },
  field: {
    paddingVertical: 14,
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5A5A52",
  },
  hint: {
    fontSize: 12,
    color: "#8A877C",
    fontVariant: ["tabular-nums"],
  },
  error: {
    fontSize: 12,
    color: colors.danger,
  },
  input: {
    fontSize: 16,
    color: colors.black,
    paddingVertical: 2,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#F1EFE6",
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2F4420",
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  currency: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5A5A52",
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2DED2",
  },
  submit: {
    height: 54,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.primary,
  },
  submitPressed: {
    opacity: 0.8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
  },
});
