import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  Dimensions,
  Modal,
  useWindowDimensions,
  ActivityIndicator
} from 'react-native';
import { Theme } from '../components/Theme';
import { CustomButton } from '../components/CustomButton';
import { ScraperService, NoticeItem, ResultSummaryItem, AttendanceSummaryItem, RoutineItem, CourseHistoryItem, PreRegistrationItem, BillingDetails, BillTransaction, DetailedMarksItem } from '../api/scraper';
import { StorageService, ScraperLog } from '../services/storage';
import { BackgroundService } from '../services/background';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationService } from '../services/notifications';

// Static fallback for contexts outside hooks (e.g. icon rendering)
const SCREEN_WIDTH_STATIC = Dimensions.get('window').width;

import {
  Home,
  Calendar,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  CreditCard,
  Check,
  FileText,
  Users,
  AlertTriangle,
  X,
  Clock,
  MapPin,
  DollarSign,
  Wifi,
  WifiOff
} from 'lucide-react-native';

// --- Lucide Vector Icons Interface ---
interface CustomIconProps {
  name: 'home' | 'calendar' | 'trending-up' | 'refresh-cw' | 'eye' | 'eye-off' | 'credit-card' | 'check' | 'file-text' | 'users' | 'alert-triangle' | 'x' | 'clock' | 'map-pin' | 'dollar-sign' | 'wifi' | 'wifi-off';
  size?: number;
  color?: string;
}

const CustomIcon: React.FC<CustomIconProps> = ({ name, size = 18, color = '#FFF' }) => {
  switch (name) {
    case 'home': return <Home size={size} color={color} />;
    case 'calendar': return <Calendar size={size} color={color} />;
    case 'trending-up': return <TrendingUp size={size} color={color} />;
    case 'refresh-cw': return <RefreshCw size={size} color={color} />;
    case 'eye': return <Eye size={size} color={color} />;
    case 'eye-off': return <EyeOff size={size} color={color} />;
    case 'credit-card': return <CreditCard size={size} color={color} />;
    case 'check': return <Check size={size} color={color} />;
    case 'file-text': return <FileText size={size} color={color} />;
    case 'users': return <Users size={size} color={color} />;
    case 'alert-triangle': return <AlertTriangle size={size} color={color} />;
    case 'x': return <X size={size} color={color} />;
    case 'clock': return <Clock size={size} color={color} />;
    case 'map-pin': return <MapPin size={size} color={color} />;
    case 'dollar-sign': return <DollarSign size={size} color={color} />;
    case 'wifi': return <Wifi size={size} color={color} />;
    case 'wifi-off': return <WifiOff size={size} color={color} />;
    default: return null;
  }
};

interface DashboardScreenProps {
  onLogout: () => void;
}

type TabType = 'home' | 'routine' | 'results' | 'sync';

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onLogout }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [syncing, setSyncing] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [backgroundFetchEnabled, setBackgroundFetchEnabled] = useState(false);
  
  // Connection states
  const [isOnline, setIsOnline] = useState(true);

  // Modals & tooltips togglers
  const [showCgpa, setShowCgpa] = useState(false);
  const [showPreRegModal, setShowPreRegModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [activeChartTooltip, setActiveChartTooltip] = useState<number | null>(null);
  
  // Trimester filtering selector
  const [selectedSemesterCode, setSelectedSemesterCode] = useState<string>('all');

  // Data State
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [results, setResults] = useState<ResultSummaryItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummaryItem[]>([]);
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [courseHistory, setCourseHistory] = useState<CourseHistoryItem[]>([]);
  const [detailedMarks, setDetailedMarks] = useState<Record<string, DetailedMarksItem[]>>({});
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});
  const [preRegistration, setPreRegistration] = useState<PreRegistrationItem[]>([]);
  const [billing, setBilling] = useState<BillingDetails | null>(null);
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);

  // Academic Calendar & Picker States
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [expandedCalendar, setExpandedCalendar] = useState<boolean>(false);
  const [calendarBatches, setCalendarBatches] = useState<any[]>([]);
  const [loadingDetailedMarks, setLoadingDetailedMarks] = useState<boolean>(false);
  const [showSemesterDropdown, setShowSemesterDropdown] = useState<boolean>(false);

  useEffect(() => {
    loadCachedData();
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      await fetch('https://ucam.uiu.ac.bd/Security/LogIn.aspx', { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      
      setIsOnline(prev => {
        if (!prev) {
          console.log('[DashboardScreen] Online connection restored. Triggering auto-sync...');
          StorageService.addScraperLog('info', 'Network connection restored. Auto-synchronization running.');
          setTimeout(handleSilentSync, 200);
        }
        return true;
      });
    } catch (e) {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    if (!isOnline || !studentId) return;

    console.log('[DashboardScreen] Initializing foreground live poller (3-minute interval)...');
    
    const pollInterval = setInterval(async () => {
      try {
        console.log('[DashboardScreen] Polling UCAM for real-time changes...');
        const credentials = await StorageService.getCredentials();
        if (!credentials) return;

        // Fetch fresh notices
        const freshNotices = await ScraperService.scrapeNotices();
        const previousNotices = await StorageService.getNoticeState() || [];
        if (freshNotices.length > 0 && previousNotices.length > 0) {
          const hasNewNotice = !previousNotices.some((p: any) => p.id === freshNotices[0].id);
          if (hasNewNotice) {
            await NotificationService.triggerLocalNotification(
              'New Notice Published on UCAM! 🔔',
              freshNotices[0].title,
              { type: 'notice', id: freshNotices[0].id }
            );
            setNotices(freshNotices);
            await StorageService.saveNoticeState(freshNotices);
          }
        }

        // Fetch fresh results
        const freshResults = await ScraperService.scrapeResultSummary(credentials.studentId);
        const previousResults = await StorageService.getResultHistory() || [];
        if (freshResults.length > 0 && previousResults.length > 0) {
          const latestResult = freshResults[0];
          const prevMatched = previousResults.find((p: any) => p.semesterId === latestResult.semesterId);
          if (!prevMatched || prevMatched.gpa !== latestResult.gpa || prevMatched.cgpa !== latestResult.cgpa) {
            await NotificationService.triggerLocalNotification(
              'Trimester Result Updated! 🎓',
              `GPA: ${latestResult.gpa} (CGPA: ${latestResult.cgpa}) for ${latestResult.semesterName} ${latestResult.year}`
            );
            setResults(freshResults);
            await StorageService.saveResultHistory(freshResults);
          }
        }

        // Fetch fresh billing balance
        const freshBilling = await ScraperService.scrapeBillingDetails();
        const previousBilling = await StorageService.getBillingDetails();
        if (freshBilling && previousBilling && freshBilling.balance !== previousBilling.balance) {
          await NotificationService.triggerLocalNotification(
            'Billing Ledger Updated! 💰',
            `Outstanding Balance changed to: ৳${freshBilling.balance}`
          );
          setBilling(freshBilling);
          await StorageService.saveBillingDetails(freshBilling);
        }

        // Fetch fresh course history
        const freshHistory = await ScraperService.scrapeCourseHistory();
        const previousHistory = await StorageService.getCourseHistory() || [];
        if (freshHistory.length > 0 && previousHistory.length > 0) {
          const gradeUpdates: string[] = [];
          for (const curr of freshHistory) {
            const prev = previousHistory.find((p: any) => p.courseCode === curr.courseCode && p.semesterCode === curr.semesterCode);
            if (!prev || prev.grade !== curr.grade) {
              gradeUpdates.push(`${curr.courseCode} (${curr.grade})`);
            }
          }
          if (gradeUpdates.length > 0) {
            await NotificationService.triggerLocalNotification(
              'Detailed Grade Released! 📝',
              `Course grades updated: ${gradeUpdates.join(', ')}`
            );
            setCourseHistory(freshHistory);
            await StorageService.saveCourseHistory(freshHistory);
          }
        }

        // Fetch fresh item-wise detailed marks
        const freshDetailedMarks = await ScraperService.scrapeItemWiseDetailedMarks();
        const previousDetailedMarks = await StorageService.getDetailedMarks() || {};
        
        let marksUpdated = false;
        for (const [code, items] of Object.entries(freshDetailedMarks)) {
          const prevItems = previousDetailedMarks[code] || [];
          if (JSON.stringify(items) !== JSON.stringify(prevItems)) {
            marksUpdated = true;
            break;
          }
        }

        if (marksUpdated) {
          await NotificationService.triggerLocalNotification(
            'Evaluation Marks Updated! 🎯',
            'UCAM has published updates to your item-wise class evaluations.'
          );
          setDetailedMarks(freshDetailedMarks);
          await StorageService.saveDetailedMarks(freshDetailedMarks);
        }

      } catch (pollErr) {
        console.log('[DashboardScreen] Foreground poller sync encounter:', pollErr);
      }
    }, 180000); // 3 minutes = 180,000 ms

    return () => clearInterval(pollInterval);
  }, [isOnline, studentId]);

  const loadCachedData = async () => {
    try {
      const credentials = await StorageService.getCredentials();
      if (credentials) {
        setStudentId(credentials.studentId);
      }

      const cachedNotices = await StorageService.getNoticeState() || [];
      const cachedResults = await StorageService.getResultHistory() || [];
      const cachedAttendance = await StorageService.getAttendanceHistory() || [];
      const cachedRoutine = await StorageService.getRoutine() || [];
      const cachedHistory = await StorageService.getCourseHistory() || [];
      const cachedDetailedMarks = await StorageService.getDetailedMarks() || {};
      const cachedPreReg = await StorageService.getPreRegistration() || [];
      const cachedBilling = await StorageService.getBillingDetails();
      const cachedLogs = await StorageService.getScraperLogs() || [];
      const savedLastRun = await StorageService.getLastRunTimestamp();
      const cachedCalendar = await StorageService.getCalendarEvents() || [];
      const cachedBatches = await StorageService.getCalendarBatches() || [];

      setNotices(cachedNotices);
      setResults(cachedResults);
      setAttendance(cachedAttendance);
      setRoutine(cachedRoutine);
      setCourseHistory(cachedHistory);
      setDetailedMarks(cachedDetailedMarks);
      setPreRegistration(cachedPreReg);
      setBilling(cachedBilling);
      setLogs(cachedLogs);
      setCalendarEvents(cachedCalendar);
      setCalendarBatches(cachedBatches);
      
      if (savedLastRun) {
        setLastRun(new Date(savedLastRun).toLocaleString());
      }

      const isBgRegistered = await BackgroundService.isTaskRegistered();
      setBackgroundFetchEnabled(isBgRegistered);
    } catch (e) {
      console.error('[DashboardScreen] Error loading cache:', e);
    }
  };

  useEffect(() => {
    loadDetailedMarksForSelectedSemester(selectedSemesterCode);
  }, [selectedSemesterCode]);

  const loadDetailedMarksForSelectedSemester = async (semesterCode: string) => {
    if (semesterCode === 'all') {
      const cachedLatest = await StorageService.getDetailedMarks() || {};
      setDetailedMarks(cachedLatest);
      return;
    }

    setLoadingDetailedMarks(true);
    try {
      const cachedMarks = await StorageService.getDetailedMarksForSemester(semesterCode);
      if (cachedMarks && Object.keys(cachedMarks).length > 0) {
        console.log(`[DashboardScreen] Loaded cached detailed marks for semester ${semesterCode}`);
        setDetailedMarks(cachedMarks);
        setLoadingDetailedMarks(false);
        return;
      }

      if (!isOnline) {
        Alert.alert('Offline Mode', 'Cannot load detailed marks for previous trimesters without internet connection.');
        setDetailedMarks({});
        setLoadingDetailedMarks(false);
        return;
      }

      console.log(`[DashboardScreen] Fetching detailed marks online for semester ${semesterCode}...`);
      
      let batchId = '';
      const match = calendarBatches.find((b: any) => b.code === semesterCode);
      if (match) {
        batchId = match.value;
      } else {
        const freshBatches = await ScraperService.scrapeCalendarBatches();
        setCalendarBatches(freshBatches);
        await StorageService.saveCalendarBatches(freshBatches);
        
        const secondMatch = freshBatches.find((b: any) => b.code === semesterCode);
        if (secondMatch) {
          batchId = secondMatch.value;
        }
      }

      if (!batchId) {
        console.warn(`[DashboardScreen] No calendar batch ID mapped for semester ${semesterCode}`);
        setDetailedMarks({});
        setLoadingDetailedMarks(false);
        return;
      }

      const scrapedMarks = await ScraperService.scrapeItemWiseDetailedMarks(batchId);
      setDetailedMarks(scrapedMarks);
      await StorageService.saveDetailedMarksForSemester(semesterCode, scrapedMarks);
      await StorageService.addScraperLog('info', `Detailed marks loaded online for semester ${semesterCode}.`);
    } catch (err: any) {
      console.error('[DashboardScreen] Failed to load detailed marks for semester:', err);
      Alert.alert('Load Failed', 'Failed to retrieve detailed marks from UCAM.');
      setDetailedMarks({});
    } finally {
      setLoadingDetailedMarks(false);
    }
  };

  const handleSilentSync = async () => {
    try {
      const credentials = await StorageService.getCredentials();
      if (!credentials) return;

      const scrapedNotices = await ScraperService.scrapeNotices();
      setNotices(scrapedNotices);
      await StorageService.saveNoticeState(scrapedNotices);

      const scrapedResults = await ScraperService.scrapeResultSummary(credentials.studentId);
      setResults(scrapedResults);
      await StorageService.saveResultHistory(scrapedResults);

      const scrapedAttendance = await ScraperService.scrapeAttendanceSummary(credentials.studentId);
      setAttendance(scrapedAttendance);
      await StorageService.saveAttendanceHistory(scrapedAttendance);

      const scrapedBilling = await ScraperService.scrapeBillingDetails();
      setBilling(scrapedBilling);
      await StorageService.saveBillingDetails(scrapedBilling);

      const scrapedRoutine = await ScraperService.scrapeClassRoutine();
      setRoutine(scrapedRoutine);
      await StorageService.saveRoutine(scrapedRoutine);

      const scrapedHistory = await ScraperService.scrapeCourseHistory();
      setCourseHistory(scrapedHistory);
      await StorageService.saveCourseHistory(scrapedHistory);

      const scrapedPreReg = await ScraperService.scrapePreRegistrationList();
      setPreRegistration(scrapedPreReg);
      await StorageService.savePreRegistration(scrapedPreReg);

      const scrapedDetailedMarks = await ScraperService.scrapeItemWiseDetailedMarks();
      setDetailedMarks(scrapedDetailedMarks);
      await StorageService.saveDetailedMarks(scrapedDetailedMarks);

      // Scrape academic calendar
      try {
        const scrapedCalendar = await ScraperService.scrapeAcademicCalendar();
        setCalendarEvents(scrapedCalendar);
        await StorageService.saveCalendarEvents(scrapedCalendar);
      } catch (err) {
        console.error('[DashboardScreen] Silent sync calendar scrape failed:', err);
      }

      // Scrape calendar batches mapping
      try {
        const scrapedBatches = await ScraperService.scrapeCalendarBatches();
        setCalendarBatches(scrapedBatches);
        await StorageService.saveCalendarBatches(scrapedBatches);
      } catch (err) {
        console.error('[DashboardScreen] Silent sync calendar batches mapping scrape failed:', err);
      }

      await StorageService.saveLastRunTimestamp();
      setLastRun(new Date().toLocaleString());
      const refreshedLogs = await StorageService.getScraperLogs();
      setLogs(refreshedLogs);

      // Trigger local push notification on background/silent sync completion
      const currentGpa = scrapedResults.length > 0 ? scrapedResults[0].gpa : null;
      await NotificationService.triggerLocalNotification(
        'UCAM Background Synced 🔄',
        `Automatic check finished. Current GPA: ${currentGpa !== null ? currentGpa.toFixed(2) : 'N/A'}`
      );
    } catch (e) {
      console.log('[DashboardScreen] Silent online sync encountered rate limits or session errors:', e);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot synchronize dashboard data without internet connection. Using locally saved offline data.');
      return;
    }

    setSyncing(true);
    try {
      await StorageService.addScraperLog('info', 'Forced manual synchronization triggered.');

      // 1. Scrape Notices
      const scrapedNotices = await ScraperService.scrapeNotices();
      setNotices(scrapedNotices);
      await StorageService.saveNoticeState(scrapedNotices);

      // 2. Scrape Results Summary
      if (studentId) {
        const scrapedResults = await ScraperService.scrapeResultSummary(studentId);
        setResults(scrapedResults);
        await StorageService.saveResultHistory(scrapedResults);

        // 3. Scrape Attendance
        const scrapedAttendance = await ScraperService.scrapeAttendanceSummary(studentId);
        setAttendance(scrapedAttendance);
        await StorageService.saveAttendanceHistory(scrapedAttendance);

        // 4. Scrape Billing Details
        const scrapedBilling = await ScraperService.scrapeBillingDetails();
        setBilling(scrapedBilling);
        await StorageService.saveBillingDetails(scrapedBilling);
      }

      // 5. Scrape Class Routine
      const scrapedRoutine = await ScraperService.scrapeClassRoutine();
      setRoutine(scrapedRoutine);
      await StorageService.saveRoutine(scrapedRoutine);

      // 6. Scrape Completed Course Grades
      const scrapedHistory = await ScraperService.scrapeCourseHistory();
      setCourseHistory(scrapedHistory);
      await StorageService.saveCourseHistory(scrapedHistory);

      // 7. Scrape Pre-Registration Options
      const scrapedPreReg = await ScraperService.scrapePreRegistrationList();
      setPreRegistration(scrapedPreReg);
      await StorageService.savePreRegistration(scrapedPreReg);

      // 8. Scrape Detailed Item-wise Marks
      const scrapedDetailedMarks = await ScraperService.scrapeItemWiseDetailedMarks();
      setDetailedMarks(scrapedDetailedMarks);
      await StorageService.saveDetailedMarks(scrapedDetailedMarks);

      // 9. Scrape Academic Calendar
      try {
        const scrapedCalendar = await ScraperService.scrapeAcademicCalendar();
        setCalendarEvents(scrapedCalendar);
        await StorageService.saveCalendarEvents(scrapedCalendar);
      } catch (err: any) {
        console.error('[DashboardScreen] Manual sync academic calendar scrape failed:', err);
      }

      // 10. Scrape Calendar Batches Mapping
      try {
        const scrapedBatches = await ScraperService.scrapeCalendarBatches();
        setCalendarBatches(scrapedBatches);
        await StorageService.saveCalendarBatches(scrapedBatches);
      } catch (err: any) {
        console.error('[DashboardScreen] Manual sync calendar batches mapping scrape failed:', err);
      }

      // Save execution metadata
      await StorageService.saveLastRunTimestamp();
      const newTimestamp = new Date().toLocaleString();
      setLastRun(newTimestamp);

      // Refresh logs
      const refreshedLogs = await StorageService.getScraperLogs();
      setLogs(refreshedLogs);

      // Trigger local push notification on manual sync completion
      const currentGpa = results.length > 0 ? results[0].gpa : null;
      await NotificationService.triggerLocalNotification(
        'UCAM Synced Successfully! 🔄',
        `Routine: ${scrapedRoutine.length} classes mapped. Current GPA: ${currentGpa !== null ? currentGpa.toFixed(2) : 'N/A'}`
      );

      Alert.alert('Sync Successful', 'Successfully synchronized academic routine, grades, payment records, and attendance details.');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Sync Complete', 'Manual sync complete. Some portal connections timed out or required re-login. Check logs.');
      const refreshedLogs = await StorageService.getScraperLogs();
      setLogs(refreshedLogs);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleBackground = async (value: boolean) => {
    try {
      if (value) {
        await BackgroundService.registerTask(900);
        setBackgroundFetchEnabled(true);
        Alert.alert('Background Sync Enabled', 'App will periodically scrape and notify on GPA, notice, routine, and calendar updates.');
      } else {
        await BackgroundService.unregisterTask();
        setBackgroundFetchEnabled(false);
        Alert.alert('Background Sync Disabled', 'Automatic background polling has been cancelled.');
      }
      const refreshedLogs = await StorageService.getScraperLogs();
      setLogs(refreshedLogs);
    } catch (e) {
      Alert.alert('Error', 'Failed to configure background configurations.');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Delete credentials & clear local cache?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await StorageService.clearAllState();
          onLogout();
        }
      }
    ]);
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'error': return '#F44336';
      default: return Theme.colors.primary;
    }
  };

  const getCreditsForCourse = (courseCode: string) => {
    const code = courseCode.trim();
    const match = code.match(/\d+$/);
    if (match) {
      const num = parseInt(match[0], 10);
      return num % 2 === 0 ? 1.0 : 3.0;
    }
    return 3.0;
  };

  // --- CURRENT CLASS & NEXT CLASS CALCULATOR LOGIC ---
  const getActiveAndNextClass = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = days[new Date().getDay()];
    
    // Filter classes today
    const todayClasses = routine.filter(item => item.day.toLowerCase() === currentDayName.toLowerCase());
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTimeToMinutes = (timeStr: string) => {
      const match = timeStr.trim().match(/(\d+)[:.](\d+)\s*(AM|PM)/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      }
      return 0;
    };

    let activeClass: RoutineItem | null = null;
    let nextClass: RoutineItem | null = null;
    let minDiff = Infinity;

    for (const cls of todayClasses) {
      const parts = cls.timeSlot.split('-');
      if (parts.length >= 2) {
        const startMin = parseTimeToMinutes(parts[0]);
        const endMin = parseTimeToMinutes(parts[1]);

        if (currentMinutes >= startMin && currentMinutes <= endMin) {
          activeClass = cls;
        } else if (startMin > currentMinutes) {
          const diff = startMin - currentMinutes;
          if (diff < minDiff) {
            minDiff = diff;
            nextClass = cls;
          }
        }
      }
    }

    return { activeClass, nextClass };
  };

  const scheduleState = getActiveAndNextClass();

  // --- INSTALLMENT PAYMENT CALCULATION LOGIC ---
  const calculateInstallments = () => {
    const termCredits = attendance.reduce((acc, curr) => acc + getCreditsForCourse(curr.courseCode), 0);
    const scholarshipPercent = billing?.scholarshipPercent || 0;
    const balanceDues = billing?.balance || 0;

    const tuitionPerCredit = 6500;
    const trimesterFee = 6500;

    const rawTuition = termCredits * tuitionPerCredit;
    const discount = rawTuition * (scholarshipPercent / 100);
    const netTuition = rawTuition - discount;
    const totalTermBill = netTuition + trimesterFee;

    const baseRegAmount = 20000;
    const remainingAmount = Math.max(0, totalTermBill - baseRegAmount);

    const inst1Target = baseRegAmount + 0.40 * remainingAmount;
    const inst2Target = baseRegAmount + 0.70 * remainingAmount;
    const inst3Target = baseRegAmount + 1.00 * remainingAmount;

    const termPaidSoFar = Math.max(0, totalTermBill - balanceDues);

    let nextInstallmentName = 'All Installments Paid';
    let nextInstallmentAmount = 0;
    let currentInstallmentIndex = 3;

    if (termPaidSoFar < inst1Target) {
      nextInstallmentName = '1st Installment (40%)';
      nextInstallmentAmount = inst1Target - termPaidSoFar;
      currentInstallmentIndex = 0;
    } else if (termPaidSoFar < inst2Target) {
      nextInstallmentName = '2nd Installment (70%)';
      nextInstallmentAmount = inst2Target - termPaidSoFar;
      currentInstallmentIndex = 1;
    } else if (termPaidSoFar < inst3Target) {
      nextInstallmentName = '3rd Installment (100%)';
      nextInstallmentAmount = inst3Target - termPaidSoFar;
      currentInstallmentIndex = 2;
    }

    return {
      termCredits,
      rawTuition,
      discount,
      netTuition,
      trimesterFee,
      totalTermBill,
      inst1Target,
      inst2Target,
      inst3Target,
      termPaidSoFar,
      nextInstallmentName,
      nextInstallmentAmount,
      currentInstallmentIndex,
      balanceDues
    };
  };

  const paymentData = calculateInstallments();

  // Trigonometric line rendering helper for custom Line Chart
  const renderLineSegment = (x1: number, y1: number, x2: number, y2: number, key: string) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    return (
      <View
        key={key}
        style={{
          position: 'absolute',
          left: x1,
          top: y1,
          width: distance,
          height: 2.2,
          backgroundColor: Theme.colors.primary,
          opacity: 0.6,
          transform: [
            { rotate: `${angle}rad` }
          ],
          transformOrigin: '0% 0%',
        }}
      />
    );
  };

  // Maps UCAM semester codes (e.g. 253) into full readable trimester labels (e.g. Fall 2025)
  const getSemesterNameFromCode = (code: string) => {
    if (code.length < 3) return code;
    const yearPart = '20' + code.substring(0, 2);
    const termPart = code.substring(2, 3);
    let termName = '';
    if (termPart === '1') termName = 'Spring';
    else if (termPart === '2') termName = 'Summer';
    else if (termPart === '3') termName = 'Fall';
    else termName = 'Term ' + termPart;
    return `${termName} ${yearPart}`;
  };

  // --- CURRENT CLASS INDICATOR CARD COMPONENT ---
  const renderActiveTrackerCard = () => {
    const { activeClass, nextClass } = scheduleState;
    if (!activeClass && !nextClass) {
      return (
        <View style={[styles.card, styles.noClassCard]}>
          <Text style={styles.noClassText}>No classes scheduled for today! 🎉</Text>
        </View>
      );
    }

    return (
      <View style={[styles.card, styles.trackerClassCard]}>
        {activeClass && (
          <View style={styles.classStatusRow}>
            <View style={styles.statusRowHeading}>
              <View style={[styles.statusGlowDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={[styles.classStatusTitle, { color: '#4CAF50' }]}>ONGOING CLASS</Text>
            </View>
            <Text style={styles.trackerClassCode}>
              {activeClass.courseCode} ({activeClass.section})
            </Text>
            <Text style={styles.trackerClassTitle}>{activeClass.courseTitle}</Text>
            
            <View style={styles.trackerMetaRow}>
              <View style={styles.metaLabelBox}>
                <CustomIcon name="clock" size={12} color={Theme.colors.textMuted} />
                <Text style={styles.metaLabelText}>{activeClass.timeSlot}</Text>
              </View>
              <View style={styles.metaLabelBox}>
                <CustomIcon name="map-pin" size={12} color={Theme.colors.textMuted} />
                <Text style={styles.metaLabelText}>Room: {activeClass.room || 'N/A'}</Text>
              </View>
            </View>
          </View>
        )}

        {nextClass && (
          <View style={[styles.classStatusRow, activeClass && styles.classStatusRowDivider]}>
            <View style={styles.statusRowHeading}>
              <View style={[styles.statusGlowDot, { backgroundColor: Theme.colors.primary }]} />
              <Text style={[styles.classStatusTitle, { color: Theme.colors.primary }]}>UPCOMING CLASS TODAY</Text>
            </View>
            <Text style={styles.trackerClassCode}>
              {nextClass.courseCode} ({nextClass.section})
            </Text>
            <Text style={styles.trackerClassTitle}>{nextClass.courseTitle}</Text>
            
            <View style={styles.trackerMetaRow}>
              <View style={styles.metaLabelBox}>
                <CustomIcon name="clock" size={12} color={Theme.colors.textMuted} />
                <Text style={styles.metaLabelText}>{nextClass.timeSlot}</Text>
              </View>
              <View style={styles.metaLabelBox}>
                <CustomIcon name="map-pin" size={12} color={Theme.colors.textMuted} />
                <Text style={styles.metaLabelText}>Room: {nextClass.room || 'N/A'}</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderAcademicCalendarCard = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate = new Date();
    let endDate = new Date();
    let foundStart = false;
    let foundEnd = false;

    calendarEvents.forEach(event => {
      const titleLower = event.title.toLowerCase();
      if (titleLower.includes('classes begin')) {
        const yearMatch = event.date.match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : today.getFullYear().toString();
        const dateParts = event.date.split(/[-–—]/);
        let startPart = dateParts[0].trim();
        if (!startPart.includes(year)) {
          startPart = `${startPart}, ${year}`;
        }
        const d = new Date(startPart);
        if (!isNaN(d.getTime())) {
          startDate = d;
          foundStart = true;
        }
      }
      if (titleLower.includes('final exam')) {
        const yearMatch = event.date.match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : today.getFullYear().toString();
        const dateParts = event.date.split(/[-–—]/);
        let startPart = dateParts[0].trim();
        if (!startPart.includes(year)) {
          startPart = `${startPart}, ${year}`;
        }
        const d = new Date(startPart);
        if (!isNaN(d.getTime())) {
          endDate = d;
          foundEnd = true;
        }
      }
    });

    if (!foundStart) {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    if (!foundEnd) {
      endDate = new Date(startDate.getTime() + 105 * 24 * 60 * 60 * 1000);
    }

    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    let progressPercent = 0;
    if (totalDuration > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    }

    const upcomingEvents = calendarEvents.filter(e => e.daysLeft >= 0);
    const nextEvent = upcomingEvents[0];

    const getBadgeStyle = (type: string) => {
      switch (type) {
        case 'exam':
          return { backgroundColor: '#3A1E1C', color: '#FF7043' };
        case 'holiday':
          return { backgroundColor: '#1C312E', color: '#4CAF50' };
        default:
          return { backgroundColor: '#1B2C3F', color: '#42A5F5' };
      }
    };

    return (
      <View style={styles.card}>
        <View style={styles.paymentCardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#1F2937' }]}>
            <CustomIcon name="calendar" size={16} color={Theme.colors.primary} />
          </View>
          <Text style={styles.cardTitleText}>Trimester Calendar & Progress</Text>
        </View>

        <View style={styles.calendarProgressContainer}>
          <View style={styles.calendarProgressLabels}>
            <Text style={styles.calendarProgressLabelText}>Trimester Progress</Text>
            <Text style={styles.calendarProgressValueText}>{progressPercent}%</Text>
          </View>
          <View style={styles.calendarProgressBarOutline}>
            <View style={[styles.calendarProgressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.calendarProgressDates}>
            <Text style={styles.calendarProgressDateText}>Start: {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.calendarProgressDateText}>End: {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>

        {nextEvent ? (
          <View style={styles.nextEventHighlightCard}>
            <View style={styles.nextEventInfo}>
              <Text style={styles.nextEventLabel}>NEXT UPCOMING EVENT</Text>
              <Text style={styles.nextEventTitle} numberOfLines={1}>{nextEvent.title}</Text>
              <Text style={styles.nextEventDate}>{nextEvent.date}</Text>
            </View>
            <View style={[styles.nextEventDaysBadge, { backgroundColor: getBadgeStyle(nextEvent.type).backgroundColor }]}>
              <Text style={[styles.nextEventDaysText, { color: getBadgeStyle(nextEvent.type).color }]}>
                {nextEvent.daysLeft === 0 ? 'Today' : nextEvent.daysLeft === 1 ? 'Tomorrow' : `in ${nextEvent.daysLeft} days`}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No upcoming events cached. Run manual synchronization to scrape.</Text>
        )}

        {upcomingEvents.length > 0 && (
          <View style={styles.expandableCalendarSection}>
            <TouchableOpacity
              style={styles.expandCalendarToggleBtn}
              onPress={() => setExpandedCalendar(!expandedCalendar)}
              activeOpacity={0.7}
            >
              <Text style={styles.expandCalendarToggleText}>
                {expandedCalendar ? 'Collapse Calendar Events ▲' : 'Expand Calendar Events ▼'}
              </Text>
            </TouchableOpacity>

            {expandedCalendar && (
              <View style={styles.calendarEventsList}>
                {upcomingEvents.map((event, idx) => {
                  const badge = getBadgeStyle(event.type);
                  return (
                    <View key={idx} style={styles.calendarEventRow}>
                      <View style={styles.calendarEventLeft}>
                        <Text style={styles.calendarEventTitle} numberOfLines={1}>{event.title}</Text>
                        <Text style={styles.calendarEventDateText}>{event.date}</Text>
                      </View>
                      <View style={styles.calendarEventRight}>
                        <View style={[styles.calendarEventTypeBadge, { backgroundColor: badge.backgroundColor }]}>
                          <Text style={[styles.calendarEventTypeText, { color: badge.color }]}>{event.type.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.calendarEventDaysLeftText}>
                          {event.daysLeft === 0 ? 'Today' : event.daysLeft === 1 ? '1 day left' : `${event.daysLeft} days left`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderHomeTab = () => (
    <ScrollView style={[styles.tabContentWrapper, { marginBottom: tabBarHeight + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {/* Mini Profile / CGPA Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileInfo}>
          <View>
            <Text style={styles.profileLabel}>STUDENT DASHBOARD</Text>
            <Text style={styles.profileIdText}>{studentId || 'Not Sync'}</Text>
          </View>
          <TouchableOpacity style={styles.cgpaToggleBtn} onPress={() => setShowCgpa(!showCgpa)}>
            <CustomIcon name={showCgpa ? "eye-off" : "eye"} size={14} color={Theme.colors.primary} />
            <Text style={styles.cgpaToggleText}>{showCgpa ? "Hide CGPA" : "Reveal CGPA"}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.cgpaValueContainer}>
          <Text style={styles.cgpaDisplayLabel}>Current CGPA</Text>
          <Text style={styles.cgpaDisplayValue}>
            {results.length > 0
              ? (showCgpa ? results[0].cgpa.toFixed(2) : '•.••')
              : '0.00'}
          </Text>
        </View>
      </View>

      {/* Ongoing & Next Class Schedule Tracker */}
      {renderActiveTrackerCard()}

      {/* Dues & Next Installment Card */}
      <View style={styles.card}>
        <View style={styles.paymentCardHeader}>
          <View style={styles.iconCircle}>
            <CustomIcon name="credit-card" size={16} color={Theme.colors.primary} />
          </View>
          <Text style={styles.cardTitleText}>Payment Status</Text>
        </View>

        <View style={styles.duesRow}>
          <View style={styles.duesBox}>
            <Text style={styles.duesLabel}>Outstanding Balance</Text>
            <Text style={[styles.duesValue, { color: paymentData.balanceDues > 0 ? '#F44336' : '#4CAF50' }]}>
              ৳ {paymentData.balanceDues.toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.duesBox}>
            <Text style={styles.duesLabel}>Next Installment Due</Text>
            <Text style={[styles.duesValue, { color: paymentData.nextInstallmentAmount > 0 ? Theme.colors.primary : '#4CAF50' }]}>
              ৳ {Math.round(paymentData.nextInstallmentAmount).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.installmentStatusBox}>
          <Text style={styles.installmentStatusLabel}>Next Target: </Text>
          <Text style={styles.installmentStatusValue}>
            {paymentData.nextInstallmentName}
          </Text>
        </View>

        {/* Installment Tracker Progress Bar */}
        <View style={styles.trackerContainer}>
          <View style={styles.trackerTimeline}>
            {[1, 2, 3].map((step, idx) => {
              const targets = [paymentData.inst1Target, paymentData.inst2Target, paymentData.inst3Target];
              const targetVal = targets[idx];
              const isPaid = paymentData.termPaidSoFar >= targetVal;
              return (
                <View key={step} style={styles.trackerNodeContainer}>
                  <View style={[styles.trackerNode, isPaid && styles.trackerNodeCompleted]}>
                    {isPaid ? (
                      <CustomIcon name="check" size={10} color="#FFF" />
                    ) : (
                      <Text style={styles.trackerNodeText}>{step}</Text>
                    )}
                  </View>
                  <Text style={styles.trackerNodeLabel}>{step * 30 + 10}%</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Double Buttons (Pre-Reg Overlay & Payment Ledger Overlay) */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={[styles.quickPreRegBtn, { flex: 1, marginRight: Theme.spacing.xs }]} onPress={() => setShowPreRegModal(true)}>
            <CustomIcon name="file-text" size={14} color="#FFF" />
            <Text style={styles.quickPreRegText}>Pre-Registration</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickPreRegBtn, { flex: 1, marginLeft: Theme.spacing.xs, borderColor: '#1F2E45' }]} onPress={() => setShowPaymentHistoryModal(true)}>
            <CustomIcon name="dollar-sign" size={14} color={Theme.colors.primary} />
            <Text style={styles.quickPreRegText}>Payment History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Attendance Summary Card */}
      <View style={styles.card}>
        <View style={styles.paymentCardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#1C312E' }]}>
            <CustomIcon name="users" size={16} color="#4CAF50" />
          </View>
          <Text style={styles.cardTitleText}>Trimester Attendance</Text>
        </View>
        
        {attendance.length === 0 ? (
          <Text style={styles.emptyText}>No attendance records. Synchronize dashboard data.</Text>
        ) : (
          attendance.map((item, idx) => {
            const ratio = item.totalClasses > 0 ? (item.presentCount / item.totalClasses) : 1;
            const percent = Math.round(ratio * 100);
            const isLow = percent < 75;
            
            return (
              <View key={idx} style={styles.attendanceInlineRow}>
                <View style={styles.attRowLeft}>
                  <Text style={styles.attCourseCode}>{item.courseCode} ({item.section})</Text>
                  <Text style={styles.attCourseTitle} numberOfLines={1}>{item.courseTitle}</Text>
                  {isLow && (
                    <View style={styles.lowAttBadge}>
                      <CustomIcon name="alert-triangle" size={10} color="#F44336" />
                      <Text style={styles.lowAttText}>De-collegiate Warning (Below 75%)</Text>
                    </View>
                  )}
                </View>
                <View style={styles.attRowRight}>
                  <Text style={[styles.attPercent, { color: isLow ? '#F44336' : '#4CAF50' }]}>
                    {percent}%
                  </Text>
                  <Text style={styles.attRatio}>{item.presentCount}/{item.totalClasses} classes</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {renderAcademicCalendarCard()}
    </ScrollView>
  );

  const renderRoutineTab = () => {
    const daysOrder = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const groupedRoutine: { [key: string]: RoutineItem[] } = {};
    daysOrder.forEach(d => groupedRoutine[d] = []);
    
    routine.forEach(item => {
      if (groupedRoutine[item.day]) {
        groupedRoutine[item.day].push(item);
      }
    });

    return (
      <ScrollView style={[styles.tabContentWrapper, { marginBottom: tabBarHeight + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.tabHeaderTitle}>Weekly Class Schedule</Text>
        
        {/* Dynamic header tracker inside routine tab */}
        {renderActiveTrackerCard()}

        {routine.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No schedules mapped. Trigger manual synchronization on settings.</Text>
          </View>
        ) : (
          daysOrder.map(day => {
            const classes = groupedRoutine[day];
            if (classes.length === 0) return null;
            return (
              <View key={day} style={styles.dayGroupCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayHeaderText}>{day.toUpperCase()}</Text>
                </View>
                {classes.map((cls, idx) => (
                  <View key={idx} style={styles.classRow}>
                    <View style={styles.classTimeBox}>
                      <Text style={styles.classTimeText}>{cls.timeSlot.split('-')[0]}</Text>
                      <Text style={styles.classTimeSub}>{cls.timeSlot.split('-')[1]}</Text>
                    </View>
                    <View style={styles.classDetailBox}>
                      <Text style={styles.classCourseText}>{cls.courseCode} ({cls.section})</Text>
                      <Text style={styles.classTitleText} numberOfLines={1}>{cls.courseTitle}</Text>
                      <View style={styles.roomBadge}>
                        <CustomIcon name="map-pin" size={10} color={Theme.colors.primary} />
                        <Text style={styles.roomText}>Room: {cls.room || 'N/A'}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  const renderResultsTab = () => {
    const chartData = [...results].reverse();
    const canvasWidth = (width || SCREEN_WIDTH_STATIC) - 64;
    const chartLeftPadding = 40;
    const chartRightPadding = 45;
    const chartWidth = canvasWidth - chartLeftPadding - chartRightPadding;
    const chartHeight = 110;
    
    const points = chartData.map((item, idx) => {
      const gpa = item.gpa;
      const x = chartLeftPadding + idx * (chartWidth / Math.max(1, chartData.length - 1));
      const y = 15 + (1 - (gpa / 4.0)) * chartHeight;
      return { x, y, item, idx };
    });

    // Unique semester list for chips dropdown selection
    const semesterCodes = Array.from(new Set(courseHistory.map(item => item.semesterCode))).sort().reverse();
    
    // Filtered letters list
    const filteredHistory = selectedSemesterCode === 'all'
      ? courseHistory
      : courseHistory.filter(item => item.semesterCode === selectedSemesterCode);

    // Get selected trimester summary parameters
    let termGpa: number | null = null;
    let termCgpa: number | null = null;
    let termTitle = 'All Trimesters Summary';

    if (selectedSemesterCode !== 'all') {
      termTitle = getSemesterNameFromCode(selectedSemesterCode);
      // Attempt matching against UCAM results summary records
      const matchSummary = results.find(r => {
        const readableLabel = `${r.semesterName} ${r.year}`; // e.g. "Spring 2026"
        return readableLabel.toLowerCase() === termTitle.toLowerCase();
      });

      if (matchSummary) {
        termGpa = matchSummary.gpa;
        termCgpa = matchSummary.cgpa;
      } else {
        // Compute manual GPA fallback
        let totalPoints = 0;
        let totalCredits = 0;
        filteredHistory.forEach(c => {
          if (c.grade !== 'F' && c.point > 0) {
            totalPoints += c.point * c.credits;
            totalCredits += c.credits;
          } else if (c.grade === 'F') {
            totalCredits += c.credits;
          }
        });
        if (totalCredits > 0) {
          termGpa = totalPoints / totalCredits;
        }
      }
    } else {
      // All cumulative total
      if (results.length > 0) {
        termCgpa = results[0].cgpa;
      }
    }

    return (
      <ScrollView style={[styles.tabContentWrapper, { marginBottom: tabBarHeight + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.tabHeaderTitle}>Trimester Grades</Text>
        
        {/* Responsive Line Chart */}
        {results.length > 0 && (
          <View style={styles.lineChartCard}>
            <Text style={styles.chartTitle}>GPA Progression Curve</Text>
            
            <View style={[styles.lineChartCanvas, { height: chartHeight + 40 }]}>
              {[4.0, 3.0, 2.0, 1.0, 0.0].map((level) => {
                const yLevel = 15 + (1 - (level / 4.0)) * chartHeight;
                return (
                  <View key={level} style={[styles.chartGridLine, { top: yLevel }]}>
                    <Text style={styles.gridLineLabel}>{level.toFixed(1)}</Text>
                  </View>
                );
              })}

              {points.map((p, idx) => {
                if (idx === points.length - 1) return null;
                const nextP = points[idx + 1];
                return renderLineSegment(p.x, p.y, nextP.x, nextP.y, `seg-${idx}`);
              })}

              {points.map((p) => (
                <TouchableOpacity
                  key={p.idx}
                  style={[styles.chartDot, { left: p.x - 6, top: p.y - 6 }]}
                  onPress={() => setActiveChartTooltip(activeChartTooltip === p.idx ? null : p.idx)}
                  activeOpacity={0.7}
                >
                  {activeChartTooltip === p.idx && (
                    <View style={styles.chartTooltip}>
                      <Text style={styles.tooltipText}>{p.item.semesterName}</Text>
                      <Text style={styles.tooltipSubText}>GPA: {p.item.gpa.toFixed(2)}</Text>
                      <Text style={styles.tooltipSubText}>CGPA: {p.item.cgpa.toFixed(2)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.chartXAxis}>
              {points.map((p, idx) => (
                <Text key={idx} style={[styles.chartXLabel, { position: 'absolute', left: p.x - 22.5 }]} numberOfLines={1}>
                  {p.item.semesterName.substring(0, 3)} '{p.item.year.toString().slice(-2)}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Trimester Selector Dropdown */}
        <View style={styles.dropdownWrapper}>
          <Text style={styles.selectorLabel}>Select Trimester</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowSemesterDropdown(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dropdownButtonText}>
              {selectedSemesterCode === 'all' 
                ? 'All Trimesters' 
                : `${getSemesterNameFromCode(selectedSemesterCode)} (${selectedSemesterCode})`}
            </Text>
            <Text style={styles.dropdownButtonArrow}>▼</Text>
          </TouchableOpacity>

          <Modal
            visible={showSemesterDropdown}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowSemesterDropdown(false)}
          >
            <TouchableOpacity 
              style={styles.modalOverlay} 
              activeOpacity={1} 
              onPress={() => setShowSemesterDropdown(false)}
            >
              <View style={styles.dropdownModalContent}>
                <View style={styles.dropdownModalHeader}>
                  <Text style={styles.dropdownModalTitle}>Select Academic Trimester</Text>
                  <TouchableOpacity onPress={() => setShowSemesterDropdown(false)}>
                    <Text style={styles.dropdownModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.dropdownOptionsList} showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.dropdownOption, selectedSemesterCode === 'all' && styles.dropdownOptionActive]}
                    onPress={() => {
                      setSelectedSemesterCode('all');
                      setShowSemesterDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownOptionText, selectedSemesterCode === 'all' && styles.dropdownOptionTextActive]}>
                      All Trimesters
                    </Text>
                  </TouchableOpacity>

                  {semesterCodes.map(code => (
                    <TouchableOpacity
                      key={code}
                      style={[styles.dropdownOption, selectedSemesterCode === code && styles.dropdownOptionActive]}
                      onPress={() => {
                        setSelectedSemesterCode(code);
                        setShowSemesterDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownOptionText, selectedSemesterCode === code && styles.dropdownOptionTextActive]}>
                        {getSemesterNameFromCode(code)} ({code})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        {/* Selected Trimester GPA / CGPA Summary Box */}
        <View style={styles.trimesterSummaryBox}>
          <Text style={styles.trimBoxTitle}>{termTitle}</Text>
          <View style={styles.trimBoxMetricsRow}>
            {termGpa !== null && (
              <View style={styles.trimMetricItem}>
                <Text style={styles.trimMetricLabel}>TRIMESTER GPA</Text>
                <Text style={styles.trimMetricValue}>{termGpa.toFixed(2)}</Text>
              </View>
            )}
            {termCgpa !== null && (
              <View style={styles.trimMetricItem}>
                <Text style={styles.trimMetricLabel}>CUMULATIVE CGPA</Text>
                <Text style={styles.trimMetricValue}>{termCgpa.toFixed(2)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Grade Details Sheet */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Detailed Academic History</Text>
          {filteredHistory.length === 0 ? (
            <Text style={styles.emptyText}>No letter grades parsed for this selection. Run manual synchronization.</Text>
          ) : (
            filteredHistory.map((item, idx) => {
              const isExpanded = !!expandedCourses[item.courseCode];
              const marks = detailedMarks[item.courseCode] || [];
              return (
                <View key={idx} style={styles.courseHistoryRowContainer}>
                  <TouchableOpacity
                    style={styles.courseHistoryRow}
                    onPress={() => setExpandedCourses(prev => ({ ...prev, [item.courseCode]: !prev[item.courseCode] }))}
                    activeOpacity={0.7}
                  >
                    <View style={styles.courseHistoryMain}>
                      <Text style={styles.courseHistoryCode}>
                        {item.courseCode} {isExpanded ? '▼' : '▶'}
                      </Text>
                      <Text style={styles.courseHistoryTitle} numberOfLines={1}>{item.courseTitle}</Text>
                      <Text style={styles.courseHistoryCredits}>
                        {item.credits} Credits • Trimester {getSemesterNameFromCode(item.semesterCode)}
                      </Text>
                    </View>
                    <View style={styles.courseHistoryGradeBox}>
                      <Text style={styles.courseHistoryGradeText}>{item.grade}</Text>
                      <Text style={styles.courseHistoryPointsText}>{item.point.toFixed(2)}</Text>
                    </View>
                  </TouchableOpacity>
                  
                  {isExpanded && (
                    <View style={styles.expandedMarksContainer}>
                      <Text style={styles.marksSplitTitle}>Evaluation Marks Splits</Text>
                      {loadingDetailedMarks ? (
                        <ActivityIndicator size="small" color={Theme.colors.primary} style={{ marginVertical: 12 }} />
                      ) : marks.length === 0 ? (
                        <Text style={styles.emptyMarksText}>
                          No detailed marks split cached. Ensure you are connected to the internet to load details.
                        </Text>
                      ) : (
                        marks.map((mark, mIdx) => (
                          <View key={mIdx} style={styles.markItemRow}>
                            <Text style={styles.markItemName}>{mark.itemName}</Text>
                            <Text style={styles.markItemValue}>{mark.itemValue}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  };

  const renderSyncTab = () => (
    <ScrollView style={[styles.tabContentWrapper, { marginBottom: tabBarHeight + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>UCAM Sync Settings</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ marginRight: 6 }}>
              <CustomIcon name={isOnline ? "wifi" : "wifi-off"} size={14} color={isOnline ? '#4CAF50' : '#F44336'} />
            </View>
            <View style={[styles.pulseCircle, syncing ? styles.pulseActive : null]} />
          </View>
        </View>
        
        {/* Network Connection Banner inside Card */}
        <View style={[styles.connectionStatusBanner, { backgroundColor: isOnline ? '#182C22' : '#2D1F23', borderColor: isOnline ? '#4CAF50' : '#F44336' }]}>
          <Text style={[styles.connectionStatusText, { color: isOnline ? '#4CAF50' : '#F44336' }]}>
            {isOnline ? 'Online - Live updates enabled' : 'Offline Mode - Serving saved data'}
          </Text>
        </View>
        
        <View style={styles.statusMetricRow}>
          <View style={styles.metricColumn}>
            <Text style={styles.metricLabel}>Last Polled</Text>
            <Text style={styles.metricValue}>{lastRun ? lastRun.split(' ')[1] || lastRun : 'Never'}</Text>
          </View>
          <View style={styles.metricColumn}>
            <Text style={styles.metricLabel}>Notices Cached</Text>
            <Text style={styles.metricValue}>{notices.length}</Text>
          </View>
          <View style={styles.metricColumn}>
            <Text style={styles.metricLabel}>Routine Mapped</Text>
            <Text style={styles.metricValue}>{routine.length} classes</Text>
          </View>
        </View>
        
        <CustomButton
          title={syncing ? 'SCRAPING PORTAL SERVICES...' : 'FORCE RE-SYNC ALL DATA'}
          onPress={handleManualSync}
          loading={syncing}
          style={styles.syncBtn}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.configRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.configLabel}>Automated Background Polling</Text>
            <Text style={styles.configSubLabel}>Periodically checks for notices, routines, and grades in the background (every ~1 hour).</Text>
          </View>
          <Switch
            value={backgroundFetchEnabled}
            onValueChange={handleToggleBackground}
            trackColor={{ false: '#0A0E1A', true: Theme.colors.primary }}
            thumbColor={Platform.OS === 'android' ? '#FFF' : undefined}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Latest Notices</Text>
        {notices.length === 0 ? (
          <Text style={styles.emptyText}>No notices cached. Synchronize portal data.</Text>
        ) : (
          notices.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.noticeRow}>
              <Text style={styles.noticeDate}>{item.date}</Text>
              <Text style={styles.noticeTitle}>{item.title}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Scraper Console Logs</Text>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No logs found.</Text>
        ) : (
          logs.slice(0, 6).map((item, index) => (
            <View key={index} style={styles.logRow}>
              <View style={styles.logMeta}>
                <View style={[styles.logIndicator, { backgroundColor: getLogColor(item.type) }]} />
                <Text style={styles.logType}>{item.type.toUpperCase()}</Text>
                <Text style={styles.logTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
              </View>
              <Text style={styles.logMessage}>{item.message}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'routine': return renderRoutineTab();
      case 'results': return renderResultsTab();
      case 'sync': return renderSyncTab();
      default: return renderHomeTab();
    }
  };

  // --- Responsive scaling helpers ---
  const isSmall = width < 360;
  const isLarge = width >= 768;
  const headerPadH = isSmall ? Theme.spacing.md : isLarge ? Theme.spacing.xl : Theme.spacing.lg;
  const headerPadV = isSmall ? 10 : isLarge ? Theme.spacing.lg : Theme.spacing.md;
  const titleSize = isSmall ? 14 : isLarge ? 20 : 16;
  const syncIconSize = isSmall ? 10 : isLarge ? 16 : 12;
  const syncTextSize = isSmall ? 9 : isLarge ? 13 : 11;
  const logoutTextSize = isSmall ? 9 : isLarge ? 13 : 11;
  const tabBarHeight = isSmall ? 50 : isLarge ? 68 : 56;
  const tabIconSize = isSmall ? 14 : isLarge ? 22 : 16;
  const tabTextSize = isSmall ? 8 : isLarge ? 12 : 10;
  const badgeTextSize = isSmall ? 8 : isLarge ? 11 : 9;

  return (
    <View style={styles.safeContainer}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
      
      {/* App Header — responsive & notch-proof */}
      <View style={[
        styles.header, 
        { 
          paddingHorizontal: headerPadH, 
          paddingTop: insets.top > 0 ? insets.top + 8 : headerPadV, 
          paddingBottom: headerPadV 
        }
      ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
          <Text style={[styles.appTitle, { fontSize: titleSize }]} numberOfLines={1}>UIU Ping</Text>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontSize: badgeTextSize }]}>Active</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
          <TouchableOpacity 
            style={[styles.headerSyncBtn, syncing && { opacity: 0.6 }]} 
            onPress={handleManualSync}
            disabled={syncing}
          >
            <CustomIcon name="refresh-cw" size={syncIconSize} color={Theme.colors.primary} />
            <Text style={[styles.headerSyncText, { fontSize: syncTextSize }]}>{syncing ? 'Syncing...' : 'Sync'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={[styles.logoutBtnText, { fontSize: logoutTextSize }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {renderTabContent()}
      </View>

      {/* Overlay Modal for Pre-Registration Courses */}
      <Modal
        visible={showPreRegModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreRegModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>Self-Registration Courses</Text>
              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowPreRegModal(false)}>
                <CustomIcon name="x" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {preRegistration.length === 0 ? (
                <Text style={styles.emptyText}>No registration lists found. Sync dashboard data.</Text>
              ) : (
                preRegistration.map((item, idx) => (
                   <View key={idx} style={styles.regCard}>
                    <View style={{ flex: 1, paddingRight: Theme.spacing.md }}>
                      <Text style={styles.regCode}>{item.courseCode}</Text>
                      <Text style={styles.regTitle} numberOfLines={1}>{item.courseTitle}</Text>
                      <Text style={styles.regCredits}>{item.credits.toFixed(1)} Credits</Text>
                      {item.sectionTime ? (
                        <Text style={styles.regTime}>{item.sectionTime}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.regStatusBadge, { backgroundColor: item.registered ? '#1B472E' : '#3E2A12' }]}>
                      <Text style={[styles.regStatusText, { color: item.registered ? '#4CAF50' : '#FF9800' }]}>
                        {item.registered ? 'Registered' : 'Available'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Overlay Modal for Payment Ledger History */}
      <Modal
        visible={showPaymentHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentHistoryModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>Billing Transactions History</Text>
              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowPaymentHistoryModal(false)}>
                <CustomIcon name="x" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {!billing || !billing.transactions || billing.transactions.length === 0 ? (
                <Text style={styles.emptyText}>No transaction records. Sync dashboard data.</Text>
              ) : (
                billing.transactions.map((item, idx) => {
                  const isPayment = item.payment > 0;
                  return (
                    <View key={idx} style={styles.ledgerRowCard}>
                      <View style={styles.ledgerHeaderRow}>
                        <Text style={styles.ledgerSl}>#{item.sl}</Text>
                        <Text style={styles.ledgerDate}>{item.date}</Text>
                      </View>
                      
                      <View style={styles.ledgerDetailMain}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.ledgerFeeType}>{item.feeType}</Text>
                          {item.courseCode ? (
                            <Text style={styles.ledgerCourseCode}>Course: {item.courseCode} ({item.credits} Credits)</Text>
                          ) : null}
                          {item.remark ? (
                            <Text style={styles.ledgerRemark}>{item.remark}</Text>
                          ) : null}
                        </View>
                        
                        <View style={styles.ledgerAmtBox}>
                          <Text style={[styles.ledgerAmtText, { color: isPayment ? '#4CAF50' : Theme.colors.primary }]}>
                            {isPayment ? `+ ৳${item.payment.toLocaleString()}` : `- ৳${item.amount.toLocaleString()}`}
                          </Text>
                          {item.discount > 0 ? (
                            <Text style={styles.ledgerDiscountText}>Waiver: -৳{item.discount.toLocaleString()}</Text>
                          ) : null}
                        </View>
                      </View>
                      
                      <View style={styles.ledgerFooterRow}>
                        <Text style={styles.ledgerSemester}>Term: {item.semester || 'N/A'}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom Tab Bar — responsive & navigation-bar-proof */}
      <View style={[
        styles.bottomTabBar, 
        { 
          height: tabBarHeight + (insets.bottom > 0 ? insets.bottom - 4 : 0), 
          paddingBottom: insets.bottom 
        }
      ]}>
        <TouchableOpacity
          style={[styles.bottomTab, activeTab === 'home' && styles.bottomTabActive]}
          onPress={() => {
            setActiveTab('home');
            setActiveChartTooltip(null);
          }}
        >
          <CustomIcon name="home" size={tabIconSize} color={activeTab === 'home' ? Theme.colors.primary : Theme.colors.textMuted} />
          <Text style={[styles.bottomTabText, { fontSize: tabTextSize }, activeTab === 'home' && styles.bottomTabTextActive]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.bottomTab, activeTab === 'routine' && styles.bottomTabActive]}
          onPress={() => {
            setActiveTab('routine');
            setActiveChartTooltip(null);
          }}
        >
          <CustomIcon name="calendar" size={tabIconSize} color={activeTab === 'routine' ? Theme.colors.primary : Theme.colors.textMuted} />
          <Text style={[styles.bottomTabText, { fontSize: tabTextSize }, activeTab === 'routine' && styles.bottomTabTextActive]}>Routine</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.bottomTab, activeTab === 'results' && styles.bottomTabActive]}
          onPress={() => {
            setActiveTab('results');
            setActiveChartTooltip(null);
          }}
        >
          <CustomIcon name="trending-up" size={tabIconSize} color={activeTab === 'results' ? Theme.colors.primary : Theme.colors.textMuted} />
          <Text style={[styles.bottomTabText, { fontSize: tabTextSize }, activeTab === 'results' && styles.bottomTabTextActive]}>Results</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTab, activeTab === 'sync' && styles.bottomTabActive]}
          onPress={() => {
            setActiveTab('sync');
            setActiveChartTooltip(null);
          }}
        >
          <CustomIcon name="refresh-cw" size={tabIconSize} color={activeTab === 'sync' ? Theme.colors.primary : Theme.colors.textMuted} />
          <Text style={[styles.bottomTabText, { fontSize: tabTextSize }, activeTab === 'sync' && styles.bottomTabTextActive]}>Sync</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // paddingHorizontal and paddingVertical are set dynamically via inline styles
    borderBottomWidth: 1.2,
    borderBottomColor: Theme.colors.cardBorder,
    backgroundColor: '#070A13',
  },
  appTitle: {
    fontSize: 16,
    color: Theme.colors.textPrimary,
    fontFamily: Theme.fonts.bold,
  },
  badge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#1E312E',
    borderWidth: 0.8,
    borderColor: '#4CAF50',
  },
  badgeText: {
    fontSize: 9,
    color: '#4CAF50',
    fontFamily: Theme.fonts.bold,
  },
  headerSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18223B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.roundness.small,
    marginRight: 8,
    borderColor: '#243254',
    borderWidth: 1,
  },
  headerSyncText: {
    fontSize: 11,
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.bold,
    marginLeft: 4,
  },
  logoutBtn: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 4,
    borderRadius: Theme.roundness.small,
    backgroundColor: '#1C2337',
  },
  logoutBtnText: {
    fontSize: 11,
    color: Theme.colors.error,
    fontFamily: Theme.fonts.medium,
  },
  tabContentWrapper: {
    flex: 1,
    padding: Theme.spacing.md,
    marginBottom: 0,
  },
  tabHeaderTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.md,
    marginLeft: 2,
  },
  profileCard: {
    backgroundColor: '#0F1527',
    borderRadius: Theme.roundness.medium,
    borderColor: '#1E294B',
    borderWidth: 1.2,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  profileInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.sm,
  },
  profileLabel: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.bold,
  },
  profileIdText: {
    fontSize: 18,
    color: Theme.colors.textPrimary,
    fontFamily: Theme.fonts.bold,
    marginTop: 2,
  },
  cgpaToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18223B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cgpaToggleText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginLeft: 4,
    fontFamily: Theme.fonts.medium,
  },
  cgpaValueContainer: {
    borderTopWidth: 1,
    borderTopColor: '#1A2440',
    paddingTop: Theme.spacing.sm,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cgpaDisplayLabel: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  cgpaDisplayValue: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.primary,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: Theme.roundness.medium,
    borderColor: Theme.colors.cardBorder,
    borderWidth: 1.2,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#271F23',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.sm,
  },
  cardTitleText: {
    fontSize: 15,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
  },
  duesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  duesBox: {
    flex: 1,
  },
  duesLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginBottom: 4,
  },
  duesValue: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
  },
  installmentStatusBox: {
    flexDirection: 'row',
    backgroundColor: '#111726',
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  installmentStatusLabel: {
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  installmentStatusValue: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.primary,
  },
  trackerContainer: {
    marginBottom: Theme.spacing.md,
  },
  trackerTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.sm,
  },
  trackerNodeContainer: {
    alignItems: 'center',
  },
  trackerNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1E2536',
    borderWidth: 1.5,
    borderColor: '#384461',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerNodeCompleted: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  trackerNodeText: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.bold,
  },
  trackerNodeLabel: {
    fontSize: 9,
    color: Theme.colors.textMuted,
    marginTop: 4,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  quickPreRegBtn: {
    flexDirection: 'row',
    backgroundColor: '#19223B',
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.roundness.small,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Theme.colors.cardBorder,
    borderWidth: 1.2,
  },
  quickPreRegText: {
    fontSize: 12,
    color: Theme.colors.textPrimary,
    fontFamily: Theme.fonts.medium,
    marginLeft: 6
  },
  attendanceInlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#162036',
  },
  attRowLeft: {
    flex: 1,
    paddingRight: Theme.spacing.md,
  },
  attCourseCode: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
  },
  attCourseTitle: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  lowAttBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  lowAttText: {
    fontSize: 9,
    color: '#F44336',
    fontFamily: Theme.fonts.bold,
    marginLeft: 3
  },
  attRowRight: {
    alignItems: 'flex-end',
  },
  attPercent: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
  },
  attRatio: {
    fontSize: 9,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  statusTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
  },
  pulseCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7A7A7A',
  },
  pulseActive: {
    backgroundColor: '#4CAF50',
  },
  connectionStatusBanner: {
    borderWidth: 1.2,
    borderRadius: 6,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    alignItems: 'center',
  },
  connectionStatusText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
  },
  statusMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.primary,
  },
  syncBtn: {
    marginTop: Theme.spacing.xs,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configLabel: {
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textPrimary,
    marginBottom: 2,
  },
  configSubLabel: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    lineHeight: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.md,
  },
  emptyText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  noticeRow: {
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#161F33',
  },
  noticeDate: {
    fontSize: 11,
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.medium,
    marginBottom: 2,
  },
  noticeTitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  logRow: {
    marginBottom: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#161F33',
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  logType: {
    fontSize: 9,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textSecondary,
    marginRight: Theme.spacing.sm,
  },
  logTime: {
    fontSize: 9,
    color: Theme.colors.textMuted,
  },
  logMessage: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    paddingLeft: 12,
  },
  emptyCard: {
    backgroundColor: Theme.colors.cardBackground,
    borderWidth: 1.2,
    borderColor: Theme.colors.cardBorder,
    borderRadius: Theme.roundness.medium,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyCardText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  dayGroupCard: {
    backgroundColor: Theme.colors.cardBackground,
    borderColor: Theme.colors.cardBorder,
    borderWidth: 1.2,
    borderRadius: Theme.roundness.medium,
    marginBottom: Theme.spacing.md,
    overflow: 'hidden',
  },
  dayHeader: {
    backgroundColor: '#181E31',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
  },
  dayHeaderText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.primary,
    letterSpacing: 0.5,
  },
  classRow: {
    flexDirection: 'row',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#151C2C',
    alignItems: 'center',
  },
  classTimeBox: {
    width: 80,
    borderRightWidth: 1.2,
    borderRightColor: '#1C2337',
    paddingRight: Theme.spacing.sm,
  },
  classTimeText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
  },
  classTimeSub: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  classDetailBox: {
    flex: 1,
    paddingLeft: Theme.spacing.md,
  },
  classCourseText: {
    fontSize: 13,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
    marginBottom: 2,
  },
  classTitleText: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginBottom: 4
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  roomText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.primary,
    marginLeft: 4,
  },
  lineChartCard: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: Theme.roundness.medium,
    borderWidth: 1.2,
    borderColor: Theme.colors.cardBorder,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.sm,
  },
  lineChartCanvas: {
    position: 'relative',
    marginVertical: Theme.spacing.sm,
  },
  chartGridLine: {
    position: 'absolute',
    left: 40,
    right: 45,
    height: 1,
    backgroundColor: '#1E2536',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  gridLineLabel: {
    position: 'absolute',
    left: -32,
    width: 25,
    textAlign: 'right',
    fontSize: 9,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.regular,
  },
  chartDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Theme.colors.primary,
    borderColor: '#0A0E1A',
    borderWidth: 2,
    zIndex: 20,
  },
  chartTooltip: {
    position: 'absolute',
    bottom: 18,
    left: -35,
    backgroundColor: '#1B2338',
    borderColor: Theme.colors.primary,
    borderWidth: 1,
    borderRadius: 4,
    padding: 4,
    width: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 100,
  },
  tooltipText: {
    fontSize: 8,
    fontFamily: Theme.fonts.bold,
    color: '#FFF',
  },
  tooltipSubText: {
    fontSize: 8,
    color: Theme.colors.primary,
    marginTop: 2,
  },
  chartXAxis: {
    position: 'relative',
    height: 20,
    marginTop: 6,
    paddingBottom: 2,
  },
  chartXLabel: {
    fontSize: 9,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
    width: 45,
    textAlign: 'center',
  },
  chipsWrapper: {
    marginBottom: Theme.spacing.md,
  },
  selectorLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#161F33',
    borderColor: '#243254',
    borderWidth: 1,
    marginRight: Theme.spacing.sm,
  },
  chipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  chipText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    fontFamily: Theme.fonts.medium,
  },
  chipTextActive: {
    color: '#FFF',
    fontFamily: Theme.fonts.bold,
  },
  trimesterSummaryBox: {
    backgroundColor: '#0F1527',
    borderWidth: 1.2,
    borderColor: '#1D2A4F',
    borderRadius: Theme.roundness.medium,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  trimBoxTitle: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
    marginBottom: 8,
  },
  trimBoxMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trimMetricItem: {
    flex: 1,
  },
  trimMetricLabel: {
    fontSize: 9,
    color: Theme.colors.textMuted,
    marginBottom: 2,
  },
  trimMetricValue: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.primary,
  },
  courseHistoryRow: {
    flexDirection: 'row',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#151C2C',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courseHistoryMain: {
    flex: 1,
    paddingRight: Theme.spacing.md,
  },
  courseHistoryCode: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
    marginBottom: 2,
  },
  courseHistoryTitle: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  courseHistoryCredits: {
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  courseHistoryGradeBox: {
    alignItems: 'flex-end',
    width: 50,
  },
  courseHistoryGradeText: {
    fontSize: 15,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.primary,
  },
  courseHistoryPointsText: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  courseHistoryRowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#151C2C',
  },
  expandedMarksContainer: {
    backgroundColor: '#0F1524',
    padding: Theme.spacing.md,
    borderRadius: Theme.roundness.small,
    marginTop: Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
    borderColor: '#1D253B',
    borderWidth: 1,
  },
  marksSplitTitle: {
    fontSize: 11,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  markItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A2338',
  },
  markItemName: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    flex: 1,
    paddingRight: Theme.spacing.xs,
  },
  markItemValue: {
    fontSize: 11,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.primary,
  },
  emptyMarksText: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontStyle: 'italic',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '80%',
    backgroundColor: Theme.colors.background,
    borderTopLeftRadius: Theme.roundness.medium,
    borderTopRightRadius: Theme.roundness.medium,
    borderColor: Theme.colors.cardBorder,
    borderTopWidth: 1.5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderBottomColor: '#161F33',
    borderBottomWidth: 1.2,
    backgroundColor: '#070A13',
  },
  modalTitleText: {
    fontSize: 15,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
  },
  closeModalBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: Theme.spacing.md,
  },
  regCard: {
    backgroundColor: Theme.colors.cardBackground,
    borderColor: Theme.colors.cardBorder,
    borderWidth: 1.2,
    borderRadius: Theme.roundness.medium,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regCode: {
    fontSize: 13,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textPrimary,
    marginBottom: 2,
  },
  regTitle: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  regCredits: {
    fontSize: 9,
    color: Theme.colors.textMuted,
    marginBottom: 2,
  },
  regTime: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.primary,
  },
  regStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  regStatusText: {
    fontSize: 9,
    fontFamily: Theme.fonts.bold,
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // height is set dynamically via inline styles
    flexDirection: 'row',
    borderTopWidth: 1.2,
    borderTopColor: Theme.colors.cardBorder,
    backgroundColor: '#070A13',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  bottomTabActive: {
    borderTopWidth: 2,
    borderTopColor: Theme.colors.primary,
  },
  bottomTabText: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textMuted,
    marginTop: 4,
  },
  bottomTabTextActive: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.bold,
  },

  // --- Dynamic routine tracker styles ---
  trackerClassCard: {
    borderColor: '#1D2D49',
    borderWidth: 1.5,
    backgroundColor: '#0A0E1A',
  },
  noClassCard: {
    backgroundColor: '#0C1322',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#1D2A45',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
  },
  noClassText: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
  },
  classStatusRow: {
    paddingVertical: 4,
  },
  classStatusRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#16233B',
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
  },
  statusRowHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  statusGlowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  classStatusTitle: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    letterSpacing: 0.5,
  },
  trackerClassCode: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: '#FFF',
  },
  trackerClassTitle: {
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  trackerMetaRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  metaLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  metaLabelText: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginLeft: 4,
  },

  // --- Payment ledger modal styles ---
  ledgerRowCard: {
    backgroundColor: Theme.colors.cardBackground,
    borderColor: Theme.colors.cardBorder,
    borderWidth: 1.2,
    borderRadius: Theme.roundness.medium,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#162035',
    paddingBottom: 4,
    marginBottom: 6,
  },
  ledgerSl: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.textMuted,
  },
  ledgerDate: {
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  ledgerDetailMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerFeeType: {
    fontSize: 13,
    fontFamily: Theme.fonts.bold,
    color: '#FFF',
  },
  ledgerCourseCode: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  ledgerRemark: {
    fontSize: 10,
    color: Theme.colors.primary,
    marginTop: 4,
  },
  ledgerAmtBox: {
    alignItems: 'flex-end',
  },
  ledgerAmtText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
  },
  ledgerDiscountText: {
    fontSize: 9,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  ledgerFooterRow: {
    marginTop: 6,
    paddingTop: 4,
    borderTopColor: '#162035',
    borderTopWidth: 0.5,
  },
  ledgerSemester: {
    fontSize: 9,
    color: Theme.colors.textMuted,
  },

  // --- Results Dropdown Picker ---
  dropdownWrapper: {
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.xs,
  },
  dropdownButton: {
    backgroundColor: '#0F1624',
    borderWidth: 1,
    borderColor: '#1F2E45',
    borderRadius: 8,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  dropdownButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
  },
  dropdownButtonArrow: {
    color: Theme.colors.primary,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModalContent: {
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1E2D4A',
    borderRadius: 12,
    width: '85%',
    maxHeight: '60%',
    padding: Theme.spacing.md,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#162035',
    paddingBottom: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  dropdownModalTitle: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: Theme.fonts.bold,
  },
  dropdownModalClose: {
    color: Theme.colors.textMuted,
    fontSize: 16,
    padding: 4,
  },
  dropdownOptionsList: {
    width: '100%',
  },
  dropdownOption: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: 6,
    marginBottom: 4,
  },
  dropdownOptionActive: {
    backgroundColor: '#11223A',
  },
  dropdownOptionText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
  },
  dropdownOptionTextActive: {
    color: Theme.colors.primary,
    fontFamily: Theme.fonts.bold,
  },

  // --- Academic Calendar & Progress Widget ---
  calendarProgressContainer: {
    marginVertical: Theme.spacing.sm,
    backgroundColor: '#0B0F1A',
    borderRadius: 8,
    padding: Theme.spacing.sm,
    borderWidth: 0.5,
    borderColor: '#1A253E',
  },
  calendarProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarProgressLabelText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontFamily: Theme.fonts.bold,
  },
  calendarProgressValueText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontFamily: Theme.fonts.bold,
  },
  calendarProgressBarOutline: {
    height: 6,
    backgroundColor: '#152033',
    borderRadius: 3,
    overflow: 'hidden',
  },
  calendarProgressBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 3,
  },
  calendarProgressDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  calendarProgressDateText: {
    color: Theme.colors.textMuted,
    fontSize: 9,
  },
  nextEventHighlightCard: {
    backgroundColor: '#0F1626',
    borderWidth: 1,
    borderColor: '#1E2D4A',
    borderRadius: 8,
    padding: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Theme.spacing.xs,
  },
  nextEventInfo: {
    flex: 1,
    marginRight: Theme.spacing.sm,
  },
  nextEventLabel: {
    color: Theme.colors.primary,
    fontSize: 9,
    fontFamily: Theme.fonts.bold,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nextEventTitle: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: Theme.fonts.bold,
    marginBottom: 2,
  },
  nextEventDate: {
    color: Theme.colors.textMuted,
    fontSize: 10,
  },
  nextEventDaysBadge: {
    borderRadius: 12,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextEventDaysText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
  },
  expandableCalendarSection: {
    marginTop: Theme.spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: '#162035',
    paddingTop: Theme.spacing.sm,
  },
  expandCalendarToggleBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  expandCalendarToggleText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontFamily: Theme.fonts.bold,
  },
  calendarEventsList: {
    marginTop: Theme.spacing.sm,
    backgroundColor: '#0B0F1A',
    borderRadius: 8,
    paddingHorizontal: Theme.spacing.sm,
    paddingTop: Theme.spacing.xs,
    borderWidth: 0.5,
    borderColor: '#1A253E',
  },
  calendarEventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: '#162035',
  },
  calendarEventLeft: {
    flex: 1,
    marginRight: Theme.spacing.sm,
  },
  calendarEventRight: {
    alignItems: 'flex-end',
  },
  calendarEventTitle: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: Theme.fonts.bold,
    marginBottom: 2,
  },
  calendarEventDateText: {
    color: Theme.colors.textMuted,
    fontSize: 9,
  },
  calendarEventTypeBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  calendarEventTypeText: {
    fontSize: 8,
    fontFamily: Theme.fonts.bold,
  },
  calendarEventDaysLeftText: {
    color: Theme.colors.textMuted,
    fontSize: 9,
  },
});
