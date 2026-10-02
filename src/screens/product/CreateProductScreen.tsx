import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { ListingForm } from "@/components/sell/listing-form";
import { useNotify } from "@/components/notify";
import { useHaptics } from "@/hooks/use-haptics";
import { type ListingInput, useCreateListing } from "@/services/sell.service";

export const CreateProductScreen = () => {
  const navigation = useNavigation();
  const { notify } = useNotify();
  const { notification } = useHaptics();
  const createListing = useCreateListing();

  // A new key gives the next listing a blank form
  const [formKey, setFormKey] = useState(0);

  const onSubmit = (input: ListingInput) =>
    createListing.mutate(input, {
      onSuccess: (id) => {
        notification("success");
        setFormKey((key) => key + 1);
        navigation.navigate("ProductDetails", { id });
      },
      onError: () => {
        notification("error");
        notify("Listing not published", {
          description: "Check your connection and try again.",
        });
      },
    });

  return (
    <ListingForm
      key={formKey}
      heading="Sell an item"
      submitLabel="Publish listing"
      isSubmitting={createListing.isPending}
      progress={createListing.progress}
      onSubmit={onSubmit}
    />
  );
};
