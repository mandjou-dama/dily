// Xcode 27 rejects IPHONEOS_DEPLOYMENT_TARGET below 15.0, but some pods
// (e.g. SDWebImage, RNSVG resource bundles) still declare 9.0 / 12.4.
// This plugin raises every pod target to the app's minimum after `pod install`.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const MARKER = "# @dily/min-pod-deployment-target";

const withMinPodDeploymentTarget = (config, { minVersion = "15.1" } = {}) =>
  withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      if (!podfile.includes(MARKER)) {
        podfile = podfile.replace(
          /post_install do \|installer\|\n/,
          (match) =>
            match +
            `    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${minVersion}')
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${minVersion}'
        end
      end
    end
`,
        );
        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);

module.exports = withMinPodDeploymentTarget;
