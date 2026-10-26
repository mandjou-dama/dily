import { View } from "react-native";
import { TabItem } from "./tab-item";
import { TabIndicator } from "./tab-indicator";
import { SharedValue } from "react-native-reanimated";

// threads-home-header-tabs-animation 🔽

// Horizontal padding ensures tabs don't touch screen edges
// Also used in TabIndicator for precise positioning calculations
const TABS_HORIZONTAL_PADDING = 16;

// Fixed height: the home list reserves exactly this space for the pinned bar
export const TOP_TABS_HEIGHT = 44;

type Props = {
  tabNames: readonly string[];
  // Animated (fractional) index of the selected tab, drives colors and indicator
  indexDecimal: SharedValue<number>;
  onTabPress: (name: string) => void;
};

export function TopTabs({ tabNames, indexDecimal, onTabPress }: Props) {
  return (
    <View style={{ height: TOP_TABS_HEIGHT }}>
      {/* Tab items fill the bar; the 1px indicator sits under them */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: TABS_HORIZONTAL_PADDING,
          flexDirection: "row",
        }}
      >
        {tabNames.map((tab, index) => {
          return (
            <TabItem
              key={tab}
              index={index}
              tabName={tab}
              indexDecimal={indexDecimal} // Shared animated value drives color transitions
              onPress={() => {
                onTabPress(tab); // Triggers tab switch and animated indicator movement
              }}
            />
          );
        })}
      </View>
      {/* Animated indicator positioned below tabs, synchronized with indexDecimal */}
      <TabIndicator
        indexDecimal={indexDecimal} // Same shared value ensures perfect sync with tab transitions
        numberOfTabs={tabNames.length} // Required for width calculations
        tabsHorizontalPadding={TABS_HORIZONTAL_PADDING} // Maintains consistent spacing
      />
    </View>
  );
}

// threads-home-header-tabs-animation 🔼
