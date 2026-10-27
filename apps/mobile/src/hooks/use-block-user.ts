import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { useNotify } from "@/components/notify";
import { useHaptics } from "@/hooks/use-haptics";
import { dealErrorMessage } from "@/lib/offers";
import { useSetBlocked } from "@/services/moderation.service";

type Person = { id: string; name: string };

/** Blocking asks first; unblocking doesn't. */
export function useBlockUser() {
  const { t } = useTranslation();
  const { notify } = useNotify();
  const { notification } = useHaptics();
  const setBlocked = useSetBlocked();

  const run = (person: Person, blocked: boolean, onDone?: () => void) =>
    setBlocked.mutate(
      { userId: person.id, blocked },
      {
        onSuccess: () => {
          notification("success");
          notify(
            t(blocked ? "moderation.youBlocked" : "moderation.youUnblocked", {
              name: person.name,
            }),
          );
          onDone?.();
        },
        onError: (error) => {
          notification("error");
          notify(t("moderation.notDone"), {
            description: dealErrorMessage(error),
          });
        },
      },
    );

  /** `onBlocked`: after it's done, e.g. leaving a listing now hidden. */
  const confirmBlock = (person: Person, onBlocked?: () => void) =>
    Alert.alert(
      t("moderation.blockTitle", { name: person.name }),
      t("moderation.blockBody", { name: person.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("moderation.blockConfirm"),
          style: "destructive",
          onPress: () => run(person, true, onBlocked),
        },
      ],
    );

  const unblock = (person: Person) => run(person, false);

  return { confirmBlock, unblock, isPending: setBlocked.isPending };
}
