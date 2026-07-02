import { parse } from 'node-html-parser';
import { BASE_URL } from './client';
import { AuthService } from '../services/auth';
import { StorageService } from '../services/storage';

export interface NoticeItem {
  id: string;
  title: string;
  date: string;
  link?: string;
}

export interface GradeItem {
  id: string;
  courseCode: string;
  courseTitle: string;
  credits: string;
  grade: string;
  gpa?: string;
}

export interface ResultSummaryItem {
  semesterId: number;
  year: number;
  semesterName: string; // e.g. "Spring", "Summer", "Fall"
  gpa: number;
  cgpa: number;
}

export interface AttendanceSummaryItem {
  courseCode: string;
  courseTitle: string;
  section: string;
  absentCount: number;
  presentCount: number;
  totalClasses: number;
  remainingClasses: number;
}

export interface RoutineItem {
  day: string; // e.g. "Saturday"
  courseCode: string;
  section: string;
  courseTitle: string;
  timeSlot: string; // e.g. "09:51 AM-11:10 AM"
  room?: string; // Room number, e.g. "309 Permanent Campus"
}

export interface CourseHistoryItem {
  semesterCode: string; // e.g. "252"
  courseCode: string;
  courseTitle: string;
  credits: number;
  grade: string;
  point: number;
}

export interface PreRegistrationItem {
  sl: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  sectionTime: string;
  registered: boolean;
}

export interface BillTransaction {
  sl: string;
  feeType: string;
  courseCode: string;
  credits: number;
  amount: number;
  discount: number;
  payment: number;
  semester: string;
  date: string;
  remark: string;
}

export interface BillingDetails {
  totalFee: number;
  totalDiscount: number;
  paidAmount: number;
  balance: number;
  scholarshipPercent: number;
  transactions: BillTransaction[];
}

export const ScraperService = {
  /**
   * Scrapes notices from UCAM dashboard
   */
  async scrapeNotices(): Promise<NoticeItem[]> {
    try {
      console.log('[ScraperService] Scraping notices...');
      const authenticated = await AuthService.ensureAuthenticated();
      if (!authenticated) {
        throw new Error('User session could not be authenticated. Please log in again.');
      }

      const response = await fetch(BASE_URL + 'Security/StudentHome.aspx');
      const html = await response.text();
      const root = parse(html);

      console.log('[ScraperService] Dashboard html loaded. Parsing notices...');
      const notices: NoticeItem[] = [];
      let noticeFound = false;

      const rows = root.querySelectorAll('tr');
      for (const rowEl of rows) {
        const rowText = rowEl.text.toLowerCase();
        let isNoticeRow = rowText.includes('notice');
        
        if (!isNoticeRow) {
          let parent = rowEl.parentNode;
          while (parent) {
            const id = (parent as any).getAttribute?.('id') || '';
            if (id.toLowerCase().includes('notice')) {
              isNoticeRow = true;
              break;
            }
            parent = parent.parentNode;
          }
        }

        if (isNoticeRow) {
          const links = rowEl.querySelectorAll('a');
          for (const linkEl of links) {
            const title = linkEl.text.trim();
            const href = linkEl.getAttribute('href');
            
            if (title && href && (href.includes('Notice') || href.includes('View') || href.includes('aspx'))) {
              let dateText = new Date().toLocaleDateString();
              const cells = rowEl.querySelectorAll('td');
              for (const tdEl of cells) {
                const tdText = tdEl.text.trim();
                if (/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(tdText) || /[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}/.test(tdText)) {
                  dateText = tdText;
                }
              }

              const id = href + '_' + title.replace(/\s+/g, '_').substring(0, 20);
              if (!notices.some(n => n.id === id)) {
                notices.push({ id, title, date: dateText, link: href });
                noticeFound = true;
              }
            }
          }
        }
      }

      if (!noticeFound) {
        console.log('[ScraperService] Selector A returned no notices. Trying fallback Selector B...');
        const links = root.querySelectorAll('a');
        for (const linkEl of links) {
          const title = linkEl.text.trim();
          const href = linkEl.getAttribute('href');
          if (title && href && (href.toLowerCase().includes('notice') || href.toLowerCase().includes('announcement'))) {
            const parentText = linkEl.parentNode?.text || '';
            const dateMatch = parentText.match(/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/);
            const date = dateMatch ? dateMatch[0] : new Date().toLocaleDateString();
            
            const id = href + '_' + title.replace(/\s+/g, '_').substring(0, 20);
            notices.push({ id, title, date, link: href });
          }
        }
      }

      console.log(`[ScraperService] Successfully parsed ${notices.length} notices.`);
      await StorageService.addScraperLog('success', `Parsed ${notices.length} notices from UCAM.`);
      return notices;
    } catch (error: any) {
      console.error('[ScraperService] Notice parsing error:', error);
      await StorageService.addScraperLog('error', `Notice scraping failed: ${error.message || error}`);
      throw error;
    }
  },

  /**
   * Scrapes trimester wise GPA and CGPA history via UCAM AJAX WebMethod
   */
  async scrapeResultSummary(studentId: string): Promise<ResultSummaryItem[]> {
    try {
      console.log('[ScraperService] Scraping result summary history...');
      const authenticated = await AuthService.ensureAuthenticated();
      if (!authenticated) {
        throw new Error('Session authentication failed.');
      }

      const response = await fetch(BASE_URL + 'Security/StudentHome.aspx/GetStudentResultSummary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': BASE_URL + 'Security/StudentHome.aspx'
        },
        body: JSON.stringify({ roll: studentId })
      });

      const resJson = await response.json();
      const rawItems = resJson.d || [];
      const history: ResultSummaryItem[] = rawItems.map((item: any) => ({
        semesterId: item.AcademicCalenderID,
        year: item.Year,
        semesterName: item.TypeName,
        gpa: parseFloat(item.GPA) || 0,
        cgpa: parseFloat(item.TranscriptCGPA) || 0
      }));

      console.log(`[ScraperService] Parsed ${history.length} result summary records.`);
      return history;
    } catch (error: any) {
      console.error('[ScraperService] Result summary scraping failed:', error);
      throw error;
    }
  },

  /**
   * Scrapes student course-wise attendance stats via UCAM AJAX WebMethod
   */
  async scrapeAttendanceSummary(studentId: string): Promise<AttendanceSummaryItem[]> {
    try {
      console.log('[ScraperService] Scraping attendance statistics...');
      const authenticated = await AuthService.ensureAuthenticated();
      if (!authenticated) {
        throw new Error('Session authentication failed.');
      }

      const response = await fetch(BASE_URL + 'Security/StudentHome.aspx/GetStudentAttendanceSummary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': BASE_URL + 'Security/StudentHome.aspx'
        },
        body: JSON.stringify({ roll: studentId })
      });

      const resJson = await response.json();
      const rawItems = resJson.d || [];
      const attendance: AttendanceSummaryItem[] = rawItems.map((item: any) => ({
        courseCode: item.FormalCode,
        courseTitle: item.Title,
        section: item.SectionName,
        absentCount: parseInt(item.AbsentCount) || 0,
        presentCount: parseInt(item.PresentCount) || 0,
        totalClasses: parseInt(item.TotalClassHeld) || 0,
        remainingClasses: parseInt(item.RemainClass) || 0
      }));

      console.log(`[ScraperService] Parsed attendance for ${attendance.length} courses.`);
      return attendance;
    } catch (error: any) {
      console.error('[ScraperService] Attendance statistics scraping failed:', error);
      throw error;
    }
  },

  /**
   * Scrapes class routine schedule, executing dynamic WebForms POST to build session before AXD export.
   */
  async scrapeClassRoutine(): Promise<RoutineItem[]> {
    try {
      console.log('[ScraperService] Scraping class routine routine...');
      const authenticated = await AuthService.ensureAuthenticated();
      if (!authenticated) {
        throw new Error('Session authentication failed.');
      }

      // 1. Fetch ReportViewer page shell
      const shellRes = await fetch(BASE_URL + 'Student/Report/RptStudentClassRoutine.aspx?mmi=40545a1642555b514e63');
      const shellHtml = await shellRes.text();
      const shellRoot = parse(shellHtml);

      // Extract WebForms parameters
      const vs = shellRoot.querySelector('#__VIEWSTATE')?.getAttribute('value') || '';
      const vsg = shellRoot.querySelector('#__VIEWSTATEGENERATOR')?.getAttribute('value') || '';
      const prev = shellRoot.querySelector('#__PREVIOUSPAGE')?.getAttribute('value') || '';

      // Determine active academic calendar option selection
      const select = shellRoot.querySelector('#ctl00_MainContainer_ddlAcaCalBatch');
      let activeCalendarId = '115'; // Default fallback (Spring 2026)
      if (select) {
        const selectedOption = select.querySelector('option[selected="selected"]') || select.querySelector('option[selected]');
        if (selectedOption) {
          activeCalendarId = selectedOption.getAttribute('value') || '115';
        } else {
          const options = select.querySelectorAll('option');
          if (options.length > 0) {
            activeCalendarId = options[0].getAttribute('value') || '115';
          }
        }
      }
      console.log('[ScraperService] Extracted active calendar selection ID:', activeCalendarId);

      // 2. Perform POST postback to register dynamic session on SSRS server
      const routineParams = new URLSearchParams();
      routineParams.append('__VIEWSTATE', vs);
      routineParams.append('__VIEWSTATEGENERATOR', vsg);
      routineParams.append('__PREVIOUSPAGE', prev);
      routineParams.append('ctl00$MainContainer$ddlAcaCalBatch', activeCalendarId);
      routineParams.append('ctl00$MainContainer$Button1', 'View Class Routine');

      const postbackRes = await fetch(BASE_URL + 'Student/Report/RptStudentClassRoutine.aspx?mmi=40545a1642555b514e63', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': BASE_URL + 'Student/Report/RptStudentClassRoutine.aspx?mmi=40545a1642555b514e63'
        },
        body: routineParams.toString()
      });
      const postbackHtml = await postbackRes.text();

      // 3. Extract dynamic SSRS ControlID from postback response
      const controlIdMatch = postbackHtml.match(/ControlID=([^&"' >]+)/i);
      if (!controlIdMatch) {
        console.log('[ScraperService] SSRS ControlID missing in postback HTML. Falling back to dashboard routine.');
        return this.fallbackDashboardRoutine();
      }

      const controlId = controlIdMatch[1];
      console.log('[ScraperService] Extracted SSRS ControlID:', controlId);

      // 4. Fetch direct HTML4.0 export from AXD control
      const exportUrl = `${BASE_URL}Reserved.ReportViewerWebControl.axd?Culture=1033&CultureOverrides=True&UICulture=1033&UICultureOverrides=True&ReportStack=1&ControlID=${controlId}&Mode=true&OpType=Export&FileName=RptStudentClassRoutine&ContentDisposition=OnlyHtmlInline&Format=HTML4.0`;
      const exportRes = await fetch(exportUrl);
      const exportHtml = await exportRes.text();
      const root = parse(exportHtml);

      // 5. Find SSRS routine table
      const tables = root.querySelectorAll('table');
      const routine: RoutineItem[] = [];
      let targetTable = null;

      for (const table of tables) {
        const text = table.text;
        if (text.includes('Formal Code') && text.includes('Course Title') && text.includes('Time Slot')) {
          targetTable = table;
          break;
        }
      }

      if (targetTable) {
        console.log('[ScraperService] Parsing SSRS routine table cells...');
        const rows = targetTable.querySelectorAll('tr');
        
        let colIndices = {
          code: 1,
          title: 2,
          day: 3,
          room: 4,
          time: 5,
          section: 6
        };

        // Find header row and map columns dynamically
        for (const row of rows) {
          const cells = row.querySelectorAll('td, th');
          const cellTexts = cells.map(c => c.text.trim().toLowerCase());
          if (cellTexts.some(t => t.includes('formal code') || t.includes('course code'))) {
            cellTexts.forEach((text, idx) => {
              if (text.includes('formal code') || text.includes('course code') || text.includes('code')) {
                colIndices.code = idx;
              } else if (text.includes('course title') || text.includes('title')) {
                colIndices.title = idx;
              } else if (text.includes('day')) {
                colIndices.day = idx;
              } else if (text.includes('room')) {
                colIndices.room = idx;
              } else if (text.includes('time slot') || text.includes('time')) {
                colIndices.time = idx;
              } else if (text.includes('section')) {
                colIndices.section = idx;
              }
            });
            console.log('[ScraperService] Dynamically mapped SSRS columns:', colIndices);
            break;
          }
        }

        let lastCode = '';
        let lastTitle = '';
        let lastSection = '';

        // Skip header row
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td');
          if (cells.length === 0) continue;

          let codeVal = '';
          let titleVal = '';
          let dayVal = '';
          let roomVal = '';
          let timeVal = '';
          let secVal = '';

          const maxIdx = Math.max(...Object.values(colIndices));
          if (cells.length > maxIdx) {
            codeVal = cells[colIndices.code].text.trim();
            titleVal = cells[colIndices.title].text.trim();
            dayVal = cells[colIndices.day].text.trim();
            roomVal = cells[colIndices.room].text.trim();
            timeVal = cells[colIndices.time].text.trim();
            secVal = cells[colIndices.section].text.trim();

            if (codeVal) lastCode = codeVal;
            if (titleVal) lastTitle = titleVal;
            if (secVal) lastSection = secVal;
          } else if (cells.length >= 5) {
            // RowSpan scenario (carry day, room, time slot)
            dayVal = cells[1].text.trim();
            roomVal = cells[2].text.trim();
            timeVal = cells[3].text.trim();
          }

          const finalCode = codeVal || lastCode;
          const finalTitle = titleVal || lastTitle;
          const finalSection = secVal || lastSection;

          if (finalCode && dayVal && timeVal) {
            let dayName = dayVal;
            if (dayVal === 'Sat') dayName = 'Saturday';
            else if (dayVal === 'Sun') dayName = 'Sunday';
            else if (dayVal === 'Mon') dayName = 'Monday';
            else if (dayVal === 'Tue') dayName = 'Tuesday';
            else if (dayVal === 'Wed') dayName = 'Wednesday';
            else if (dayVal === 'Thu') dayName = 'Thursday';
            else if (dayVal === 'Fri') dayName = 'Friday';

            routine.push({
              day: dayName,
              courseCode: finalCode,
              section: finalSection,
              courseTitle: finalTitle,
              timeSlot: timeVal.replace(/:AM/g, ' AM').replace(/:PM/g, ' PM'),
              room: roomVal || 'N/A'
            });
          }
        }
      }

      if (routine.length === 0) {
        console.log('[ScraperService] SSRS routine table was empty or not found. Falling back to dashboard routine.');
        return this.fallbackDashboardRoutine();
      }

      console.log(`[ScraperService] Scraped ${routine.length} Routine classes from SSRS.`);
      await StorageService.addScraperLog('success', `Parsed ${routine.length} routine classes with rooms from SSRS.`);
      return routine;
    } catch (error: any) {
      console.error('[ScraperService] SSRS Routine scraping error:', error);
      await StorageService.addScraperLog('warning', `SSRS routine scrape failed: ${error.message || error}. Trying fallback.`);
      return this.fallbackDashboardRoutine();
    }
  },

  /**
   * Fallback Class Routine parser from student home dashboard HTML (has no room numbers)
   */
  async fallbackDashboardRoutine(): Promise<RoutineItem[]> {
    try {
      console.log('[ScraperService] Executing dashboard routine fallback parser...');
      const response = await fetch(BASE_URL + 'Security/StudentHome.aspx');
      const html = await response.text();
      const root = parse(html);
      const table = root.querySelector('#ctl00_MainContainer_Class_Schedule');
      const routine: RoutineItem[] = [];

      if (table) {
        const rows = table.querySelectorAll('tr');
        let currentDay = '';
        for (const row of rows) {
          const headerCell = row.querySelector('td.white-text');
          if (headerCell) {
            currentDay = headerCell.text.trim();
          } else {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const codeSecText = cells[0].text.trim();
              const timeSlot = cells[1].text.trim();
              const courseTitle = row.getAttribute('title') || '';
              
              let courseCode = codeSecText;
              let section = '';
              if (codeSecText.includes(' (')) {
                const parts = codeSecText.split(' (');
                courseCode = parts[0].trim();
                section = parts[1].replace(')', '').trim();
              }
              
              let roomVal = 'N/A';
              if (cells.length >= 3) {
                roomVal = cells[2].text.trim();
              } else {
                // Check if room is inside timeSlot (e.g. "08:30 AM-10:00 AM (Room: 302)")
                const roomMatch = timeSlot.match(/(?:Room|Rm|R\.?)\s*[:#-]?\s*([A-Za-z0-9-]+)/i);
                if (roomMatch) {
                  roomVal = roomMatch[1];
                }
              }

              routine.push({
                day: currentDay,
                courseCode,
                section,
                courseTitle,
                timeSlot,
                room: roomVal
              });
            }
          }
        }
      }
      console.log(`[ScraperService] Fallback routine parser completed. Found ${routine.length} classes.`);
      return routine;
    } catch (e: any) {
      console.error('[ScraperService] Fallback routine scraping failed:', e);
      return [];
    }
  },

  /**
   * Scrapes entire completed course grades and result history details page
   */
  async scrapeCourseHistory(): Promise<CourseHistoryItem[]> {
    try {
      console.log('[ScraperService] Scraping completed course histories...');
      const authenticated = await AuthService.ensureAuthenticated();
      if (!authenticated) {
        throw new Error('Session authentication failed.');
      }

      const response = await fetch(BASE_URL + 'Student/StudentCourseHistory.aspx?mmi=40545a1642555b514e63');
      const html = await response.text();
      const root = parse(html);
      const table = root.querySelector('#ctl00_MainContainer_gvRegisteredCourse');
      const history: CourseHistoryItem[] = [];

      if (table) {
        const rows = table.querySelectorAll('tr').slice(1);
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 6) {
            const semesterCode = cells[0].text.trim();
            const courseCode = cells[1].text.trim();
            const courseTitle = cells[2].text.trim();
            const credits = parseFloat(cells[3].text.trim()) || 0;
            const grade = cells[4].text.trim();
            const point = parseFloat(cells[5].text.trim()) || 0;
            
            if (courseCode && courseTitle) {
              history.push({
                semesterCode,
                courseCode,
                courseTitle,
                credits,
                grade,
                point
              });
            }
          }
        }
      }

      console.log(`[ScraperService] Scraped ${history.length} completed course history records.`);
      return history;
    } catch (error: any) {
      console.error('[ScraperService] Course history scraping failed:', error);
      throw error;
    }
  },

  /**
   * Scrapes pre-registration course listings from the self-registration page
   */
  async scrapePreRegistrationList(): Promise<PreRegistrationItem[]> {
    try {
      console.log('[ScraperService] Scraping pre-registration course listings...');
      const authenticated = await AuthService.ensureAuthenticated();
      if (!authenticated) {
        throw new Error('Session authentication failed.');
      }

      const response = await fetch(BASE_URL + 'Registration/SelfRegistrationByStudent.aspx?mmi=40545a1642555b514e63');
      const html = await response.text();
      const root = parse(html);
      const table = root.querySelector('#ctl00_MainContainer_gvCourseRegistration');
      const preReg: PreRegistrationItem[] = [];

      if (table) {
        const rows = table.querySelectorAll('tr').slice(1);
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 6) {
            const sl = cells[0].text.trim();
            const courseCode = cells[1].text.trim();
            const courseTitle = cells[2].text.trim();
            const credits = parseFloat(cells[3].text.trim()) || 0;
            const sectionTime = cells[4].text.trim();
            const registeredText = cells[5].text.trim().toLowerCase();
            const registered = registeredText.includes('yes') || registeredText.includes('true');
            
            if (courseCode && courseTitle) {
              preReg.push({
                sl,
                courseCode,
                courseTitle,
                credits,
                sectionTime,
                registered
              });
            }
          }
        }
      }

      console.log(`[ScraperService] Scraped ${preReg.length} pre-registration course entries.`);
      return preReg;
    } catch (error: any) {
      console.error('[ScraperService] Pre-registration list scraping failed:', error);
      throw error;
    }
  },

  /**
   * Scrapes student bill values (Fees, discounts, payments, balance dues) and full payment ledger transactions.
   */
  async scrapeBillingDetails(): Promise<BillingDetails> {
    try {
      console.log('[ScraperService] Scraping billing and payment details...');
      const authenticated = await AuthService.ensureAuthenticated();
      if (!authenticated) {
        throw new Error('Session authentication failed.');
      }

      const response = await fetch(BASE_URL + 'Bill/StudentGeneralBillV2.aspx?mmi=40575a1742565b504e63');
      const html = await response.text();
      const root = parse(html);

      const totalFeeVal = root.querySelector('#ctl00_MainContainer_txtTotalFee')?.getAttribute('value') || '0';
      const totalDiscountVal = root.querySelector('#ctl00_MainContainer_txtTotalDiscount')?.getAttribute('value') || '0';
      const paidAmountVal = root.querySelector('#ctl00_MainContainer_txtPaidAmount')?.getAttribute('value') || '0';
      const balanceVal = root.querySelector('#ctl00_MainContainer_txtBalance')?.getAttribute('value') || '0';

      const totalFee = parseFloat(totalFeeVal.replace(/,/g, '')) || 0;
      const totalDiscount = parseFloat(totalDiscountVal.replace(/,/g, '')) || 0;
      const paidAmount = parseFloat(paidAmountVal.replace(/,/g, '')) || 0;
      const balance = parseFloat(balanceVal.replace(/,/g, '')) || 0;

      // Extract scholarship percentage and transaction history from the billing ledger table
      let scholarshipPercent = 0;
      const transactions: BillTransaction[] = [];
      
      const table = root.querySelector('#ctl00_MainContainer_gvStudentBillView');
      if (table) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          
          if (cells.length >= 10) {
            const sl = cells[0].text.trim();
            const feeType = cells[1].text.trim();
            const courseCode = cells[2].text.trim();
            
            const creditsVal = cells[3].text.trim();
            const amountVal = cells[4].text.trim();
            const discountVal = cells[5].text.trim();
            const paymentVal = cells[6].text.trim();
            
            const semester = cells[7].text.trim();
            const date = cells[8].text.trim();
            const remark = cells[9].text.trim();

            const credits = parseFloat(creditsVal.replace(/,/g, '')) || 0;
            const amount = parseFloat(amountVal.replace(/,/g, '')) || 0;
            const discount = parseFloat(discountVal.replace(/,/g, '')) || 0;
            const payment = parseFloat(paymentVal.replace(/,/g, '')) || 0;

            if (feeType && sl && !isNaN(parseInt(sl, 10))) {
              transactions.push({
                sl,
                feeType,
                courseCode,
                credits,
                amount,
                discount,
                payment,
                semester,
                date,
                remark
              });

              // Parse waiver percentage from tuition waiver remarks
              if (remark.toLowerCase().includes('waiver') || feeType.toLowerCase().includes('waiver')) {
                const match = remark.match(/Waiver\s+Discount\s+Percent\s*\(\s*([\d.]+)\s*%\s*\)/i);
                if (match) {
                  scholarshipPercent = parseFloat(match[1]) || 0;
                }
              }
            }
          }
        }
      }

      console.log(`[ScraperService] Scraped billing. Dues: ৳${balance}, Transactions: ${transactions.length}`);
      await StorageService.addScraperLog('success', `Scraped billing records. Dues: ৳${balance}. parsed ${transactions.length} ledger rows.`);

      return {
        totalFee,
        totalDiscount,
        paidAmount,
        balance,
        scholarshipPercent,
        transactions
      };
    } catch (error: any) {
      console.error('[ScraperService] Billing scraping failed:', error);
      await StorageService.addScraperLog('error', `Billing scrape failed: ${error.message || error}`);
      throw error;
    }
  }
};
