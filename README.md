# Udug Bets - Tournament Betting Platform

Udug Bets is a modern web application for creating and managing sports tournament betting pools. With a robust admin panel and an intuitive user dashboard, it streamlines tournament setup and participation for both organizers and players.

## Features

### Admin & Superadmin

- **Tournament Wizard:** A 5-step guided process for creating tournaments:
  1. **Details:** Set tournament name, description, dates, and custom point rules for each stage (including champion bonus).
  2. **Participants:** Choose teams from any countries and organize them into groups.
  3. **Group Matches:** Auto-generate round-robin schedules for group stages.
  4. **Knockout Matches:** Auto-generate the knockout phase structure (Round of 16, Quarter-finals, Semi-finals, Third Place, Final).
  5. **Confirmation:** Review all details before activating the tournament.
- **Tournament Management:** Full CRUD (Create, Read, Update, Delete) for tournaments.
- **Match Editing:** Edit all matches (group and knockout), including teams, date/time, and venue.
- **User Role Management:** 
  - **Superadmins:** Manage user roles (promote/demote admins) and edit user names.
  - **Admins:** Manage tournaments.
- **Prediction Control:** Enable or disable user predictions per tournament.

### User

- **Authentication:** Sign up and log in with email/password or Google.
- **Dashboard:** View tournament info and schedules.
- **Matches:** See all upcoming matches.
- **Leaderboard:** Track rankings and compare with other players.
- *(Coming Soon)* **Predictions:** Place and update match outcome predictions.

## Tech Stack

- **Frontend:** [React](https://reactjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Backend/Database:** [Firebase](https://firebase.google.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Build Tool:** [Vite](https://vitejs.dev/)

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

1. **Clone the repository:**
    ```sh
    git clone https://your-repository-url/udug-bets.git
    cd udug-bets
    ```

2. **Install dependencies:**
    ```sh
    npm install
    ```

3. **Configure Firebase:**
    - Create a project at [Firebase Console](https://console.firebase.google.com/).
    - Add a Web App and copy its `firebaseConfig`.
    - Replace the placeholder in `src/firebaseConfig.ts`:
      ```typescript
      // src/firebaseConfig.ts
      const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
      };
      ```
    - Enable **Email/Password** and **Google** sign-in in **Authentication**.
    - Create a **Firestore Database** and set development rules:
      ```
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /{document=**} {
            allow read, write: if true;
          }
        }
      }
      ```
      **Note:** Use secure rules for production.

4. **Start the development server:**
    ```sh
    npm run dev
    ```
    The app runs at `http://localhost:5173` (or another available port).
