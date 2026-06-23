# Platform Frontend Source Code & Asset Inventory

This repository contains the complete frontend architecture for our digital marketplace and custom project bidding platform. It is fully decoupled, static, and relies entirely on client-side state execution. 

This document serves as a clean, concise technical manifest detailing **exactly what files exist in the codebase right now**, what they do, and what variables/hooks are currently present. It omits all non-existent backend systems or future roadmap ideas so development teams have an uninflated, precise baseline.

---

## 1. System Architecture Layout

The frontend codebase is split cleanly into three logical layers:
1.  **Views (`/` Root):** Static HTML5 semantic structures. They contain no hardcoded server data and feature precise class/ID tags for script targeting.
2.  **Core & Page Logic (`js/`):** A centralized HTTP client module, browser session state tracking, an isolated UI animation library, and 1:1 page controllers that capture DOM events.
3.  **Presentation & Themes (`css/`):** Unified responsive layout rules governed by a centralized design token file containing Light/Dark mode CSS variables.

---

## 2. Complete File Inventory

### HTML Templates (Views)
*   **`index.html`** (Landing): Layout structure for the main homepage. Contains structural containers for trending template cards, free tutorials, and featured creator frames. It includes baseline initialization hooks for homepage carousels.
*   **`dashboard.html`** (User Panel): A unified, responsive interface utilizing tabbed UI components. It is structured to toggle panels based on the authenticated user's role:
    *   *Buyer Layouts:* Containers for asset purchase histories, tracking, and account preferences.
    *   *Creator Layouts:* Form elements for digital file uploads, tutorial hosting, active custom project tracking, and payout balance profiles.
*   **`admin.html`** (Management Panel): A high-privilege administrative board layout. Contains structured data tables for reviewing pending digital assets (approval/rejection UI actions), modifying user roles, handling dispute cases, tracking stuck orders, and evaluating platform commission margins.
*   **`marketplace.html`** (Directory Feed): The main public directory screen. Renders search input elements and a comprehensive grid structure featuring multi-tier filter dropdowns to display paid templates and free video tutorials. Houses modal pop-ups for media previews and billing configurations.
*   **`project-marketplace.html`** (Bidding Hub): Freelance board workspace layout. Contains a chronological listing feed for public project briefs and explicit modal forms enabling creators to input pricing bids on open assignments.
*   **`messages.html`** (P2P Chat UI): A dedicated split-pane real-time communication layout. The left column maps conversational threads, while the main right pane handles the active live-chat log. Includes element action triggers to modify or delete chat messages in place.
*   **`creator.html`** (Public Profiles): Public directory grid and profile layout. Houses layout modules to display individual creator ratings, follower tallies, asset portfolios, and shortcuts to launch direct messages.
*   **`login.html` & `signup.html`** (Authentication Portals): Form layout frameworks for user onboarding. The sign-up layout contains distinct form path views separating buyers from creators, an interactive password strength indicator string, explicit informational details on an instant payment layout, and optional user crypto-wallet address input fields.
*   **`verify-email.html` & `reset-password.html`** (Token Landing Views): Basic utility layouts designed to capture incoming security string validation parameters directly out of the URL query string and render success or exception alert blocks to the client.
*   **`payment-callback.html`** (Transaction Processing): A clean transaction loading view. Displays standard waiting/processing status layouts and final download button elements triggered once payment verification concludes.

### Client-Side Logic (`js/`)
*   **`js/core/api.js`** (HTTP Client): The master wrapper for all outbound network requests (`fetch`/`XHR`). Configured to centrally inject JWT authorization headers into request headers, run silent authentication token refreshes, manage request rate-limiting states, and process binary multi-part file uploads.
*   **`js/core/state.js`** (Session Manager): Controls client-side authentication states. Securely sets, reads, and clears JWT identity tokens and user schemas within browser session storage, and tracks global UI variables like the live unread message count badge.
*   **`js/core/reveal.js`** (Animation Engine): A performance-focused UI styling library. Handles presentation-only features such as custom client cursors, magnetic buttons, parallax backgrounds, 3D card tilt transformations, and canvas particle emitters. (Completely decoupled from any business data).
*   **`js/core/navbar.js`** (Navigation Controller): Builds the universal responsive header menu, mobile drawer toggles, and dark/light theme modifiers. Executes localized background interval polling loops to check for incoming notifications.
*   **`js/core/toast.js`** (Notification Interceptor): A global UI feedback module. Intercepts incoming network error codes and raw JavaScript runtime exceptions to paint temporary, color-coded, dismissible alert banners on the screen.
*   **`js/pages/*.js`** (Page Controllers): Modular JavaScript controllers mapped 1:1 to every single HTML template. They capture local form submissions, intercept click actions, manage on-page tab switches, trigger modal display states, validate local file sizing bounds, and direct cleanly formatted data payloads down into `js/core/api.js`.

### Stylesheets (`css/`)
*   **`css/global.css`**: The structural baseline for the application. Establishes core layout resets, typography tokens, unified button behaviors, form element rules, and mobile menu layouts alongside a strict list of Light/Dark color variable overrides.
*   **`css/homepage.css`**: Design rules strictly bounded to the landing platform. Controls explicit styling parameters for video sections, hero modules, promotional layouts, and overlapping image frames.
*   **`css/creator.css`**: Style sheets for creator profiles and directory directories. Governs banner sizing, background blur filters, tabs, and interactive card layouts.
*   **`css/dashboard.css`**: Layout systems handling user dashboards. Styles the vertical dashboard navigation panel, analytics data grids, and the file upload drop zones.

---

## 3. Deployment Notes for Development

1.  **API Integration Point:** All outgoing calls are channeled through `js/core/api.js`. The baseline API URL route parameters need to be adjusted from localized mock endpoints to your live server environment variables.
2.  **Authentication Handshaking:** Forms in `login.js` and `signup.js` are fully prepared to pass credentials payloads. The frontend expects a stateless JWT returned on valid login to initialize `js/core/state.js`.
3.  **Media Upload Handling:** The upload zones within `dashboard.js` and `project-marketplace.js` package binary inputs via multi-part requests. The receiving backend must handle these incoming streams via an object store configuration.
4.  **Future Changes to Payment Logic:** All checkout prompts on `marketplace.html` and `project-marketplace.html` direct event captures to `js/pages/marketplace.js`. We will later be replacing any placeholder payment logic with a dedicated multi-gateway structure routing to **Paystack** (for Ghanaian users processing in GHS), **Skrill**, and **Grey** (for international user accounts and bank transfers).
