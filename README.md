# UIU Ping 🚀

**UIU Ping** is a premium, high-performance UCAM Smart Scraper and utility application tailored for students of **United International University (UIU)**. It provides real-time academic synchronization, attendance warnings, dynamic installment payment tracking, live class routine scheduling, and interactive result analytics—all packaged in a sleek, glassmorphic dark-mode dashboard with local offline storage support.

---

## 🌟 Key Features

1. **Ongoing & Next Class Live Tracker**
   - Evaluates system day and local time to display the current active class ("ONGOING CLASS") and next upcoming class ("UPCOMING CLASS TODAY") with subject codes, room numbers, section tags, and time slots.
   - Updates dynamically and is featured prominently on both the **Home** and **Routine** screens.

2. **Trimester Attendance Monitor**
   - Displays real-time attendance ratios (e.g. `22/24 classes`) for current registered courses.
   - Triggers red alerts for **De-collegiate Warnings** if attendance drops below the official **75%** threshold.

3. **Installment Dues & Timeline Progress Tracker**
   - Automatically calculates tuition, discount waivers, trimester fees, and paid totals.
   - Calculates the exact payment targets for all three installments:
     - **1st Installment (40%)**: `20,000 + 40% of remaining tuition & trimester fees`.
     - **2nd Installment (70%)**: `20,000 + 70% of remaining tuition & trimester fees`.
     - **3rd Installment (100%)**: `20,000 + 100% of remaining tuition & trimester fees`.
   - Tracks your progress on a step-by-step timeline and displays remaining outstanding balance.

4. **Trimester Results Filter & Cumulative CGPA Card**
   - Displays Cumulative CGPA in a card with a security toggle ("Reveal/Hide CGPA") to protect privacy.
   - Shows GPA progression graphs using responsive custom line charts with interactive click tooltips.
   - Features horizontal trimester selector chips (e.g., *Spring 2026*, *Fall 2025*) to filter detailed grades by term, showing specific trimester GPAs.

5. **Detailed Billing Ledger Modal**
   - Offers a full scrollable ledger displaying your complete transaction history (Tuition Fees, Trimester Fees, Online Payments, Late Fees) directly inside a quick-access modal.

6. **Offline Caching & Reactive Auto-Sync**
   - Saves all data locally using `AsyncStorage` so you can view routine, attendance, and billing details completely offline.
   - Periodically checks internet connectivity. When transitioning from offline to online, it automatically triggers a silent sync to refresh all caches.

7. **Tokenless GitHub Actions Compiler (Android & iOS)**
   - Integrates a complete CI/CD workflow that compiles **Android APK** and **iOS APP bundles** locally on GitHub runner agents.
   - Requires **no Expo/EAS developer account, tokens, or cloud secrets**.

---

## 🛠️ Technology Stack

- **Framework**: [Expo SDK 51 / React Native](https://reactnative.dev/) (Managed workflow, Prebuild capable).
- **Language**: [TypeScript](https://www.typescriptlang.org/) for complete type-safety.
- **Parsing Core**: [node-html-parser](https://www.npmjs.com/package/node-html-parser) for fast, lightweight HTML DOM queries.
- **Local Storage**: [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/secure-store/) for encrypted credential storage and AsyncStorage for cache layers.
- **CI/CD Pipeline**: GitHub Actions with Gradle & Xcode command-line tools.
- **Styling**: Premium custom typography (**Google Sans**) and tailored dark theme tokens in Vanilla CSS-in-JS.

---

## 📡 Data Extraction Architecture

Since UCAM lacks a public developer API, **UIU Ping** uses a native cookie-jar scraper that communicates directly with UCAM endpoints:

| Data Point | Source URL / WebMethod | Scraped Using |
| :--- | :--- | :--- |
| **Authentication** | `Security/LogIn.aspx` | Extracts `__VIEWSTATE` & `__VIEWSTATEGENERATOR` tokens, performs form-urlencoded POST, and saves session cookies in a local client cookie header jar. |
| **Notices** | `Security/StudentHome.aspx` | Parses notice list rows and date anchors. |
| **GPA History** | `Security/StudentHome.aspx/GetStudentResultSummary` | Executes AJAX POST request to the WebMethod endpoint with `roll` (Student ID) parameters. |
| **Attendance** | `Security/StudentHome.aspx/GetStudentAttendanceSummary` | Executes AJAX POST request to the WebMethod endpoint. Parses present, absent, and total class tallies. |
| **Billing Ledger** | `Bill/StudentGeneralBillV2.aspx` | Parses raw totals from input fields and loops through the transaction grid `#ctl00_MainContainer_gvStudentBillView` to build transaction histories and waiver metrics. |
| **Class Routine** | `Student/Report/RptStudentClassRoutine.aspx` | Performs a WebForms POST postback to register the SSRS session. Extracts the dynamic ControlID, and queries the direct AXD HTML4.0 export: `/Reserved.ReportViewerWebControl.axd?OpType=Export&Format=HTML4.0`. Falls back to the dashboard widget on `Security/StudentHome.aspx` if SSRS is offline. |
| **Grade Details** | `Student/StudentCourseHistory.aspx` | Parses completed academic letter grades, credits, and grade points from the course history grid. |
| **Pre-Registration** | `Registration/SelfRegistrationByStudent.aspx` | Extracts current offered courses, sections, times, and registration flags from the registration list table. |

---

## 🚀 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the Metro Bundler**:
   ```bash
   npx expo start --offline
   ```

3. **Verify compilation**:
   - Run type checks:
     ```bash
     npx tsc --noEmit
     ```

---

## 🤖 GitHub Release Building

Whenever code is pushed or merged to the `main` branch, the GitHub Actions workflow in `.github/workflows/release.yml` will run:
- **Android**: Installs JDK 17, executes `expo prebuild`, and runs `./gradlew assembleRelease` to compile an installable release APK.
- **iOS**: Installs Pod dependencies, executes `expo prebuild`, and compiles a `.app` simulator/device bundle using Xcode command-line tools.
- Both compilation binaries are automatically uploaded to your GitHub actions workflow run for quick downloads!
