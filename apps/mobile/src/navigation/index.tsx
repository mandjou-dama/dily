import {
  createStaticNavigation,
  StaticParamList,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthNavigator } from "./AuthNavigator";
import { AppNavigator } from "./AppNavigator";
import { ProductDetailsScreen } from "../screens/product/ProductDetailsScreen";
import UserInfosScreen from "../screens/auth/UserInfosScreen";
import SearchScreen from "../screens/search/SearchScreen";
import EditProductScreen from "../screens/product/EditProductScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import { PayoutAccountScreen } from "../screens/profile/PayoutAccountScreen";
import { BlockedUsersScreen } from "../screens/profile/BlockedUsersScreen";
import { AcceptTermsScreen, TermsScreen } from "../screens/terms/TermsScreen";
import { ConversationScreen } from "../screens/chat/ConversationScreen";
import { CheckoutScreen } from "../screens/checkout/CheckoutScreen";
import { CheckoutPayScreen } from "../screens/checkout/CheckoutPayScreen";
import { PaymentPendingScreen } from "../screens/checkout/PaymentPendingScreen";
import { PaymentDoneScreen } from "../screens/checkout/PaymentDoneScreen";
import { NotFound } from "../screens/NotFound";
import {
  useIsSignedIn,
  useIsSignedOut,
  useNeedsProfile,
  useNeedsTerms,
} from "@/providers/auth-provider";

// The session picks the group: signing in or out swaps the screens, so no
// screen navigates to "App" or "Auth" by hand.
const RootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  groups: {
    SignedIn: {
      if: useIsSignedIn,
      screens: {
        App: {
          screen: AppNavigator,
          options: { title: "App" },
        },
        ProductDetails: {
          screen: ProductDetailsScreen,
          // dily://product/<uuid>, also what the share sheet sends
          linking: { path: "product/:id" },
        },
        EditProduct: {
          screen: EditProductScreen,
          options: { gestureEnabled: false },
        },
        Search: {
          screen: SearchScreen,
          options: { animation: "fade" },
        },
        EditProfile: {
          screen: EditProfileScreen,
        },
        // Where the seller receives what buyers paid
        PayoutAccount: {
          screen: PayoutAccountScreen,
        },
        BlockedUsers: {
          screen: BlockedUsersScreen,
        },
        Terms: {
          screen: TermsScreen,
        },
        Conversation: {
          screen: ConversationScreen,
          // dily://chat/<uuid>, also what a message notification opens
          linking: { path: "chat/:id" },
        },
        // Paying: pickup or delivery, then mobile money
        Checkout: {
          screen: CheckoutScreen,
        },
        CheckoutPay: {
          screen: CheckoutPayScreen,
        },
        PaymentPending: {
          screen: PaymentPendingScreen,
          // Leaving while the payer confirms goes through "Je n'ai rien reçu"
          options: { gestureEnabled: false },
        },
        PaymentDone: {
          screen: PaymentDoneScreen,
        },
      },
    },
    // Signed in, but the terms in force aren't accepted yet
    NeedsTerms: {
      if: useNeedsTerms,
      screens: {
        AcceptTerms: {
          screen: AcceptTermsScreen,
          options: { gestureEnabled: false },
        },
      },
    },
    // Signed in, but the profile has no name yet
    NeedsProfile: {
      if: useNeedsProfile,
      screens: {
        CompleteProfile: {
          screen: UserInfosScreen,
          options: { gestureEnabled: false },
        },
      },
    },
    SignedOut: {
      if: useIsSignedOut,
      screens: {
        Auth: {
          screen: AuthNavigator,
          options: { title: "Auth" },
        },
      },
    },
  },
  screens: {
    NotFound: {
      screen: NotFound,
      options: {
        title: "404",
        headerShown: true,
      },
      linking: {
        path: "*",
      },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);

type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
