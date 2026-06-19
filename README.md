# 🏆 Udug-Bets

**Udug-Bets** is a comprehensive, real-time tournament prediction and leaderboard web application. Originally engineered to handle the complex structure of the **FIFA World Cup 2026**, this platform allows administrators to host tournaments, invite participants, manage live match events, and track participant predictions against actual real-world results.

Built with performance, security, and mobile-responsiveness in mind, Udug-Bets leverages a modern React frontend and a robust Firebase serverless backend.

---

## 🚀 Tech Stack

### Frontend
* **Framework:** React 19 (via Vite & SWC for lightning-fast HMR and building)
* **Language:** TypeScript for end-to-end type safety
* **Styling:** TailwindCSS 3 for utility-first, responsive design
* **Layouts:** `react-grid-layout` for the highly customizable user widget dashboard
* **Drag and Drop:** `@dnd-kit/core` & `@dnd-kit/sortable` for mobile-friendly touch/drag interactions
* **Internationalization:** `react-i18next` for multi-language support
* **Exporting:** `jspdf` & `html2canvas` for generating shareable PDF reports

### Backend & Infrastructure
* **Database:** Firebase Firestore (NoSQL realtime database)
* **Authentication:** Firebase Auth (Secure user management and login)
* **Cloud Logic:** Firebase Cloud Functions (Node.js) for backend recalculations, secure scoring, and data aggregation
* **Hosting:** Firebase Hosting

---

## ✨ Core Features

### 👑 Admin Capabilities
* **Tournament Wizard:** A step-by-step wizard to configure tournaments, add teams, map out groups, and schedule knockout stages.
* **Participant Management:** Invite users securely and manage their access rights to specific tournaments.
* **Prediction Period Toggles:** Granularly lock or unlock prediction submissions for specific stages (e.g., "Allow Group Stage Predictions", "Allow Round of 16 Predictions").
* **Live Score Controller:** Input real-time match events (goals, cards) and finalize match scores, instantly triggering system-wide leaderboard recalculations.
* **Standings Override Engine:** A drag-and-drop interface that allows admins to manually override mathematically tied Group Standings (e.g., when FIFA tiebreaker rules require a drawing of lots).

### 👤 User Dashboard (Widget System)
Users experience a dynamic, customizable dashboard powered by draggable and resizable widgets:
* **All Predictions Widget:** Intelligently auto-selects the upcoming match of the day. Users can swipe through matches and submit their score predictions before the admin locks the stage.
* **Group Standings Widget:** Real-time view of tournament groups showing Matches Played, Wins, Draws, Losses, Goal Difference, and Points.
* **Leaderboard Widget:** Tracks participant scores based on the accuracy of their predictions against actual match outcomes.
* **Prediction Point History:** Allows participants to view a detailed breakdown of where they gained or lost points.

---

## 🛡️ Security & Architecture

Udug-Bets implements strict security paradigms to ensure fair play during high-stakes tournaments:

1. **The "Payload Bouncer" (Firestore Rules):** 
   Strict security rules block any malicious payloads attempting to escalate user roles (e.g., standard users injecting `isAdmin: true` into their profile document).
2. **"Server Lock" Mechanism:** 
   Predictions are validated both on the frontend and backend. If a match has started or a tournament stage has been toggled off by the admin, Cloud Functions will instantly reject any incoming write requests.
3. **Optimized Reads:** 
   The Group Standings logic heavily relies on frontend caching and calculated Firestore documents (`leaderboards` collection) rather than brute-force querying, minimizing database read costs drastically.

---

## 🛠️ Local Development

### Prerequisites
* Node.js (v18+ recommended)
* Firebase CLI (`npm install -g firebase-tools`)

### Setup Instructions

1. **Clone and Install:**
   ```bash
   git clone <repository-url>
   cd udug-bets
   npm install
   ```

2. **Run the React Frontend:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

3. **Deploying to Production:**
   When you are ready to push updates to the live Firebase environment:
   ```bash
   # 1. Build the React production bundle
   npm run build
   
   # 2. Deploy hosting and cloud functions
   firebase deploy --only "hosting,functions"
   ```

---

## 📂 Project Structure Overview

* `/src/components/admin/` - Administrative views, modals, and the Tournament Creation Wizard.
* `/src/components/views/widgets/` - The building blocks for the customizable user dashboard.
* `/src/types/` - Shared TypeScript interfaces ensuring data consistency between Firestore and React.
* `/functions/src/` - Backend Cloud Functions (e.g., `leaderboard.ts` for automated points calculation).
* `/firebase.json` - Configuration for Firebase hosting rewrites and function deployment.
