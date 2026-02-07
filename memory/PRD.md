# OT Roster — Unit 214

## Problem Statement
Web application to manage police officer overtime rosters. Shareable via URL/email. Three OT sheet types (RDO 2000-0500, Days EXT 2000-2100, Nights EXT 1600-2000) for Friday, Saturday, Sunday.

## Architecture
- Frontend: React (Context API), Tailwind, Shadcn UI
- Backend: FastAPI + MongoDB (motor async driver)
- PDF: jspdf + jspdf-autotable

## Completed Features
- Dashboard (public, no login) with day/sheet type tabs
- 10-row layout per sheet: teams AA, AA, BB, BB, CC, CC, DD, DD, EE, EE (1 officer per row)
- Officer dropdown sorted by seniority, with manual entry option
- Auto-populate Star# and Seniority Date on selection
- CST military timestamp on assignment
- Admin Panel (login: Admin/123456) with roster CRUD, bump log, share URL/email
- Auto-bump: least-senior officer bumped when sheet full and more-senior officer signs up
- Manual lock/unlock, auto-lock deadline with countdown timer
- Export to PDF, Print, Reset All
- Duplicate detection across sheets
- 50 officers seeded from Unit 214 roster

## Layout Refactor (Completed Dec 2025)
Changed from multi-column (A,B,C,D per row) to single-officer-per-row with team labels. Backend SheetRow model cleaned up (removed assignment_b-f). All 9 sheets reset to new structure.

## Testing
- Backend: 24/24 API tests passing
- Frontend: 15/15 UI tests passing
- Test file: /app/backend/tests/test_police_ot_api.py

## Key Files
- /app/backend/server.py
- /app/frontend/src/components/RosterSheet.js
- /app/frontend/src/components/OfficerSelect.js
- /app/frontend/src/context/AppContext.js
- /app/frontend/src/pages/Dashboard.js, AdminPanel.js, Login.js

## Backlog
None — all requested features implemented.
