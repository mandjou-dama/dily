import { ImageSourcePropType } from "react-native";

export type SpotlightPick = {
  id: string;
  name: string;
  price: string;
  seller: string;
  // Torn-paper photos shared with the onboarding, bundled locally
  image: ImageSourcePropType;
};

export const SpotlightPicks: SpotlightPick[] = [
  {
    id: "pick-1",
    name: "Canvas Tote Bag",
    price: "28 000",
    seller: "Sira Coulibaly",
    image: require("assets/onboarding_3.png"),
  },
  {
    id: "pick-2",
    name: "Leather Ankle Boots",
    price: "23 000",
    seller: "Aïcha Traoré",
    image: require("assets/onboarding_1.png"),
  },
  {
    id: "pick-3",
    name: "Leather Crossbody Bag",
    price: "35 000",
    seller: "Fatou Koné",
    image: require("assets/onboarding_2.png"),
  },
  {
    id: "pick-4",
    name: "Chronograph Watch",
    price: "40 000",
    seller: "Ibrahim Touré",
    image: require("assets/onboarding_4.png"),
  },
  {
    id: "pick-5",
    name: "Ceramic Hanging Planter",
    price: "32 000",
    seller: "Yacouba Sanogo",
    image: require("assets/onboarding_5.png"),
  },
];
