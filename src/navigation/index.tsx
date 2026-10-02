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
import { NotFound } from "../screens/NotFound";
import {
  useIsSignedIn,
  useIsSignedOut,
  useNeedsProfile,
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
        Search: {
          screen: SearchScreen,
          options: { animation: "fade" },
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
