"Udug Bets" application, a full-stack, serverless web platform for hosting and participating in football tournament prediction games. The project is built on a modern technology stack, featuring a dynamic React frontend and a robust Firebase backend, with a unique integration of Google's Vertex AI for intelligent data summaries.

### **Technology Stack**

- **Frontend**: React (v19) with TypeScript, built with Vite for a fast development experience.
- **Styling**: Tailwind CSS, including the `@tailwindcss/typography` plugin for rich text rendering.
- **Backend**: Google Firebase Platform
    - **Database**: Cloud Firestore provides a scalable NoSQL database for all application data.
    - **Authentication**: Firebase Authentication for secure user sign-up, sign-in (Email/Password & Google), and session management.
    - **Serverless Logic**: Firebase Cloud Functions (Node.js 22, TypeScript) for all backend processing, calculations, and AI integration.
- **AI Integration**: Google Cloud Vertex AI (Gemini 2.5 Flash model) is used to generate dynamic, analytical summaries of leaderboard and prediction data.
- **Data Visualization**: Recharts is used to create interactive bar and pie charts for the user dashboard.
- **UI & Layout**: `react-grid-layout` provides the core functionality for the customizable user dashboard.

---

### **Core Features**

#### **User-Facing Features**

- **Authentication**: Secure sign-up/sign-in flow with email verification and Google provider options.
- **Customizable Dashboard**: A dynamic, grid-based dashboard where users can add, remove, resize, and rearrange widgets to create their own personalized view of the tournament. Layouts are saved per-user in Firestore.
- **Data-Rich Widgets**:
    - **Leaderboard**: Displays a real-time tournament leaderboard with rank change indicators.
    - **Group Standings**: Shows official, live-calculated group stage tables.
    - **All Predictions Chart**: A bar chart visualizing the aggregated predictions from all users for any given match.
    - **My Predictions Chart**: Pie charts showing a user their personal accuracy for both match outcomes and exact scores.
    - **Champion Predictions**: A ranked list of which teams the community has picked to win, with eliminated teams visually struck through.
- **AI-Powered Summaries**: The Leaderboard and Champion Prediction widgets feature dynamically generated text summaries from Gemini, providing witty, analytical insights into the current state of the tournament.
- **Profile Management**: A user profile modal allows users to update their display name, optional bio information (DOB, sex, favorite team), and change their password.
- **Tournament Interaction**:
    - A simple flow to join tournaments using a 6-digit ticket code.
    - A dedicated view to browse joined tournaments and check prediction submission statuses.
    - An intuitive interface for entering and editing score predictions and champion picks.

#### **Administrator Features**

- **Role-Based Access Control**: The system supports `user`, `admin`, and `superadmin` roles, with features progressively enabled based on permission level.
- **Tournament Wizard**: A comprehensive, multi-step interface for creating and editing tournaments, covering:
    1.  **Details**: Name, description (with Markdown support), and complex point rules for each stage.
    2.  **Participants**: Selecting teams and assigning them to customizable groups.
    3.  **Group Matches**: Automatic generation and manual editing of the group stage schedule.
    4.  **Knockout Stage**: Generation of a skeletal structure for knockout rounds.
    5.  **Confirmation**: A final review screen before activating the tournament.
- **Real-time Management**:
    - **Score Management**: A dedicated view for admins to input official match results, which automatically triggers leaderboard recalculations.
    - **Prediction Control**: Admins can open and close prediction windows for each tournament stage in real-time.
- **User & Data Oversight**:
    - **User Management**: A responsive page for viewing all users, changing their roles, and searching by name or email.
    - **All Predictions View**: A detailed table showing every prediction from every participant, with an option to export the data as a PDF.
- **Debug & Seeding Tools (Superadmin)**: A powerful panel for generating fake users, test tournaments, and random predictions for any stage (including champions) to facilitate development and testing.

---

### **Backend Architecture & Data Integrity**

- **Serverless Logic**: All backend operations are handled by Firebase Cloud Functions, ensuring scalability and low maintenance.
- **Real-time Leaderboard Engine**: The core of the application is an event-driven system. Firestore triggers on the `tournaments` and `predictions` collections automatically invoke a `recalculateLeaderboard` function. This function processes all relevant data, calculates points and group standings, generates AI summaries, and updates the denormalized `leaderboards` document, ensuring all user-facing data is always live and accurate.
- **Secure by Design**: Firestore Security Rules are meticulously crafted to enforce data ownership and role-based permissions, preventing unauthorized access or modification of data. Key collections like `leaderboards` are write-protected from the client-side, ensuring their integrity.
