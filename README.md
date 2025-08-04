# Udug Bets - Advanced Tournament Prediction Platform

Udug Bets is a comprehensive, feature-rich web application for creating and participating in sports tournament prediction pools. Built with a modern tech stack including React, TypeScript, and Firebase, it provides a robust suite of tools for administrators to meticulously set up and manage tournaments, while offering a dynamic and informative experience for users to make and track their predictions.

## Features

The platform is divided into two core experiences: a powerful admin panel for complete tournament control and a user-centric dashboard for seamless participation.

### Admin & Superadmin Features

- **Multi-Step Tournament Wizard:** A guided 5-step process to create highly flexible and detailed tournaments.

  1. **Step 1: Details:** Define the tournament name, description (with Markdown support for rich text), start/end dates, and set custom point rules for every stage (Group Stage, Round of 32, Round of 16, Quarter-finals, Semi-finals, Third Place, and Final).

  2. **Step 2:** Participants: Select participating teams from an expanded list of 77 countries and organize them into a customizable number of groups.

  3. **Step 3:** Group Matches: Automatically generate a full round-robin schedule for all group stage matches, with the ability to edit any detail (teams, date, venue) after generation.

  4. **Step 4:** Knockout Stage: A highly flexible knockout configurator. Admins can select the starting round (e.g., Round of 32, Round of 16, etc.) and choose whether to include a Third Place Match, adapting to any tournament format.

  5. **Step 5:** Confirmation: A final review screen summarizing all tournament details—including point rules, participants, and full match schedules (both group and knockout)—before activation.

- **Advanced Tournament Management:**
  1. **Granular Prediction Control:** For each active tournament, admins can individually toggle prediction submissions on or off for each stage (Champion, Group Stage, R32, R16, etc.) via a convenient dropdown menu.

  2. **User Invitation System:** Invite registered users to join a tournament via a dedicated modal that separates already-joined participants from those available to invite.

  3. **Score & Seeding Management:** (Planned) A dedicated interface for admins to enter final match scores and manually seed the knockout bracket with qualifying teams.

- **User Role Management:** Superadmins can manage user roles (promote/demote admins) and edit user details.

### User Features

- **Secure Authentication:** Seamless sign-up and login via Email/Password or Google Sign-In.

- **Join Tournaments:** Users can join any active tournament by entering a unique 6-digit ticket code provided by an admin. Admins are prohibited from joining as participants.

- **"My Tournaments" Dashboard:** The user's central hub, displaying a card for each joined tournament with detailed at-a-glance information:

  1. Tournament status, date period, and total number of participants.

  2. A detailed **Prediction Submission Status** table showing which stages are open for prediction (with a "traffic light" glowing indicator) and the user's personal submission status for each stage (Complete, Incomplete, or Not Submitted).

- **Tournament Details View:** A dedicated page showing a comprehensive overview of a tournament, including the formatted description, point rules, and full match schedules.

- **Prediction Entry Page:** A sophisticated interface for submitting predictions:

  1. **Champion Prediction:** Select the tournament winner from a dropdown, with a trophy icon appearing upon selection.

  2. **Match Predictions:** Enter scores for all matches. The UI automatically displays "WIN", "LOSE", or "DRAW" badges next to teams based on the input.

  3. **Enhanced UX:** Each stage is a collapsible section, and the collapsed state is remembered in the browser. Match listings include date, time, venue, and match number.

  4. **Unsaved Changes Warning:** Users are warned if they try to leave the page with unsaved predictions.

## Tech Stack

- **Frontend:** [React](https://reactjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Backend/Database:** [Firebase](https://firebase.google.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Markdown Parsing:** [Marked](https://marked.js.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
