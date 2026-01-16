import { View } from "react-native";
import { TabItem } from "./tab-item";
import { TabIndicator } from "./tab-indicator";
import { TabBarProps } from "react-native-collapsible-tab-view";
import { spacing } from "@/theme/spacing";

// threads-home-header-tabs-animation 🔽

// Horizontal padding ensures tabs don't touch screen edges
// Also used in TabIndicator for precise positioning calculations
const TABS_HORIZONTAL_PADDING = 16;

type Props = TabBarProps<string>; // Generic TabBarProps from react-native-collapsible-tab-view

export function TopTabs({ tabNames, indexDecimal, onTabPress }: Props) {
  return (
    <View>
      {/* Tab items container with bottom padding for visual spacing above indicator */}
      <View
        // className="flex-row pb-2"
        style={{
          paddingHorizontal: TABS_HORIZONTAL_PADDING,
          flexDirection: "row",
          paddingBottom: spacing.sm + 5,
          paddingTop: spacing.sm,
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
