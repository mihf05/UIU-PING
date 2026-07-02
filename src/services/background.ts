import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { StorageService } from './storage';
import { ScraperService, NoticeItem, GradeItem } from '../api/scraper';
import { NotificationService } from './notifications';

export const BACKGROUND_SCRAPE_TASK_NAME = 'BACKGROUND-UCAM-SCRAPE-TASK';

// Define the background task logic
TaskManager.defineTask(BACKGROUND_SCRAPE_TASK_NAME, async () => {
  const runTimestamp = new Date().toLocaleTimeString();
  console.log(`[BackgroundTask] Executing scrape task at ${runTimestamp}...`);
  
  try {
    await StorageService.addScraperLog('info', `Background task started at ${runTimestamp}`);

    let dataChanged = false;

    // --- 1. Scrape Notices ---
    let currentNotices: NoticeItem[] = [];
    try {
      currentNotices = await ScraperService.scrapeNotices();
      const previousNotices = await StorageService.getNoticeState() as NoticeItem[] | null;

      if (previousNotices && previousNotices.length > 0 && currentNotices.length > 0) {
        // Compare the first/latest notice title & ID
        const latestCurrent = currentNotices[0];
        const hasNewNotice = !previousNotices.some(prev => prev.id === latestCurrent.id);

        if (hasNewNotice) {
          console.log('[BackgroundTask] New notice detected!', latestCurrent.title);
          await NotificationService.triggerLocalNotification(
            'New Notice Published on UCAM!',
            latestCurrent.title,
            { type: 'notice', id: latestCurrent.id }
          );
          await StorageService.addScraperLog('success', `Detected new notice: "${latestCurrent.title}"`);
          dataChanged = true;
        }
      }
      
      // Update local cache regardless
      await StorageService.saveNoticeState(currentNotices);
    } catch (noticeError: any) {
      console.error('[BackgroundTask] Error scraping notices in background:', noticeError);
      await StorageService.addScraperLog('warning', `Notice scrape failed in background: ${noticeError.message || noticeError}`);
    }

    // --- 2. Scrape Result Summary & Course History ---
    const credentials = await StorageService.getCredentials();
    const studentId = credentials?.studentId || '';

    if (studentId) {
      // 2a. Result Summary Check
      try {
        console.log('[BackgroundTask] Scraping result summary...');
        const currentResults = await ScraperService.scrapeResultSummary(studentId);
        const previousResults = await StorageService.getResultHistory();

        if (previousResults && previousResults.length > 0 && currentResults.length > 0) {
          const latestResult = currentResults[0];
          const prevMatched = previousResults.find((p: any) => p.semesterId === latestResult.semesterId);

          if (!prevMatched || prevMatched.gpa !== latestResult.gpa || prevMatched.cgpa !== latestResult.cgpa) {
            await NotificationService.triggerLocalNotification(
              'Trimester Result Updated!',
              `GPA: ${latestResult.gpa} (CGPA: ${latestResult.cgpa}) for ${latestResult.semesterName} ${latestResult.year}`,
              { type: 'result' }
            );
            await StorageService.addScraperLog('success', `GPA update detected: ${latestResult.gpa} for semester ${latestResult.semesterId}`);
            dataChanged = true;
          }
        }
        await StorageService.saveResultHistory(currentResults);
      } catch (resultError: any) {
        console.error('[BackgroundTask] Error checking results in background:', resultError);
      }

      // 2b. Course Grade Detail Check
      try {
        console.log('[BackgroundTask] Scraping course history grades...');
        const currentCourseHistory = await ScraperService.scrapeCourseHistory();
        const previousCourseHistory = await StorageService.getCourseHistory();

        if (previousCourseHistory && previousCourseHistory.length > 0 && currentCourseHistory.length > 0) {
          const gradeUpdates: string[] = [];
          for (const curr of currentCourseHistory) {
            const prev = previousCourseHistory.find((p: any) => p.courseCode === curr.courseCode && p.semesterCode === curr.semesterCode);
            if (!prev || prev.grade !== curr.grade) {
              gradeUpdates.push(`${curr.courseCode} (${curr.grade})`);
            }
          }

          if (gradeUpdates.length > 0) {
            await NotificationService.triggerLocalNotification(
              'Detailed Grade Released!',
              `Course grades updated: ${gradeUpdates.join(', ')}`,
              { type: 'grade' }
            );
            await StorageService.addScraperLog('success', `Detected detailed grade updates: ${gradeUpdates.join(', ')}`);
            dataChanged = true;
          }
        }
        await StorageService.saveCourseHistory(currentCourseHistory);
      } catch (historyError: any) {
        console.error('[BackgroundTask] Error checking course history in background:', historyError);
      }
    }

    // Update execution metadata
    await StorageService.saveLastRunTimestamp();
    await StorageService.addScraperLog(
      'info', 
      `Background task finished. Data status: ${dataChanged ? 'Changes Found' : 'No Changes'}`
    );

    return dataChanged 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error: any) {
    console.error('[BackgroundTask] Severe task failure:', error);
    await StorageService.addScraperLog('error', `Background task failed: ${error.message || error}`);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const BackgroundService = {
  /**
   * Register the background scraper task with a standard interval
   */
  async registerTask(intervalSeconds: number = 3600): Promise<void> {
    try {
      console.log(`[BackgroundService] Registering task "${BACKGROUND_SCRAPE_TASK_NAME}" (Interval: ${intervalSeconds}s)...`);
      
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCRAPE_TASK_NAME);
      if (!isRegistered) {
        console.warn('[BackgroundService] Warning: Task has not been defined in TaskManager yet. Make sure file is imported globally.');
      }

      await BackgroundFetch.registerTaskAsync(BACKGROUND_SCRAPE_TASK_NAME, {
        minimumInterval: intervalSeconds, // standard minimum is 15 minutes (900s) on iOS/Android
        stopOnTerminate: false, // keep running after user terminates app
        startOnBoot: true, // launch task when device starts
      });
      
      console.log('[BackgroundService] Background task successfully registered.');
      await StorageService.addScraperLog('info', `Background task registered with interval ${intervalSeconds}s`);
    } catch (error) {
      console.error('[BackgroundService] Error registering background task:', error);
      throw error;
    }
  },

  /**
   * Unregister/Cancel the background scraper task
   */
  async unregisterTask(): Promise<void> {
    try {
      console.log(`[BackgroundService] Unregistering task "${BACKGROUND_SCRAPE_TASK_NAME}"...`);
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SCRAPE_TASK_NAME);
      console.log('[BackgroundService] Background task unregistered.');
      await StorageService.addScraperLog('info', 'Background task unregistered.');
    } catch (error) {
      console.error('[BackgroundService] Error unregistering task (it might not be registered):', error);
    }
  },

  /**
   * Verify registration status
   */
  async isTaskRegistered(): Promise<boolean> {
    try {
      const isRegistered = await BackgroundFetch.getStatusAsync();
      const hasTask = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCRAPE_TASK_NAME);
      console.log(`[BackgroundService] System status: ${isRegistered}, Scraper Task registered: ${hasTask}`);
      return hasTask;
    } catch (error) {
      console.error('[BackgroundService] Error checking registration status:', error);
      return false;
    }
  }
};
