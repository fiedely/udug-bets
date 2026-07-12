# Udug Bets Documentation (v3.1)

> [!NOTE]
> This documentation outlines the architecture, capabilities, features, and infrastructure for Udug Bets v3.1. It serves as a comprehensive reference and guidebook for developers, maintainers, and administrators.

---

## 1. Introduction & App Purpose

**Udug Bets** is a modern, real-time prediction, leaderboard, and tournament management platform. Originally designed for private sports tournaments (e.g., FIFA World Cup, UEFA Euro, e-sports), it enables participants to predict match outcomes, tracks real-time points based on actual scores, and injects entertainment through an automated, personalized **AI-generated commentary engine**.

The v3.1 update introduces massive overhauls to the frontend user experience, introducing custom touch-scrolling inertia engines, horizontal knockout bracket trees, complex tiebreaker handling (Extra Time & Penalties), and full Progressive Web App (PWA) support.

---

## 2. Infrastructure Specifications

Udug Bets is built on a modern serverless stack designed for high performance, rapid iteration, and real-time data synchronization.

### Tech Stack
- **Frontend Framework**: React 18 (Functional Components, Custom Hooks)
- **Build Tool**: Vite (blazing fast HMR, optimized production bundling)
- **Language**: TypeScript (strict typing across both frontend and backend)
- **Styling**: Tailwind CSS (utility-first, fully responsive mobile-first views)
- **Database**: Firebase Firestore (NoSQL document database with real-time listeners)
- **Authentication**: Firebase Authentication (Google Sign-In)
- **Backend / Compute**: Firebase Cloud Functions (Node.js 22, 2nd Generation)
- **Hosting**: Firebase Hosting
- **PWA**: `vite-plugin-pwa` (offline caching, service workers, installable to home screen)
- **AI Provider**: Google Generative AI (Gemini Flash models)

---

## 3. User Roles & Capabilities

The application strictly separates capabilities between standard Participants and Administrators, ensuring a secure and focused experience for both.

### 🧑‍💻 Standard Participants (Users)
Standard users have access to the public-facing dashboard and tournament interactions.

- **Dashboard**: Browse active, upcoming, and past tournaments.
- **Predictions Submission**: Submit, review, and edit predictions for upcoming matches. Predictions lock automatically when a match begins.
- **Real-Time Leaderboard**: View dynamically calculating leaderboards, point histories, and rank comparisons.
- **Live Match Monitor**: Track ongoing live matches and instantly see how the current scoreline affects their live points via Firestore real-time listeners.
- **AI Summaries**: Read highly personalized AI-generated roasts and praises regarding the latest leaderboard shifts.
- **Knockout Bracket Viewer**: Explore the beautiful, horizontal-scrolling Knockout Tree Widget to track team advancements, extra-time scores, and penalty shootouts.

### 🛡️ Administrators (Admins)
Administrators possess complete control over tournament lifecycles, data entry, and AI behavioral configuration.

- **Tournament Wizard**: Create new tournaments using a multi-step setup wizard, edit metadata, and configure stage sequences.
- **Dynamic Bracket Routing**: Admins can map out official tournament formats (e.g., FIFA World Cup 2026). The UI uses a recursive routing algorithm to flawlessly trace official scheduling branches.
- **Score Management**: Input actual match scores. The UI auto-finds missing scores and supports complex edge cases like Extra Time (`et`) and Penalty Shootout (`p`) tiebreakers.
- **Populate Knockout Rounds**: An advanced, horizontal-scrolling visual editor that perfectly mirrors the dashboard widget, allowing admins to advance teams into the next bracket and assign match dates inline.
- **Prediction Completeness**: Monitor which users have filled out their predictions and who is missing them.
- **All Predictions View**: A massive data grid displaying every user and their exact predictions. Optimized with a custom inertia scrolling engine (`useTouchScrollLock`) and supports PDF exporting via `jspdf`.
- **User Management**: Grant/revoke admin privileges, or delete rogue users.
- **AI Configuration**: Define participant contexts (gender, inside jokes, specific relationships) and manage the "Topic Library" (mandatory and optional topics) that feeds the AI Engine.

---

## 4. Frontend Architecture

The frontend codebase is highly modular, ensuring admin logic is heavily decoupled from standard user views to reduce bundle size and maintain security.

### Directory Structure
```text
src/
├── components/
│   ├── admin/       # Exclusive admin management panels & Modals
│   ├── auth/        # Authentication components (Google Login)
│   ├── common/      # Reusable UI elements (Buttons, Layouts, Scroll Engines)
│   └── views/       # User-facing pages (Dashboard, Leaderboard, Widgets)
├── hooks/           # Custom React hooks (e.g., useTouchScrollLock)
├── types/           # Global TypeScript interfaces
├── utils/           # Helper functions (date formatting, scoring logic, routing)
└── firebaseConfig.ts# Firebase initialization and service exports
```

### Key Frontend UI Components & Innovations

1. **`useTouchScrollLock` (Custom Scroll Engine)**
   - **Innovation**: Native iOS/Android browser behaviors often conflict with complex horizontal/vertical scrolling grids. This custom hook locks diagonal panning, applies physics-based inertia, and prevents the browser's native "swipe-to-go-back" gesture from ruining the UX while navigating massive bracket trees.

2. **`KnockoutTreeWidget.tsx` & `PopulateKnockoutModal.tsx`**
   - **Feature**: A beautiful, horizontally scrolling tournament bracket tree.
   - **Logic**: It dynamically draws connecting SVG-like CSS borders between stages (e.g., connecting two Round of 16 matches to one Quarter-Final match). It visualizes Extra Time and Penalty scores gracefully (e.g., `et(1) p(5)`). The Admin version of this component natively embeds `datetime-local` and `<select>` fields directly into the graphical tree for a WYSIWYG editing experience.

3. **`AllPredictionsView.tsx`**
   - **Feature**: The ultimate admin cheat-sheet. Renders a massive matrix of every user vs. every match. Uses the touch scroll lock engine to ensure smooth navigation and utilizes `jspdf-autotable` to snapshot an immutable record.

4. **`ScoreManagement.tsx`**
   - **Feature**: Real-time score entry. Seamlessly supports switching a match into "Extra Time" or "Penalty Shootout" tiebreaker modes, dynamically rendering the extra input fields required for the Knockout Tree to consume.

---

## 5. Backend & Cloud Functions Architecture

The backend utilizes Firebase Cloud Functions (2nd Gen) that react strictly to Firestore document mutations. This event-driven architecture guarantees that the frontend remains a lightweight "dumb" client.

### Core Cloud Functions

1. **`onTournamentUpdate`**
   - **Trigger**: `onDocumentUpdated('tournaments/{tournamentId}')`
   - **Role**: Manages state transitions (e.g., auto-locking a tournament, moving it from "Upcoming" to "Active").

2. **`onPredictionWrite`**
   - **Trigger**: `onDocumentWritten('predictions/{predictionId}')`
   - **Role**: Aggregates the total number of predictions a user has made and maintains the denormalized counters on their user profile document.

3. **`generateStagePredictions`**
   - **Trigger**: Callable Function (HTTPS)
   - **Role**: When a tournament transitions from the Group Stage to the Knockout Stage, this function scaffolds the empty prediction documents for the advancing teams, ensuring users can immediately begin predicting the next phase.

---

## 6. The AI Summary Engine

The crown jewel of Udug Bets is the **AI Summary Engine** located in `functions/src/leaderboard.ts`. Triggered automatically whenever actual match scores are updated, it evaluates leaderboard shifts and generates personalized, witty commentary.

### AI Engine Workflow

1. **Data Aggregation & Delta Calculation**:
   The engine calculates the *Old Leaderboard* vs. the *New Leaderboard*. It identifies exactly who moved up, who dropped ranks, who gained massive points, and who scored zero.

2. **Context Retrieval**:
   It pulls `participant_contexts` (gender, relationships) and `topics` (mandatory inside jokes) configured by the admin in the AI Configuration panel.

3. **Prompt Construction**:
   A highly engineered prompt is built for the Gemini model, passing in real-world delta data alongside strict behavioral rules (e.g., avoiding cheesy relationship descriptors, enforcing sarcastic tones).

### Technical Implementation

```typescript
// 1. Fetching Admin Configured Contexts
const participantContexts = participantContextDoc.exists ? participantContextDoc.data()?.contexts || {} : {};
let participantContextPrompt = "";

if (Object.keys(participantContexts).length > 0) {
    // STRICT AI TONE CONTROL
    participantContextPrompt += "\n\nPLAYER CONTEXT: Use the following information to personalize your roasts and praises. Use appropriate pronouns based on gender. STRICT RULE: When mentioning relationships, NEVER use cheesy or dramatic adjectives like 'kesayangan', 'tercinta'. Keep it casual, sarcastic, or purely factual.\n";
    
    // Injecting dynamic participant data
    for (const [userId, ctx] of Object.entries(participantContexts)) {
        // Build participant string...
    }
}

// 2. Fetching Topic Library (Inside Jokes)
const topicsDoc = await db.collection(`tournaments/${tournamentId}/ai_config`).doc('topics').get();
const allTopics = topicsDoc.exists ? topicsDoc.data()?.topics || [] : [];
const forcedTopics = allTopics.filter(t => t.isMandatory);

// 3. Final Prompt Assembly
const prompt = `Real-World Tournament Data:
Tournament: ${tournamentDoc.data()?.name}
Match Just Updated: ${updatedMatchesContext}

Leaderboard Movement:
${movementContext}

Previous Summary History (DO NOT REPEAT THESE JOKES):
${historyPrompt}

Available Inside Jokes / Real-World Topics:
MANDATORY TOPICS:
${forcedTopics.map(t => `- Topic: ${t.topic}. Detail: ${t.details}`).join('\n')}

${participantContextPrompt}

Write a witty, sharp, and highly entertaining summary (in Indonesian). Roast the losers, praise the winners.`;

// 4. Invoking the Gemini API
const tournamentAiSummary = await generateAiSummary(prompt, systemInstruction);
```

### AI Ecosystem Features
- **Anti-Repetition Memory**: The prompt natively includes the last 3 generated summaries and instructs the AI not to repeat identical jokes.
- **Topic Tracking & Auto-Deletion**: The AI appends a hidden tag `||USED_TOPICS: id1, id2||` to its response. A cloud function regex parser reads this tag and automatically deletes the used topics from the frontend Topic Library, ensuring fresh commentary over the lifespan of a month-long tournament.
- **Tone Control**: Strict instructions prevent the AI from adopting a "corporate" or "cheesy" persona, forcing it into a casual, highly entertaining sports-commentator persona.
