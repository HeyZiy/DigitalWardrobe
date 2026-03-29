# Agent / Developer Instructions

Welcome to the **Digital Wardrobe (电子衣橱)** repository. 
This project is driven by a deep commitment to exceptional user experience (UX) and product management principles. When modifying this codebase, your primary goal is to **think like a Product Manager**: prioritize user convenience, minimize friction, and automate tedious tasks.

## 1. Core Philosophy: Frictionless UX & User-Centric Design (CRITICAL)
- **Zero Duplicate Entry**: Users should never have to enter the same information twice. For example, adding a piece of clothing to the wardrobe must seamlessly reflect in their financial ledgers without a second action. 
- **Automate the Tedious**: Leverage AI (Gemini Vision) and web scrapers (Puppeteer) to extract data (price, brand, category) so the user doesn't have to fill out long forms. "Pasting a screenshot" is always preferred over typing.
- **Global Convenience**: Essential actions (like adding a new purchase) should be instantly accessible from anywhere in the app (e.g., sticky global top-nav buttons) rather than hidden deeply in context-specific menus.
- **Immediate Visual Feedback**: When a user performs an action, the UI must react instantly without manual page reloads. Rely on global events (`data-refreshed`) to hot-reload connected views immediately.

## 2. Architecture: Single Source of Truth
The technical architecture strictly serves the user-centric UX vision outlined above:
- **Unified Items Table**: We use a "Single Source of Truth" database architecture to eliminate data silos. 
- The `items` PostgreSQL table acts as the unified repository for **both** the physical Wardrobe properties (color, status, location) and Financial data (price, buy_date).
- **DO NOT** use a separate `purchases` table. Instead, dynamically derive financial views (like the ledger or spending charts in `finance.js`) by filtering the `items` API.

## 3. Tech Stack & Dependencies
- **Backend AI**: Use `@google/genai` (Gemini 2.5 Flash) with strict JSON schema outputs (`application/json`) for robust visual data extraction.
- **Frontend Simplicity**: Stick to strictly vanilla JavaScript (`ES modules`), HTML, and native CSS variables. **Do not introduce bloated frameworks (React/Vue/Tailwind)**. Simple faux-routers (`app.js`) are preferred to keep the bundle size zero and cold-starts lightning fast.
- **Fail Gracefully**: Provide fallback UI for cases where scrapers or AI models fail. For instance, if the AI cannot find a price in an image, automatically degrade to a pre-filled manual form rather than abruptly erroring out.

When in doubt during development, ask yourself: *"Does this change make the user's life easier or harder?"*
