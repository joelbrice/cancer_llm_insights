import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { useSettings } from "@/lib/settings";

type Icon = ComponentProps<typeof Ionicons>["name"];

export default function TabLayout() {
  const { colors, t } = useSettings();
  const tab = (title: string, icon: Icon, active: Icon) => ({
    title,
    tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
      <Ionicons name={focused ? active : icon} size={size} color={color} />
    ),
  });
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.ink2,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600", letterSpacing: -0.1 },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
    >
      <Tabs.Screen name="index" options={tab(t("navShort.home"), "home-outline", "home")} />
      <Tabs.Screen name="ask" options={tab(t("navShort.ask"), "chatbubble-ellipses-outline", "chatbubble-ellipses")} />
      <Tabs.Screen name="insights" options={tab(t("navShort.insights"), "sparkles-outline", "sparkles")} />
      <Tabs.Screen name="community" options={tab(t("navShort.community"), "people-outline", "people")} />
      <Tabs.Screen name="me" options={tab(t("navShort.me"), "person-circle-outline", "person-circle")} />
    </Tabs>
  );
}
