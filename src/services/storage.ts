import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_STUDENT_ID = 'ucam_student_id';
const KEY_PASSWORD = 'ucam_password';
const KEY_COOKIE = 'ucam_session_cookie';

const KEY_NOTICE_STATE = 'ucam_notice_state';
const KEY_GRADE_STATE = 'ucam_grade_state';
const KEY_LAST_RUN = 'ucam_last_run';
const KEY_SCRAPER_LOGS = 'ucam_scraper_logs';

export interface ScraperLog {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export const StorageService = {
  // --- SecureStore: Credentials ---
  async saveCredentials(studentId: string, password: string): Promise<void> {
    try {
      console.log('[StorageService] Saving credentials securely...');
      await SecureStore.setItemAsync(KEY_STUDENT_ID, studentId);
      await SecureStore.setItemAsync(KEY_PASSWORD, password);
      console.log('[StorageService] Credentials saved successfully.');
    } catch (error) {
      console.error('[StorageService] Error saving credentials:', error);
      throw error;
    }
  },

  async getCredentials(): Promise<{ studentId: string; password: string } | null> {
    try {
      const studentId = await SecureStore.getItemAsync(KEY_STUDENT_ID);
      const password = await SecureStore.getItemAsync(KEY_PASSWORD);
      if (studentId && password) {
        return { studentId, password };
      }
      return null;
    } catch (error) {
      console.error('[StorageService] Error reading credentials:', error);
      return null;
    }
  },

  async deleteCredentials(): Promise<void> {
    try {
      console.log('[StorageService] Deleting credentials securely...');
      await SecureStore.deleteItemAsync(KEY_STUDENT_ID);
      await SecureStore.deleteItemAsync(KEY_PASSWORD);
      console.log('[StorageService] Credentials deleted.');
    } catch (error) {
      console.error('[StorageService] Error deleting credentials:', error);
    }
  },

  // --- SecureStore: Cookies ---
  async saveCookie(cookie: string): Promise<void> {
    try {
      console.log('[StorageService] Saving session cookie securely...');
      await SecureStore.setItemAsync(KEY_COOKIE, cookie);
      console.log('[StorageService] Session cookie saved.');
    } catch (error) {
      console.error('[StorageService] Error saving cookie:', error);
      throw error;
    }
  },

  async getCookie(): Promise<string | null> {
    try {
      const cookie = await SecureStore.getItemAsync(KEY_COOKIE);
      return cookie;
    } catch (error) {
      console.error('[StorageService] Error reading cookie:', error);
      return null;
    }
  },

  async deleteCookie(): Promise<void> {
    try {
      console.log('[StorageService] Deleting session cookie...');
      await SecureStore.deleteItemAsync(KEY_COOKIE);
      console.log('[StorageService] Cookie deleted.');
    } catch (error) {
      console.error('[StorageService] Error deleting cookie:', error);
    }
  },

  // --- AsyncStorage: Notice State ---
  async saveNoticeState(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_NOTICE_STATE, JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving notice state:', error);
    }
  },

  async getNoticeState(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem(KEY_NOTICE_STATE);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading notice state:', error);
      return null;
    }
  },

  // --- AsyncStorage: Grade State ---
  async saveGradeState(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY_GRADE_STATE, JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving grade state:', error);
    }
  },

  async getGradeState(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem(KEY_GRADE_STATE);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading grade state:', error);
      return null;
    }
  },

  // --- AsyncStorage: Last Run Metadata ---
  async saveLastRunTimestamp(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      await AsyncStorage.setItem(KEY_LAST_RUN, timestamp);
    } catch (error) {
      console.error('[StorageService] Error saving last run timestamp:', error);
    }
  },

  async getLastRunTimestamp(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEY_LAST_RUN);
    } catch (error) {
      console.error('[StorageService] Error reading last run timestamp:', error);
      return null;
    }
  },

  // --- AsyncStorage: Debug Log History ---
  async addScraperLog(type: 'info' | 'success' | 'warning' | 'error', message: string): Promise<void> {
    try {
      const logsJson = await AsyncStorage.getItem(KEY_SCRAPER_LOGS);
      const logs: ScraperLog[] = logsJson ? JSON.parse(logsJson) : [];
      const newLog: ScraperLog = {
        timestamp: new Date().toISOString(),
        type,
        message,
      };
      
      // Limit to last 100 logs to prevent storage bloat
      const updatedLogs = [newLog, ...logs].slice(0, 100);
      await AsyncStorage.setItem(KEY_SCRAPER_LOGS, JSON.stringify(updatedLogs));
      
      // Also log to regular console
      console.log(`[SCRAPER_LOG][${type.toUpperCase()}] ${message}`);
    } catch (error) {
      console.error('[StorageService] Error adding scraper log:', error);
    }
  },

  async getScraperLogs(): Promise<ScraperLog[]> {
    try {
      const logsJson = await AsyncStorage.getItem(KEY_SCRAPER_LOGS);
      return logsJson ? JSON.parse(logsJson) : [];
    } catch (error) {
      console.error('[StorageService] Error reading scraper logs:', error);
      return [];
    }
  },

  async clearScraperLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY_SCRAPER_LOGS);
    } catch (error) {
      console.error('[StorageService] Error clearing scraper logs:', error);
    }
  },

  // --- AsyncStorage: Result History ---
  async saveResultHistory(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_result_history', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving result history:', error);
    }
  },

  async getResultHistory(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_result_history');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading result history:', error);
      return null;
    }
  },

  // --- AsyncStorage: Attendance History ---
  async saveAttendanceHistory(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_attendance_history', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving attendance history:', error);
    }
  },

  async getAttendanceHistory(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_attendance_history');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading attendance history:', error);
      return null;
    }
  },

  // --- AsyncStorage: Class Routine ---
  async saveRoutine(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_class_routine', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving class routine:', error);
    }
  },

  async getRoutine(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_class_routine');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading class routine:', error);
      return null;
    }
  },

  // --- AsyncStorage: Course History ---
  async saveCourseHistory(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_course_history_details', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving course history:', error);
    }
  },

  async getCourseHistory(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_course_history_details');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading course history:', error);
      return null;
    }
  },

  // --- AsyncStorage: PreRegistration List ---
  async savePreRegistration(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_pre_registration', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving pre-registration list:', error);
    }
  },

  async getPreRegistration(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_pre_registration');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading pre-registration list:', error);
      return null;
    }
  },

  // --- AsyncStorage: Billing Details ---
  async saveBillingDetails(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_billing_details', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving billing details:', error);
    }
  },

  async getBillingDetails(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_billing_details');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading billing details:', error);
      return null;
    }
  },

  // --- AsyncStorage: Detailed Marks Split ---
  async saveDetailedMarks(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_item_wise_marks', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving detailed marks:', error);
    }
  },

  async getDetailedMarks(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_item_wise_marks');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading detailed marks:', error);
      return null;
    }
  },

  // --- AsyncStorage: Academic Calendar Events ---
  async saveCalendarEvents(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_calendar_events', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving calendar events:', error);
    }
  },

  async getCalendarEvents(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_calendar_events');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading calendar events:', error);
      return null;
    }
  },

  // --- AsyncStorage: Calendar Batches Map ---
  async saveCalendarBatches(state: any): Promise<void> {
    try {
      await AsyncStorage.setItem('ucam_calendar_batches', JSON.stringify(state));
    } catch (error) {
      console.error('[StorageService] Error saving calendar batches:', error);
    }
  },

  async getCalendarBatches(): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem('ucam_calendar_batches');
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('[StorageService] Error reading calendar batches:', error);
      return null;
    }
  },

  // --- AsyncStorage: Trimester-specific Detailed Marks ---
  async saveDetailedMarksForSemester(semesterCode: string, state: any): Promise<void> {
    try {
      await AsyncStorage.setItem(`ucam_detailed_marks_${semesterCode}`, JSON.stringify(state));
    } catch (error) {
      console.error(`[StorageService] Error saving detailed marks for ${semesterCode}:`, error);
    }
  },

  async getDetailedMarksForSemester(semesterCode: string): Promise<any | null> {
    try {
      const state = await AsyncStorage.getItem(`ucam_detailed_marks_${semesterCode}`);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error(`[StorageService] Error reading detailed marks for ${semesterCode}:`, error);
      return null;
    }
  },

  // Clear all states (Logout helper)
  async clearAllState(): Promise<void> {
    try {
      console.log('[StorageService] Clearing all states...');
      await this.deleteCredentials();
      await this.deleteCookie();
      await AsyncStorage.removeItem(KEY_NOTICE_STATE);
      await AsyncStorage.removeItem(KEY_GRADE_STATE);
      await AsyncStorage.removeItem(KEY_LAST_RUN);
      await AsyncStorage.removeItem(KEY_SCRAPER_LOGS);
      await AsyncStorage.removeItem('ucam_result_history');
      await AsyncStorage.removeItem('ucam_attendance_history');
      await AsyncStorage.removeItem('ucam_class_routine');
      await AsyncStorage.removeItem('ucam_course_history_details');
      await AsyncStorage.removeItem('ucam_pre_registration');
      await AsyncStorage.removeItem('ucam_billing_details');
      await AsyncStorage.removeItem('ucam_item_wise_marks');
      await AsyncStorage.removeItem('ucam_calendar_events');
      await AsyncStorage.removeItem('ucam_calendar_batches');
      
      // Clean up trimester-specific detailed marks
      const allKeys = await AsyncStorage.getAllKeys();
      const detailedMarksKeys = allKeys.filter(key => key.startsWith('ucam_detailed_marks_'));
      if (detailedMarksKeys.length > 0) {
        await AsyncStorage.multiRemove(detailedMarksKeys);
      }

      console.log('[StorageService] All storage states cleared.');
    } catch (error) {
      console.error('[StorageService] Error clearing all states:', error);
    }
  }
};
