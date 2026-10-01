// iOS 27 asserts at launch unless the app adopts the UIScene life cycle.
// Expo ships `ExpoAppSceneDelegate` for this, but the prebuild template still
// starts React Native from the app delegate. This plugin:
// - declares the scene manifest pointing at `EXExpoAppSceneDelegate`
// - makes AppDelegate an `ExpoReactNativeFactoryProvider`
// - lets the scene delegate create the window and start React Native
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const START_RN_BLOCK =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

const withSceneLifecycle = (config) => {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return config;
  });

  config = withAppDelegate(config, (config) => {
    if (config.modResults.language !== "swift") {
      throw new Error("with-scene-lifecycle only supports a Swift AppDelegate");
    }
    let src = config.modResults.contents;

    if (!src.includes("ExpoReactNativeFactoryProvider")) {
      const declaration = "class AppDelegate: ExpoAppDelegate {";
      if (!src.includes(declaration)) {
        throw new Error(
          "with-scene-lifecycle: AppDelegate declaration not found",
        );
      }
      src = src.replace(
        declaration,
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
      );
    }

    if (START_RN_BLOCK.test(src)) {
      src = src.replace(
        START_RN_BLOCK,
        "\n    // The window is created by ExpoAppSceneDelegate (UIScene life cycle).\n",
      );
    } else if (src.includes("factory.startReactNative(")) {
      throw new Error(
        "with-scene-lifecycle: startReactNative block not recognized",
      );
    }

    config.modResults.contents = src;
    return config;
  });

  return config;
};

module.exports = withSceneLifecycle;
