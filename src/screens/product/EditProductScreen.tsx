import { StyleSheet, Text, View } from "react-native";
import {
  type StaticScreenProps,
  useNavigation,
} from "@react-navigation/native";
import { ListingForm } from "@/components/sell/listing-form";
import { useNotify } from "@/components/notify";
import { Spinner } from "@/components/spinner";
import { useHaptics } from "@/hooks/use-haptics";
import { colors } from "@/theme/colors";
import { useUser } from "@/providers/auth-provider";
import { useProduct } from "@/services/products.service";
import { type ListingInput, useUpdateListing } from "@/services/sell.service";

type Props = StaticScreenProps<{ id: string }>;

export default function EditProductScreen({ route }: Props) {
  const { id } = route.params;
  const navigation = useNavigation();
  const user = useUser();
  const { notify } = useNotify();
  const { notification } = useHaptics();
  const { data: product, isPending } = useProduct(id);
  const updateListing = useUpdateListing();

  if (isPending) {
    return (
      <View style={styles.status}>
        <Spinner color={colors.primary} size={28} />
      </View>
    );
  }

  // RLS would refuse the update anyway; don't show a form that can't save
  if (!product || product.seller.id !== user.id) {
    return (
      <View style={styles.status}>
        <Text style={styles.statusText}>{"You can't edit this listing"}</Text>
      </View>
    );
  }

  const onSubmit = (input: ListingInput) =>
    updateListing.mutate(
      { id, input, previousPaths: product.imagePaths },
      {
        onSuccess: () => {
          notification("success");
          navigation.goBack();
        },
        onError: () => {
          notification("error");
          notify("Changes not saved", {
            description: "Check your connection and try again.",
          });
        },
      },
    );

  return (
    <ListingForm
      heading="Edit listing"
      submitLabel="Save changes"
      initialValues={{
        photos: product.imagePaths.map((path) => ({ kind: "stored", path })),
        title: product.title,
        description: product.description ?? "",
        categoryId: product.categoryId,
        size: product.size ?? "",
        condition: product.condition,
        price: String(product.price),
      }}
      isSubmitting={updateListing.isPending}
      progress={updateListing.progress}
      onSubmit={onSubmit}
      onClose={() => navigation.goBack()}
    />
  );
}

const styles = StyleSheet.create({
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  statusText: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.black,
  },
});
