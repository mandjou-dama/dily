import { ProfileForm } from "@/components/profile/profile-form";
import { colors } from "@/theme/colors";
import React from "react";
import { Text } from "react-native";

// Once the profile has a name, the root navigator swaps to the app
const UserInfosScreen = () => (
  <ProfileForm
    title={
      <>
        Tell us more{" "}
        <Text
          style={{
            color: colors.primary,
            textDecorationStyle: "solid",
            textDecorationLine: "underline",
          }}
        >
          about your
        </Text>{" "}
        person
      </>
    }
    submitLabel="Terminer"
  />
);

export default UserInfosScreen;
