# Udug Bets Documentation (v2.7)

> [!NOTE]
> This documentation outlines the architecture, capabilities, and infrastructure for Udug Bets v2.7. It serves as a comprehensive reference for both developers and maintainers.

## 1. App Purpose and Capabilities

**Udug Bets** is a modern, real-time prediction and leaderboard platform designed for private tournaments (such as football championships, e-sports, etc.). It allows participants to predict match outcomes, tracks real-time points based on actual scores, and injects entertainment through automated, personalized AI-generated commentary.

### User Roles & Separation

The application strictly separates capabilities between standard Participants and Administrators:

#### 🧑‍💻 Standard Participants (Users)
- **Dashboard & Tournaments**: Browse active and past tournaments.
- **Predictions**: Submit and edit predictions for upcoming matches before they start.
- **Leaderboards**: View real-time leaderboards, point histories, and their rank compared to others.
- **AI Summaries**: Read AI-generated roasts and praises regarding the latest leaderboard shifts.
- **Live Match Monitor**: Track ongoing live matches and see how current scorelines affect their live points.

#### 🛡️ Administrators (Admins)
- **Tournament Management**: Create new tournaments using a multi-step Wizard, edit details, and configure the tournament stages.
- **Dynamic Bracket Routing**: Admins can select official tournament formats (e.g., FIFA World Cup 2026, UEFA Euro). The UI uses a recursive routing algorithm to flawlessly trace official FIFA scheduling and visual layouts, supporting manual timezone adjustments.
- **Score Management**: Input actual match scores. The system automatically finds matches missing scores and auto-scrolls to them for efficiency.
- **User Management**: Grant or revoke admin privileges, delete users.
- **AI Configuration**: Define participant contexts (gender, inside jokes, specific relationships) and manage the "Topic Library" (mandatory and optional jokes) to feed the AI Summary Engine.
- **Reporting**: Download PDF snapshots of all user predictions for a tournament to maintain an immutable record before matches begin.

---

## 2. Infrastructure Specifications

Udug Bets is built on a modern, serverless stack designed for high performance, rapid iteration, and real-time data sync.

- **Frontend Framework**: React 18, utilizing functional components and hooks.
- **Build Tool**: Vite (blazing fast HMR and optimized production bundling).
- **Language**: TypeScript (strict typing for both frontend and backend).
- **Styling**: Tailwind CSS (utility-first CSS framework for rapid UI development and fully responsive mobile views).
- **Backend/Database**: Firebase Firestore (NoSQL document database with real-time listeners).
- **Authentication**: Firebase Authentication (Google Sign-In).
- **Serverless Compute**: Firebase Cloud Functions (Node.js 22, 2nd Generation).
- **Hosting**: Firebase Hosting.
- **AI Provider**: Google Generative AI (Gemini Flash models).

---

## 3. Frontend Architecture & Capabilities

The frontend is organized by feature and role, ensuring that admin logic is heavily decoupled from standard user views.

### Directory Structure
```text
src/
├── components/
│   ├── admin/       # Exclusive admin management panels
│   ├── auth/        # Authentication components (Login)
│   ├── common/      # Reusable UI elements (Buttons, Layouts)
│   └── views/       # User-facing pages (Dashboard, Leaderboard)
├── types/           # Global TypeScript interfaces
├── utils/           # Helper functions (date formatting, scoring logic)
└── firebaseConfig.ts# Firebase initialization and service exports
```

### Key Frontend Components

1. **`src/components/admin/ScoreManagement.tsx`**
   - **Capability**: Allows admins to input real-time scores.
   - **Logic**: Automatically auto-scrolls to the first match with a missing score. Upon saving, it updates Firestore which triggers the backend leaderboard recalculation.

2. **`src/components/admin/AiConfiguration.tsx`**
   - **Capability**: The control center for AI summaries.
   - **Logic**: Admins input specific participant contexts (e.g., gender, relationships) and manage a Topic Library. The frontend writes this to the `tournament_ai_config` collection.

3. **`src/components/admin/AllPredictionsView.tsx`**
   - **Capability**: Renders a massive data grid of every user and their prediction.
   - **Logic**: Implements horizontal momentum scrolling specifically optimized for iOS (`WebkitOverflowScrolling: 'touch'`, `overscroll-x-none`) and utilizes `jspdf` and `jspdf-autotable` to export the view to a PDF.

4. **`src/components/admin/PopulateKnockoutModal.tsx`**
   - **Capability**: Allows admins to populate real-world teams into knockout brackets dynamically.
   - **Logic**: Uses a recursive algorithm (`bracketRouting.ts`) to visually sort bracket branches exactly like the official FIFA/UEFA Wikipedia brackets. Also includes editable `datetime-local` inputs to gracefully sync local timezones with official real-world match numbers.

5. **`src/components/views/Leaderboard.tsx`**
   - **Capability**: Displays the calculated leaderboard.
   - **Logic**: Listens to the `leaderboard` Firestore collection. It also renders the `AiSummary` component which displays the latest AI commentary.

---

## 4. Cloud Functions Architecture

The backend consists of Firebase Cloud Functions (2nd Gen) that react to Firestore document writes. This event-driven architecture ensures the frontend remains lightweight.

### Core Cloud Functions

1. **`onTournamentUpdate`**
   - **Trigger**: `onDocumentUpdated('tournaments/{tournamentId}')`
   - **Capability**: Triggers state transitions (e.g., moving a tournament from "Upcoming" to "Active").

2. **`onPredictionWrite`**
   - **Trigger**: `onDocumentWritten('predictions/{predictionId}')`
   - **Capability**: Aggregates the total number of predictions a user has made and updates their user profile document.

3. **`generateStagePredictions`**
   - **Trigger**: Callable Function (HTTPS)
   - **Capability**: When a tournament moves from Group Stage to Knockout Stage, this function scaffolds the empty prediction documents for the advancing teams.

---

## 5. AI Capabilities, Function, and Logic

The crown jewel of Udug Bets v2.5 is the **AI Summary Engine**. Located in `functions/src/leaderboard.ts`, this engine is triggered whenever actual match scores are updated, resulting in leaderboard shifts.

### AI Engine Workflow

1. **Data Aggregation**:
   When an admin inputs a score, the function calculates the *Old Leaderboard* and the *New Leaderboard*. It identifies exactly who moved up, who moved down, who gained points, and who got zero points.

2. **Context Retrieval**:
   The function pulls the `participant_contexts` (gender, specific relationships) and the `topics` (mandatory inside jokes) configured by the admin in the frontend.

3. **Prompt Construction**:
   The engine builds a highly engineered prompt for the Gemini model. It passes the real-world data and strict behavioral rules.

### AI Engine Code implementation (`functions/src/leaderboard.ts`)

```typescript
// 1. Fetching Admin Configured Contexts
const participantContexts = participantContextDoc.exists ? participantContextDoc.data()?.contexts || {} : {};
let participantContextPrompt = "";

if (Object.keys(participantContexts).length > 0) {
    // STRICT AI INSTRUCTIONS
    participantContextPrompt += "\n\nPLAYER CONTEXT: Use the following information to personalize your roasts and praises. Use appropriate pronouns based on gender (e.g., 'cici/mbak' for female, 'abang/om' for male, and gender-neutral 'kak/bos' for unknown). OCCASIONALLY incorporate their specific relationships if relevant to a joke, but do NOT overdo it. Keep relationship mentions sparse so it doesn't sound cheesy or repetitive. STRICT RULE: When mentioning relationships, NEVER use cheesy or dramatic adjectives like 'kesayangan', 'tercinta', 'tersayang', etc. (e.g., do not say 'mertua kesayangan' or 'sepupu tercinta'). Keep it casual, sarcastic, or purely factual.\n";
    
    // Injecting dynamic participant data
    for (const [userId, ctx] of Object.entries(participantContexts)) {
        const userObj = newLeaderboard.find(e => e.userId === userId);
        if (userObj) {
            const genderStr = ctx.gender === 'male' ? 'Male' : 'Female';
            let connectionsStr = '';
            if (ctx.connections?.length > 0) {
                const rels = ctx.connections.map(c => `${c.type} of ${c.target}`).join(', ');
                connectionsStr = ` - Connections: ${rels}`;
            }
            participantContextPrompt += `- ${userObj.userName} (${genderStr})${connectionsStr}\n`;
        }
    }
}

// 2. Fetching Topic Library (Inside Jokes)
const topicsDoc = await db.collection(`tournaments/${tournamentId}/ai_config`).doc('topics').get();
const allTopics = topicsDoc.exists ? topicsDoc.data()?.topics || [] : [];
const forcedTopics = allTopics.filter(t => t.isMandatory);
const optionalTopics = allTopics.filter(t => !t.isMandatory);

// 3. Final Prompt Assembly
const prompt = `Real-World Tournament Data:
Tournament: ${tournamentDoc.data()?.name}
Match Just Updated: ${updatedMatchesContext}

Leaderboard Movement:
${movementContext}

Previous Summary History (DO NOT REPEAT THESE JOKES):
${historyPrompt}

Available Inside Jokes / Real-World Topics:
MANDATORY TOPICS (You MUST weave these into your summary):
${forcedTopics.map(t => `- Topic: ${t.topic}. Detail: ${t.details}`).join('\n')}

OPTIONAL INSIDE JOKES:
${optionalTopics.map(t => `- Topic: ${t.topic}. Detail: ${t.details}`).join('\n')}

${participantContextPrompt}

Write a witty, sharp, and highly entertaining summary (in Indonesian). Roast the losers, praise the winners, and weave the mandatory topics seamlessly into the commentary.`;

// 4. Invoking the Gemini API
const tournamentAiSummary = await generateAiSummary(prompt, systemInstruction);
```

### AI Summary Features
- **Anti-Repetition**: The prompt includes the last 3 generated summaries and instructs the AI not to repeat the same jokes.
- **Topic Tracking**: The AI appends a hidden tag `||USED_TOPICS: id1, id2||` to its response. A cloud function regex parser reads this tag and automatically deletes the used topics from the frontend Topic Library so they aren't reused in future summaries.
- **Tone Control**: Strict prompt rules prevent the AI from using cheesy relationship descriptors (e.g., banning phrases like "sepupu tercinta"), enforcing a sarcastic, casual, and entertaining tone.
