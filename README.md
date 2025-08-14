## Udug Bets prediction platform

A full-stack web application for running and participating in tournament prediction games.

The application is built on a modern, serverless architecture, providing a rich, interactive experience for both regular users and administrators. It features a customizable user dashboard, a comprehensive admin panel for tournament management, and real-time data updates.

---

### Tech Stack

* **Frontend**: React 19 (with Vite), TypeScript, Tailwind CSS
* **Backend**: Firebase Cloud Functions (v2) written in TypeScript
* **Database**: Cloud Firestore
* **Authentication**: Firebase Authentication (Email/Password & Google Provider)
* **AI Integration**: Google's Gemini 1.5 Flash model via Vertex AI for generating dynamic tournament summaries.
* **Deployment**: Firebase Hosting

---

### Core Features

#### User-Facing Features:
* **Authentication**: Secure user sign-up, login (email/password and Google), password reset, and email verification flow.
* **Customizable Dashboard**: A dynamic, grid-based dashboard (`react-grid-layout`) where users can add, remove, resize, and configure various informational widgets. Layouts are saved per user in Firestore.
* **Tournament Participation**: Users can join active tournaments using a 6-digit ticket code.
* **Prediction Entry**: An intuitive interface for submitting and updating predictions for all matches in a tournament, including group stage, knockout rounds, and the overall champion.
* **Profile Management**: Users can update their display name and other personal details, including changing their password.
* **My Tournaments View**: A dedicated view to see all joined tournaments, their status, and a summary of prediction submission completeness.

#### Admin-Facing Features:
* **Multi-Step Tournament Wizard**: A comprehensive 5-step wizard for creating and configuring tournaments, covering details, participants, group stage matches, knockout rounds, and final confirmation.
* **Participant Management**: Admins can invite users to tournaments and view all participants.
* **Score Management**: A dedicated interface for admins to input and update live scores for all matches, including seeding teams for knockout rounds and handling tie-breakers.
* **User Role Management**: Superadmins can manage user roles (promoting users to admins) and edit user details.
* **Prediction Control**: Admins can open and close prediction submissions for different stages of a tournament (e.g., lock group stage predictions once matches begin).
* **PDF Export**: Functionality to generate and download a detailed PDF summary of all predictions for a tournament using `jsPDF`.
* **Debug & Seeding Panel**: A superadmin-only view for seeding the database with test tournaments and users for development and testing purposes.

#### Shared & Backend Features:
* **Real-time Leaderboards**: Cloud Functions automatically recalculate and update tournament leaderboards in real-time whenever scores are updated or predictions are made.
* **AI-Powered Summaries**: A Cloud Function leverages the Gemini API to generate witty and insightful summaries of leaderboard standings and champion prediction trends, which are displayed on the user dashboard.

---

### Security Implementation

* **API Key Security**: All Firebase client-side keys are securely managed using environment variables (`.env.local`) and are not exposed in the source code.
* **Firestore Security Rules**: The application is protected by detailed Firestore rules that restrict data access based on user authentication, user roles (admin, superadmin), and tournament participation. This ensures users can only read/write their own data and that sensitive admin actions are properly secured.

