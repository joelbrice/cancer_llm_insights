import type { ReminderPrefs } from "@stepwell/shared";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const ID = "weekly-check-in";
const CHANNEL = "reminders";

/** Local notifications only: scheduled on the device, never through a server. Not available on the web build. */
export const remindersSupported = Platform.OS === "ios" || Platform.OS === "android";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Schedules (or replaces) the weekly reminder. Resolves false when the person declined notifications. */
export async function scheduleWeeklyReminder(prefs: ReminderPrefs, content: { title: string; body: string; channel: string }): Promise<boolean> {
  if (!remindersSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  if (!granted) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: content.channel, importance: Notifications.AndroidImportance.DEFAULT });
  }
  await cancelWeeklyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: content.title, body: content.body, data: { url: "/plan" } },
    // Expo counts weekdays from Sunday = 1; ours are ISO (Monday = 1 … Sunday = 7)
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: (prefs.weekday % 7) + 1,
      hour: prefs.hour,
      minute: prefs.minute,
      channelId: CHANNEL,
    },
  });
  return true;
}

export async function cancelWeeklyReminder(): Promise<void> {
  if (!remindersSupported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(ID);
  } catch {
    /* nothing scheduled */
  }
}
