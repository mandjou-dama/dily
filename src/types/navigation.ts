export type AuthStackParamList = {
  Onboarding: any;
  Register: any;
  WhatsAppLogin: any;
  VerificationCode: any;
  UserInfos: any;
};

export type AppTabParamList = {
  Home: any;
  Sell: any;
  Chat: any;
  Profile: any;
};

export type RootStackParamList = {
  Auth: AuthStackParamList;
  App: AppTabParamList;
  // ProductDetails: { id: string };
};

export type GlobalStackParamList = RootStackParamList;
