# OT Roster - Police Overtime Management System

## Original Problem Statement
Build a web-based spreadsheet application for managing police overtime assignments that can be shared via email (URL).

## Architecture
- **Frontend**: React.js with Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Styling**: Professional tactical theme (light mode, high contrast, print-friendly)

## User Personas
1. **Admin/Supervisor**: Full access to manage officers, assign overtime, reset sheets
2. **Officer**: View and self-assign to overtime slots (future enhancement)

## Core Requirements
- Admin login authentication (Username: Admin, Password: 123456)
- Three OT sheet templates: RDO, Days EXT, Nights EXT
- Officer dropdown selection sorted by seniority
- Auto-populate STAR number and Seniority Date
- Timestamp recording when officers are assigned
- Duplicate officer detection across sheets
- Sergeant name/star field per sheet
- Reset All Sheets functionality
- Print-friendly layout
- PDF export capability
- Version control/change log

## What's Been Implemented (02/07/2026)
- ✅ Admin login system
- ✅ Three OT sheets with correct row counts:
  - RDO 2000-0500: 6 rows (A A B B C C pattern)
  - Days EXT 2000-2100: 4 rows (A A B B pattern)
  - Nights EXT 1600-2000: 6 rows (A A B B C C pattern)
- ✅ Officer roster management (CRUD operations)
- ✅ Officer dropdown sorted by seniority (most senior first)
- ✅ Auto-populate STAR and Seniority Date on selection
- ✅ Timestamp recording on officer selection
- ✅ Duplicate officer detection (red highlight)
- ✅ Sergeant name/star fields at top of each sheet
- ✅ Officer # and Deployment Location columns
- ✅ Reset All Sheets functionality
- ✅ Print button and print-friendly CSS
- ✅ PDF export functionality
- ✅ Admin Panel with Change Log
- ✅ Sample officer data seeding (25 officers)

## API Endpoints
- POST `/api/auth/login` - Admin authentication
- GET/POST `/api/officers` - Officer management
- PUT/DELETE `/api/officers/{id}` - Update/delete officers
- GET/PUT `/api/sheets/{type}` - Sheet data (rdo, days_ext, nights_ext)
- POST `/api/sheets/reset` - Reset all sheets
- GET `/api/version-logs` - Change history
- POST `/api/seed` - Seed sample officers

## Prioritized Backlog

### P0 - Critical (None remaining)
All core features implemented

### P1 - High Priority (Future)
- [ ] Multi-user access with role-based permissions
- [ ] Real-time collaboration (WebSocket)
- [ ] Officer self-service portal

### P2 - Medium Priority (Future)
- [ ] CSV/Excel import for officer roster
- [ ] Email notifications for OT assignments
- [ ] Historical report generation
- [ ] Shift conflict detection

## Next Tasks
1. Add your own officers via Admin Panel
2. Test the full workflow with real data
3. Share the URL with your team via email

## Shareable URL
The application is accessible at the deployed URL and can be shared directly via email.
