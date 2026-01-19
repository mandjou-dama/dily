import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { ProductData } from "@/mock/products";
import { MessageType } from "@/components/notify/type";
import { useNotify } from "@/components/notify";

export const PRODUCTS_QUERY_KEY = ["products"];
export const TEST_USER_ID = "test-user-1";

type ToggleLikeVars = {
  productId: string;
  currentlyLiked: boolean;
  userId: string;
};

export function useToggleLike() {
  const queryClient = useQueryClient();
  const { notify } = useNotify();

  return useMutation({
    mutationFn: async ({ productId, currentlyLiked }: ToggleLikeVars) => {
      if (currentlyLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("product_id", productId)
          .eq("user_id", TEST_USER_ID);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({
          product_id: productId,
          user_id: TEST_USER_ID,
        });

        if (error) throw error;
      }
    },

    onMutate: async ({ productId, currentlyLiked }) => {
      await queryClient.cancelQueries({ queryKey: PRODUCTS_QUERY_KEY });

      const previousProducts =
        queryClient.getQueryData<typeof ProductData>(PRODUCTS_QUERY_KEY);

      queryClient.setQueryData<typeof ProductData>(
        PRODUCTS_QUERY_KEY,
        (old) => {
          if (!old) return old;

          return old.map((item) =>
            item.id.toString() === productId
              ? {
                  ...item,
                  like: {
                    liked: !currentlyLiked,
                    number: currentlyLiked
                      ? Math.max(0, item.like.number - 1)
                      : item.like.number + 1,
                  },
                }
              : item
          );
        }
      );

      return { previousProducts };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(PRODUCTS_QUERY_KEY, context.previousProducts);
      }
      notify(notifPayload.text, notifPayload.options);
    },

    onSettled: () => {
      // No refetch needed since products are mocked
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => ProductData,
    initialData: ProductData,
  });
}

const notifPayload: MessageType = {
  text: "Ouupsss",
  options: {
    description: "Something went wrong. Try again.",
    action: {
      label: "OK",
      onClick: () => {
        console.log("Notification action clicked");
      },
    },
  },
};
