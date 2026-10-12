import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SyncAgent } from "@/components/personal";
import { WelcomeNotice } from "@/components/WelcomeNotice";
import { SettingsProvider, useSettings } from "@/lib/settings";

void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { colors, scheme, t } = useSettings();
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.brand,
          headerTitleStyle: { color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="insight/[id]" options={{ title: t("insights.title") }} />
        <Stack.Screen name="document/[id]" options={{ title: t("library.title") }} />
        <Stack.Screen name="library" options={{ title: t("library.title") }} />
        <Stack.Screen name="plan" options={{ title: t("plan.title") }} />
        <Stack.Screen name="profile" options={{ title: t("profile.title") }} />
        <Stack.Screen name="methodology" options={{ title: t("nav.methodology") }} />
        <Stack.Screen name="check" options={{ title: t("check.title") }} />
        <Stack.Screen name="community/[id]" options={{ title: t("community.title") }} />
        <Stack.Screen name="guidelines" options={{ title: t("community.guidelinesTitle") }} />
        <Stack.Screen name="appointment" options={{ title: t("nav.appointment") }} />
        <Stack.Screen name="transparency" options={{ title: t("transparency.title") }} />
      </Stack>
      <WelcomeNotice />
      <SyncAgent />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <Navigator />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
