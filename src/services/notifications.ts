import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set up how foreground notifications should behave
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  /**
   * Request push/local notification permissions from the system
   */
  async requestPermissions(): Promise<boolean> {
    try {
      console.log('[NotificationService] Checking notification permissions...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('[NotificationService] Permissions not granted. Requesting...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const granted = finalStatus === 'granted';
      console.log(`[NotificationService] Notification permission status: ${finalStatus} (granted: ${granted})`);
      
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('ucam_scraper_alerts', {
            name: 'UCAM Portal Scraper Updates',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6F00',
          });
        } catch (channelError) {
          console.warn('[NotificationService] Failed to set custom notification channel (expected in Expo Go):', channelError);
        }
      }

      return granted;
    } catch (error) {
      console.error('[NotificationService] Error requesting permissions:', error);
      return false;
    }
  },

  /**
   * Send a local notification immediately to the device
   */
  async triggerLocalNotification(title: string, body: string, data: Record<string, any> = {}): Promise<string | null> {
    try {
      console.log(`[NotificationService] Scheduling notification: "${title}" - "${body}"`);
      const permissionGranted = await this.requestPermissions();
      if (!permissionGranted) {
        console.warn('[NotificationService] Cannot send notification: Permissions not granted.');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null, // deliver immediately
      });

      console.log(`[NotificationService] Notification successfully triggered. ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('[NotificationService] Error triggering local notification:', error);
      return null;
    }
  }
};
