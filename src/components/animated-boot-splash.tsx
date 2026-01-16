import { useState } from "react";
import { Animated, Dimensions, Platform } from "react-native";
import BootSplash from "react-native-bootsplash";

const useNativeDriver = Platform.OS !== "web";

type Props = {
  onAnimationEnd: () => void;
};

export const AnimatedBootSplash = ({ onAnimationEnd }: Props) => {
  const [translateX] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(0));
  const [scale] = useState(new Animated.Value(1));
  const [opacity] = useState(new Animated.Value(1));

  const { container, logo } = BootSplash.useHideAnimation({
    manifest: require("../../assets/bootsplash/manifest.json"),
    logo: require("../../assets/bootsplash/logo.png"),
    darkLogo: require("../../assets/bootsplash/logo.png"),

    animate: () => {
      const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

      if (!logo.style) {
        return;
      }

      const rawLogoWidth = (logo.style as any)?.width;
      const SPLASH_LOGO_WIDTH =
        typeof rawLogoWidth === "number"
          ? rawLogoWidth
          : typeof rawLogoWidth === "string"
            ? parseFloat(rawLogoWidth) || 200
            : 200;

      const targetTranslateX = 16 + 70 / 2 - SCREEN_W / 2;

      const targetTranslateY = 3 + 44 + 39.33 / 2 - SCREEN_H / 2; // 44 = safe area top

      const targetScale = 70 / SPLASH_LOGO_WIDTH;

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: targetTranslateX,
          useNativeDriver,
        }),
        Animated.spring(translateY, {
          toValue: targetTranslateY + 20.5,
          useNativeDriver,
        }),
        Animated.spring(scale, {
          toValue: targetScale,
          useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          delay: 350,
          duration: 100,
          useNativeDriver,
        }),
      ]).start(onAnimationEnd);
    },
  });

  return (
    <Animated.View {...container} style={[container.style, { opacity }]}>
      <Animated.Image
        {...logo}
        style={[
          logo.style,
          {
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}
      />
    </Animated.View>
  );
};

// import { useState } from "react";
// import { Animated, Dimensions, Platform } from "react-native";
// import BootSplash from "react-native-bootsplash";

// const useNativeDriver = Platform.OS !== "web";

// type Props = {
//   onAnimationEnd: () => void;
// };

// export const AnimatedBootSplash = ({ onAnimationEnd }: Props) => {
//   const [opacity] = useState(() => new Animated.Value(1));
//   const [translateY] = useState(() => new Animated.Value(0));
//   const [brandOpacity] = useState(() => new Animated.Value(1));

//   const { container, logo, brand } = BootSplash.useHideAnimation({
//     manifest: require("../../assets/bootsplash/manifest.json"),

//     logo: require("../../assets/bootsplash/logo.png"),
//     darkLogo: require("../../assets/bootsplash/logo.png"),
//     // brand: require("../../assets/bootsplash/brand.png"),
//     // darkBrand: require("../../assets/bootsplash/brand.png"),

//     // statusBarTranslucent: true,
//     // navigationBarTranslucent: true,

//     animate: () => {
//       const { height } = Dimensions.get("window");

//       Animated.stagger(250, [
//         Animated.spring(translateY, {
//           useNativeDriver,
//           toValue: -50,
//         }),
//         Animated.spring(translateY, {
//           useNativeDriver,
//           toValue: -400,
//         }),
//       ]).start();

//       Animated.timing(opacity, {
//         useNativeDriver,
//         toValue: 0,
//         duration: 150,
//         delay: 350,
//       }).start(() => {
//         onAnimationEnd();
//       });
//     },
//   });

//   return (
//     <Animated.View {...container} style={[container.style, { opacity }]}>
//       <Animated.Image
//         {...logo}
//         style={[logo.style, { transform: [{ translateY }] }]}
//       />

//       {/* <Animated.Image
//         {...brand}
//         style={[brand.style, { opacity: brandOpacity }]}
//       /> */}
//     </Animated.View>
//   );
// };
