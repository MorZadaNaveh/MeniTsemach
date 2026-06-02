# Meni Dashboard Characterization and Gap Analysis

Source: `/Users/morzadanaveh/Downloads/meni.docx`  
Date captured: 2026-06-02

This document summarizes the client's full characterization of the dashboard/system and compares it against what currently exists in this codebase.

## 1) Client Requested System (from characterization file)

The client describes a full tender-management platform with these modules:

- Dashboard
  - Main dashboard
  - Alerts center
  - Task board
- Tenders
  - Tender list
  - Create tender + file upload
  - AI tender analysis
  - Full tender details
  - Threshold conditions
  - Quality scoring criteria
  - Required documents tracking
  - Team matching
  - Winning simulation
  - Final submission package generation
- Company
  - Company profile
  - Key personnel
  - Bank accounts
  - Company documents
  - Bonds and guarantees
  - Insurance policies
  - Fixed templates
  - Approvals/standards (ISO, cyber, accessibility)
- Organizational Experience
  - Projects list
  - Project details
  - Proof documents
  - References/contacts
  - Domain catalog
- Employees and Experts
  - Employees list
  - Employee card
  - Education
  - Licenses
  - Professional experience
  - Completed projects
  - Attachments (CV/certificates)
  - Recommendations
  - Tender participation history
- AI Agent/Simulator
  - AI center
  - Tender analysis
  - Team matching
  - Win probability simulation
  - Missing items detection
  - Auto drafting
  - AI chat/questions
- Documents
  - Central document library
  - Document generator
  - Template management
  - Signatures
  - Version control
- BI and Reports
  - Tender success reports
  - Workforce utilization reports
  - Quality score reports
  - Financial reports
  - AI performance reports
- Settings
  - User management + roles
  - Expertise catalog
  - Document catalog
  - Default templates
  - Integrations (Outlook/Gmail/SharePoint)
  - Activity log
  - AI settings (models/prompts/scoring rules)

## 2) What Exists Today in This Repository

Current app is a functional front-end prototype with partial backend support (Netlify functions for storage + AI analysis), including:

- Login screen with password + OTP UX (demo flow only)
- Dashboard with:
  - Tender cards/list
  - Expiring/expired document alerts
  - Reminder section
- Tenders:
  - List, filter, open details modal
  - Create new tender
  - AI analysis upload flow
  - Basic thresholds/scoring/team tabs in tender modal
  - Simulated ZIP packaging flow
- Team module:
  - Team member CRUD-like forms
  - Experience areas
  - Project blocks
  - Excel/CSV import UI
- Simulator:
  - Runs score visualization and recommended team from local tender data
- Vault/Documents:
  - Office "bidder folder" docs
  - Expiry tracking and alerts
- Settings:
  - Office profile data
  - Security toggles UI
  - Placeholder user management text
- Backend/serverless:
  - `/.netlify/functions/store` for persistence
  - `/.netlify/functions/analyze` for Gemini tender extraction
  - `/.netlify/functions/extract-appendices` for appendix extraction

## 3) What Is Missing and Must Be Added

### Critical (Production-readiness)

- Real authentication and authorization (currently demo only)
  - No real user identity validation
  - No real OTP provider/SMS/email verification
  - No session/token lifecycle
  - No role-based access control enforcement
  - No audit/security events for login actions
- Real multi-tenant office security model
  - Data isolation per client office/company
  - Access scoping for all reads/writes
- Production-grade API layer
  - Structured backend services for users, tenders, documents, reports
  - Input validation, rate limiting, error observability

### Major Functional Gaps vs Client Characterization

- Task board module does not exist
- Company module is partial
  - Missing key personnel management, banks, insurance/bonds lifecycle, standards
- Organizational experience module is not modeled as its own domain
- Employees module is partial
  - Missing full employee card depth (education/licenses/recommendations/history with real persistence model)
- AI center is partial
  - No AI chat engine
  - No configurable AI settings/models/prompts in admin
  - No robust "missing requirements" workflow with assignment/follow-up
- Documents module is partial
  - No central library taxonomy
  - No template engine
  - No version control
  - No digital signatures flow
- BI/reporting module does not exist
- Settings module is partial
  - Users/roles, integrations, activity log are not implemented end-to-end

## 4) Login Must Be Real (Client Office Requirement)

The current login is **not real authentication**. It is a UI simulation:

- `doLogin()` moves from step 1 to OTP UI without server validation
- `showOtpHint()` displays a hardcoded demo OTP
- `enterApp()` opens the application directly

To meet "real dashboard in real client office" expectations, implement:

- Identity provider (recommended options):
  - Auth0 / Firebase Auth / Supabase Auth / AWS Cognito / custom backend auth
- Mandatory controls:
  - Password hashing (Argon2/bcrypt)
  - Secure OTP delivery (SMS/email app provider)
  - Access + refresh tokens (or secure server sessions)
  - Route/API protection middleware
  - Role/permission matrix (Admin, Editor, Viewer)
  - Audit log for auth-sensitive actions
  - Brute-force protection and account lockout policy

## 5) Suggested Delivery Phases

- Phase 1 (Security + Core): real auth, RBAC, tenant isolation, real users, core tender lifecycle
- Phase 2 (Data Completeness): company + experience + employee deep modules and strict validation
- Phase 3 (Docs + Workflow): templates, signatures, versioning, task board, missing-doc workflow
- Phase 4 (BI + AI Maturity): reports, dashboards, AI governance, prompt/model settings
- Phase 5 (Enterprise Hardening): audit/compliance, backups, monitoring, SLOs, penetration testing

## 6) Bottom Line

The current system is a strong prototype for demo and UX validation, but it is not yet a full production dashboard that matches the client's complete characterization.

The highest priority change is replacing demo login/auth with real enterprise-grade authentication and authorization, then filling the missing business modules listed above.
