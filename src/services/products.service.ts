import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

type Variables = {
  productId: string;
  currentlyLiked: boolean;
};

export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, currentlyLiked }: Variables) => {
      if (currentlyLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("product_id", productId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ product_id: productId });

        if (error) throw error;
      }
    },

    onMutate: async ({ productId, currentlyLiked }) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["products"] });

      // 2. Snapshot previous value
      const previousProducts = queryClient.getQueryData<any[]>(["products"]);

      // 3. Optimistically update
      queryClient.setQueryData(["products"], (old: any[] | undefined) => {
        if (!old) return old;

        return old.map((product) =>
          product.id === productId
            ? {
                ...product,
                likedByMe: !currentlyLiked,
                likesCount: currentlyLiked
                  ? product.likesCount - 1
                  : product.likesCount + 1,
              }
            : product
        );
      });

      // 4. Return context for rollback
      return { previousProducts };
    },

    onError: (_error, _variables, context) => {
      // 5. Rollback on failure
      if (context?.previousProducts) {
        queryClient.setQueryData(["products"], context.previousProducts);
      }
    },

    onSettled: () => {
      // 6. Always refetch to stay in sync
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
