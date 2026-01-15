import {
  createStaticNavigation,
  StaticParamList,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthNavigator } from "./AuthNavigator";
import { AppNavigator } from "./AppNavigator";
import { ProductDetailsScreen } from "./screens/product/ProductDetailsScreen";
import { NotFound } from "./screens/NotFound";

const RootStack = createNativeStackNavigator({
  screens: {
    App: {
      screen: AppNavigator,
      options: {
        title: "App",
        headerShown: false,
      },
    },
    Auth: {
      screen: AuthNavigator,
      options: {
        title: "Auth",
        headerShown: false,
      },
    },

    ProductDetails: {
      screen: ProductDetailsScreen,
      options: ({ navigation }) => ({
        presentation: "modal",
        headerShown: false,
      }),
    },
    NotFound: {
      screen: NotFound,
      options: {
        title: "404",
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
