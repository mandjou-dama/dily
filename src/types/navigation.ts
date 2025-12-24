export type AuthStackParamList = {
  Onboarding: undefined;
  Register: undefined;
  WhatsAppLogin: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Sell: undefined;
  Chat: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
  ProductDetails: { id: string };
};
