declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_DEV_AUTH?: string;
    EXPO_PUBLIC_DEMO_USER_ID?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
