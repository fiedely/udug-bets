# Udug Bets - Tournament Betting Platform

Udug Bets is a dynamic and feature-rich web application for creating and managing sports tournament betting pools. Built with a modern tech stack, it provides a robust set of tools for administrators to set up detailed tournaments, from group stages to knockout rounds, while offering a seamless experience for users to participate.

## Features

The platform is divided into two main areas: a comprehensive admin panel for tournament management and a user-facing dashboard for participation.

### Admin & Superadmin Features

- **Multi-Step Tournament Wizard:** A guided 5-step process to create highly customizable tournaments.
  - **Step 1: Details:** Define the tournament name, description, start/end dates, and set custom point rules for each stage (Group Stage, Round of 16, Quarter-finals, etc.) including a champion bonus.
  - **Step 2: Participants:** Select participating teams from a predefined list of 77 countries and organize them into customizable groups.
  - **Step 3: Group Matches:** Automatically generate a round-robin schedule for all group stage matches based on the configured groups.
  - **Step 4: Knockout Matches:** Automatically generate a skeletal structure for the entire knockout phase (Round of 16, Quarter-finals, Semi-finals, Third Place Match, and Final).
  - **Step 5: Confirmation:** A final review screen summarizing all tournament details before activation.
- **Full CRUD for Tournaments:** Admins can Create, Read, Update, and Delete tournaments.
- **Real-time Match Editing:** All generated matches (both group and knockout) can be edited, including participants, date/time, and venue.
- **User Role Management:**
  - **Superadmins** can manage user roles (promote users to admin, or demote them) and edit user names.
  - **Admins** can manage tournaments.
- **Toggle Guesses:** Manually enable or disable the ability for users to make predictions on a per-tournament basis.

### User Features

- **Secure Authentication:** Users can sign up and log in using their email and password or with a single click via Google Sign-In.
- **Main Dashboard:** A central hub for users to view tournament information.
- **View Matches:** See the full schedule of upcoming matches.
- **Leaderboard:** Check rankings and see how they stack up against other players.
- *(Future)* **Prediction System:** Place and update predictions for match outcomes.

## Tech Stack

- **Frontend:** [React](https://reactjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Backend & Database:** [Firebase](https://firebase.google.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Build Tool:** [Vite](https://vitejs.dev/)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js (v16 or later)
- npm or yarn

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://your-repository-url/udug-bets.git
    cd udug-bets
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Set up Firebase:**
    - Create a new project on the [Firebase Console](https://console.firebase.google.com/).
    - Create a new Web App in your Firebase project.
    - Copy the `firebaseConfig` object.
    - In the project, navigate to `src/firebaseConfig.ts` and replace the placeholder configuration with your own.

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
    - In the Firebase Console, go to **Authentication** -> **Sign-in method** and enable **Email/Password** and **Google** providers.
    - Go to **Firestore Database** and create a new database. You will need to set up security rules. For development, you can start with open rules:
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
      **Note:** These rules are for development only. For production, you must implement secure rules.

4.  **Run the development server:**
    ```sh
    npm run dev
    ```
    The application will be available at `http://localhost:5173` (or another port if 5173 is busy).
