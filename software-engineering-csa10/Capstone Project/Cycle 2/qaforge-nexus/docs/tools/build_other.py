from common import *

# ======================= SRS =======================
d = Doc('Software Requirements Specification', TITLE, 'SRS (IEEE 830)')
d.toc()
d.h1('1. Introduction')
d.h2('1.1 Purpose'); d.p('This document specifies the functional and non-functional requirements of QAForge Nexus v1.0, a web-based functional testing and software validation platform. It is intended for developers, testers, project guides and the QA organisation of the target company.', align='j')
d.h2('1.2 Scope'); d.p('QAForge Nexus lets an organisation of 100-200 employees manage requirements and black-box test cases, execute them automatically against HTTP/JSON systems, identify defects from failures and manage defects through a governed lifecycle, with dashboards and audit.', align='j')
d.h2('1.3 Definitions')
d.table([['Term', 'Meaning'], ['Black-box test', 'Test that checks outputs for given inputs without knowledge of internal code'], ['SUT', 'System under test'],
 ['Run', 'One execution of a selection of test cases'], ['Flaky', 'A case that fails and then passes on retry with no change'], ['SLA', 'Target time to resolve a defect by severity'],
 ['RBAC', 'Role-based access control'], ['RTM', 'Requirements traceability matrix']], widths=[4, 12])
d.h2('1.4 References'); d.bullets(['IEEE Std 830-1998', 'ISO/IEC 25010', 'Project Report (01_Project_Report.docx)'])
d.h2('1.5 Data used'); d.p('The platform ships loaded with a public dataset: Defects4J (168 real bugs, 5 Java projects). '+DS_DISCLOSE, align='j')
d.h1('2. Overall Description')
d.h2('2.1 Product perspective'); d.p('A stand-alone, self-hosted web application (Node.js server, PostgreSQL 16 database, browser client). It interacts with systems under test only through HTTP.', align='j')
d.h2('2.2 User classes')
d.table([['Role', 'Count (demo org)', 'Main responsibilities']] + [
 ['Administrator', '2', 'Users, roles, audit, projects'], ['QA Manager', '3', 'Projects, assignments, closure decisions, reporting'],
 ['QA Engineer', '25', 'Test design, execution, defect reporting, retest'], ['Developer', '67', 'Fix assigned defects'],
 ['Product Owner', '10', 'Requirements, defer decisions'], ['Viewer / Executive', '43', 'Read-only dashboards']], widths=[3.5, 3, 9.5])
d.h2('2.3 Operating environment'); d.p('Server: any OS with Node.js 22.13+ and PostgreSQL 14+ (16 tested). Client: current Chrome, Edge, Firefox or Safari. Network: HTTP access from server to systems under test.', align='j')
d.h2('2.4 Constraints and assumptions'); d.bullets(['SUT interfaces are HTTP/JSON (or text).', 'Single-server deployment; up to 200 named users.', 'Time stored in UTC (ISO 8601).'])

FR = [
 ('FR-11', 'Authentication', 'The system shall authenticate users by e-mail and password and issue a time-limited token.', 'Must'),
 ('FR-12', 'Authentication', 'The system shall lock an account for 15 minutes after 5 consecutive failed logins.', 'Must'),
 ('FR-13', 'Authentication', 'The system shall enforce a password policy (8+ characters, upper, lower, digit) and force change of temporary passwords.', 'Must'),
 ('FR-14', 'Users', 'Administrators shall create, edit, deactivate users and reset passwords.', 'Must'),
 ('FR-15', 'Users', 'The system shall list the organisation by department and role.', 'Should'),
 ('FR-21', 'Projects', 'Managers shall create projects with a unique key and an optional base URL of the SUT.', 'Must'),
 ('FR-22', 'Projects', 'Managers shall add and remove project members; non-managers see only their projects.', 'Must'),
 ('FR-31', 'Requirements', 'Users with permission shall create and edit requirements with priority and status.', 'Must'),
 ('FR-32', 'Test design', 'QA staff shall create, edit, delete and import test cases organised in suites and linked to a requirement.', 'Must'),
 ('FR-33', 'Test design', 'A test case shall define method, endpoint, headers, body, timeout and a list of assertions.', 'Must'),
 ('FR-34', 'Test design', 'The system shall support set-up cases and variable extraction for dependent tests.', 'Must'),
 ('FR-35', 'Test design', 'Test cases shall be exportable to CSV.', 'Should'),
 ('FR-41', 'Execution', 'The system shall execute selected or all automated cases against the project base URL and record status, timing, request snapshot and response excerpt.', 'Must'),
 ('FR-42', 'Execution', 'The system shall support assertions on status, JSON body path, header, text and response time.', 'Must'),
 ('FR-43', 'Execution', 'The system shall retry failed cases up to 3 times and mark pass-after-retry as flaky.', 'Must'),
 ('FR-44', 'Execution', 'The system shall allow manual runs with manually recorded results.', 'Should'),
 ('FR-45', 'Execution', 'The system shall block requests to disallowed hosts (SSRF protection) and redact secrets in evidence.', 'Must'),
 ('FR-51', 'Defects', 'A failed (non-prerequisite) result shall automatically create a defect with severity from test priority, steps, expected, actual and evidence.', 'Must'),
 ('FR-52', 'Defects', 'The system shall not create duplicate defects for the same test case; it shall increment occurrences instead.', 'Must'),
 ('FR-53', 'Defects', 'A failure after Fixed, Retesting, Verified or Closed shall reopen the existing defect.', 'Must'),
 ('FR-54', 'Defects', 'New defects shall be auto-assigned to the least-loaded active developer of the project.', 'Should'),
 ('FR-55', 'Defects', 'Users shall report defects manually.', 'Must'),
 ('FR-56', 'Lifecycle', 'The system shall enforce the defined state transitions and role permissions, returning 409/403 otherwise.', 'Must'),
 ('FR-57', 'Lifecycle', 'Fixed shall require a resolution note; Reopened, Rejected and Deferred a reason; Duplicate a reference.', 'Must'),
 ('FR-58', 'Lifecycle', 'QA shall trigger an automated retest of a Fixed defect: pass -> Verified, fail -> Reopened.', 'Must'),
 ('FR-59', 'Lifecycle', 'The system shall maintain complete history, comments, SLA due date and breach flag per defect.', 'Must'),
 ('FR-61', 'Reporting', 'The system shall provide a dashboard with pass-rate trend, opened vs resolved defects, severity, stage, workload, MTTR and SLA breaches.', 'Must'),
 ('FR-62', 'Reporting', 'The system shall provide a requirement traceability matrix with CSV export.', 'Must'),
 ('FR-63', 'Reporting', 'Run results and defects shall be exportable to CSV.', 'Should'),
 ('FR-64', 'Notifications', 'Users shall receive in-application notifications for assignments, fixes, verification and reopenings.', 'Should'),
 ('FR-71', 'Audit', 'The system shall record security-relevant actions in an audit log viewable by Admin and QA Manager.', 'Must'),
 ('FR-72', 'Demo', 'The system shall include a demo target application with switchable defects.', 'Could'),
]
d.h1('3. Specific Requirements')
d.h2('3.1 Functional requirements')
d.table([['ID', 'Area', 'Requirement', 'Priority']] + [list(r) for r in FR], widths=[1.5, 2.3, 10.6, 1.6], size=9, caption='Functional requirements')
d.h2('3.2 External interfaces')
d.bullets([('User interface:', 'responsive single-page web application; light/dark theme; keyboard accessible.'),
           ('Software interface:', 'JSON REST API under /api (see docs/API.md); CSV downloads.'),
           ('Hardware interface:', 'none.'), ('Communication:', 'HTTP/1.1; HTTPS recommended through a reverse proxy.')])
d.h2('3.3 Non-functional requirements')
d.table([['ID', 'Category', 'Requirement', 'Measure'],
 ['NFR-1', 'Performance', 'Interactive API calls respond promptly with 150 users, 404 test cases and 168 defects', '< 300 ms typical on a 2-vCPU host'],
 ['NFR-2', 'Capacity', 'Support 200 named users and 25 concurrent sessions', 'Rate limit 1200 req/min per IP'],
 ['NFR-3', 'Security', 'Salted scrypt, signed tokens, lockout, RBAC, SSRF guard, audit', 'OWASP ASVS L1 aligned'],
 ['NFR-4', 'Reliability', 'ACID transactions, CHECK and foreign-key constraints in PostgreSQL', 'No partial lifecycle transition'],
 ['NFR-5', 'Usability', 'Core task (run suite and view defects) in under 5 clicks', 'Observed'],
 ['NFR-6', 'Portability', 'Runs on Linux, macOS, Windows with Node 22.13+ and PostgreSQL 14+', 'No npm dependencies'],
 ['NFR-7', 'Maintainability', 'Layered modules; automated end-to-end tests', '22 tests (13 platform + 9 dataset)'],
 ['NFR-8', 'Auditability', 'All defect transitions timestamped with actor', '100%']], widths=[1.5, 2.5, 8, 4], size=9)
d.h2('3.4 Business rules')
d.bullets(['Severity-to-priority: Critical P1, High P2, Medium P3, Low P4.', 'SLA: Critical 24 h, High 72 h, Medium 168 h, Low 336 h.',
           'Only the assigned developer may start, fix or reject a defect.', 'A defect assignee must be a member of the project.',
           'Auto-created defects use test priority P1-P4 to derive severity.'])
d.h1('4. Requirements Traceability to Verification')
d.table([['Requirement group', 'Verified by'],
 ['FR-11..13', 'Platform tests 2, 5; ST-01..ST-05 in workbook'], ['FR-14, FR-15', 'Platform tests 3, 4'], ['FR-32..35', 'Platform test 11'],
 ['FR-41..45', 'Platform tests 6, 9, 13'], ['FR-51..55', 'Platform tests 6, 7, 10'], ['FR-56..59', 'Platform test 8'], ['FR-61..64', 'Platform test 12'], ['FR-71', 'Platform test 4']], widths=[4, 12])
d.save('02_SRS.docx')

# ======================= TEST PLAN & REPORT =======================
d = Doc('Test Plan and Test Report', TITLE, 'Test Plan & Report')
d.toc()
d.h1('1. Introduction'); d.p('This plan describes how QAForge Nexus v1.0.0 is verified and records the results obtained. Test cases are in 04_Test_Cases_and_RTM.xlsx.', align='j')
d.h1('2. Test Items and Scope')
d.bullets(['Authentication, RBAC and account protection', 'Project, requirement, suite and test-case management', 'Automated execution engine and assertions',
           'Defect identification, de-duplication and lifecycle', 'Reporting, traceability, exports', 'User interface rendering'])
d.p('Not tested in v1.0: load beyond 25 concurrent sessions, cross-browser pixel comparison, HTTPS termination, e-mail delivery.', italic=True)
d.h1('3. Approach')
d.table([['Level', 'Technique', 'Tooling'],
 ['System / API', 'Black-box: equivalence partitioning, boundary values, negative, state-transition (defect lifecycle), role-based', 'node:test + fetch against a real server'],
 ['UI smoke', 'Navigate every main page as QA Manager; check no console or page errors; screenshot review', 'Playwright (Chromium)'],
 ['Validation of the product idea', 'Run the 35-case suite on the demo target with 11 faults, then fix and regress', 'QAForge Nexus itself']], widths=[3, 8, 5])
d.h1('4. Environment')
d.table([['Item', 'Value'], ['Runtime', 'Node.js 22.23.4, Linux'], ['Database', 'PostgreSQL 16 (throw-away database per test run)'], ['Data', '150 users (synthetic), 12 departments, 6 projects (SHOP demo + 5 Defects4J), '+str(len(DATA['cases']))+' test cases, '+str(len(DATA['defects']))+' defects ('+str(DS_TOTAL_BUGS)+' real Defects4J bugs)'], ['Browser', 'Chromium via Playwright']], header=False, widths=[4, 12])
d.h1('5. Entry / Exit Criteria')
d.bullets(['Entry: build starts, PostgreSQL reachable, seed succeeds.', 'Exit: 100% of "Must" requirements verified; no open Critical/High defects in the platform; all automated tests pass.'])
d.h1('6. Risks')
d.table([['Risk', 'Mitigation'], ['Flaky timing assertions on slow hosts', 'Retries; generous thresholds'], ['Shared state in demo target between runs', 'Reset endpoint and ordered set-up cases'], ['Port conflicts in tests', 'Random port per test run'], ['PostgreSQL unavailable or restarted', 'scripts/start-local-postgres.sh; tests create and drop their own database']], widths=[8, 8])
d.h1('7. Test Execution Summary')
d.table([['Suite', 'Cases', 'Passed', 'Failed', 'Notes'],
 ['Platform end-to-end (platform.test.js)', '13', '13', '0', 'On PostgreSQL 16'],
 ['Dataset integrity (dataset.test.js)', '9', '9', '0', 'Defects4J import: 168 defects, 369 cases'],
 ['UI smoke (11 pages)', '11', '11', '0', 'No console/page errors'],
 ['Demo target automated suite, faults present', '35', '25', '10', 'Expected: 10 planted defects detected; flaky F01 absorbed by retry'],
 ['Demo target automated suite, faults fixed', '35', '35', '0', 'Regression green'],
 ['Demo target, faults reverted', '35', '25', '10', 'Closed defect reopened']], widths=[6.2, 1.5, 1.7, 1.5, 5.1], caption='Execution summary')
d.h1('8. Defects Found During Testing of the Platform')
d.p('Issues identified and resolved during this verification cycle:', align='j')
d.table([['ID', 'Description', 'Severity', 'Status'],
 ['PD-01', 'npm test script passed a directory to node --test and failed to start on Node 22; changed to a glob', 'Medium', 'Closed'],
 ['PD-02', 'Dashboard cards misaligned (CSS .card + .card margin leaked into grids)', 'Low', 'Closed'],
 ['PD-03', 'Theme toggle glyph rendered as a stray character on some fonts; replaced with text label', 'Low', 'Closed'],
 ['PD-04', 'Table ID column wrapped (TC-/0001); set to no-wrap', 'Low', 'Closed']], widths=[1.5, 10.5, 2, 2])
d.p('Observation (not a defect): the demo target\'s intermittent endpoint fails on alternate calls by design; runs with retries 0 will correctly raise a defect for it.', italic=True)
d.h1('9. Conclusion'); d.p('All planned automated verification passed. The platform meets the "Must" requirements within the stated scope and is ready for pilot use. Remaining work is listed under future enhancements in the project report.', align='j')
d.h1('10. Dataset Disclosure')
d.p('Public dataset: '+DS_CITE, align='j'); d.p(DS_DISCLOSE, align='j')
d.save('03_Test_Plan_and_Report.docx')

# ======================= USER MANUAL =======================
d = Doc('User Manual', TITLE, 'User Manual')
d.toc()
d.h1('1. Getting Started')
d.numbered(['Install Node.js 22.13 or newer and PostgreSQL (or run: docker compose up -d).', 'Set DATABASE_URL (default postgres://qaforge:qaforge@127.0.0.1:5432/qaforge). In the qaforge-nexus folder run: npm start (first start creates the schema and loads the data)', 'Open http://localhost:4000 in a browser.', 'Sign in with a demonstration account (Appendix A of the project report). Employees created by an administrator must change their temporary password at first login.'])
d.img(os.path.join(SS, '01-login.png'), 'Sign-in page', 13)
d.h1('2. Navigating the Application')
d.p('The left menu contains Dashboard, Projects, Defects, Demo Lab and Organisation; administrators and QA managers also see Audit log, and administrators see Users. The bell shows notifications; "Theme" toggles light/dark.', align='j')
d.h1('3. Dashboard')
d.img(os.path.join(SS, '02-dashboard.png'), 'Quality dashboard', 15)
d.bullets(['KPI tiles: test cases, 30-day pass rate, open defects, critical open, SLA breached, mean time to resolve.', 'Use the project selector to filter every chart.', 'Click through to defects and runs from the lower tables.'])
d.h1('4. Projects, Requirements and Test Cases')
d.img(os.path.join(SS, '04-project-lang.png'), 'Project overview', 15)
d.h2('4.1 Create a project (QA Manager / Admin)'); d.numbered(['Projects -> New project.', 'Enter a unique key (e.g. SHOP), name, description and the base URL of the system under test.', 'Add members on the Team tab.'])
d.h2('4.2 Add a requirement'); d.p('Project -> Requirements -> New. Give a title, priority (P1-P4) and status.')
d.h2('4.3 Create an automated black-box test case')
d.img(os.path.join(SS, '05-test-cases.png'), 'Test case repository', 15)
d.numbered(['Project -> Test cases -> + Test case.', 'Choose suite, requirement, type and priority.', 'Tick Automated; enter HTTP method and endpoint (relative to the base URL), optional headers and JSON body.',
            'Add assertions: type (status/body/header/text/time), path (for body/header), operator and value.', 'To pass data to later cases, add extractions (e.g. token = body path "token") and mark the producing case as Set-up.', 'Save. Use Execute on the case to try it immediately.'])
d.h1('5. Running Tests')
d.img(os.path.join(SS, '06-runs.png'), 'Test runs', 15)
d.numbered(['Project -> Test runs -> "Run automated tests".', 'Optionally pick suites, set retries (0-3), environment and name.', 'The run starts immediately; open it to watch results and see request/response evidence and assertion logs.',
            'Failed cases show the defect they raised. Flaky cases are labelled.'])
d.p('Manual runs: click "Start manual run", select cases and record Pass/Fail for each; failed manual cases can be turned into defects.', align='j')
d.h1('6. Defects')
d.img(os.path.join(SS, '07-defects.png'), 'Defect register', 15)
d.img(os.path.join(SS, '07b-defect-detail.png'), 'Defect detail with upstream Defects4J report link', 15)
d.h2('6.1 Lifecycle in practice')
d.table([['Step', 'Who', 'Action'],
 ['1', 'System / QA', 'Defect appears as New (automatically from a failed run or reported manually)'],
 ['2', 'System / QA Manager', 'Assigned (auto-assigned to least-loaded developer, or chosen manually)'],
 ['3', 'Developer', 'Start work (In Progress), then Fixed with a resolution note'],
 ['4', 'QA Engineer', 'Retest (automated button, or manual) -> Verified or Reopened'],
 ['5', 'QA Engineer / Manager', 'Close; a later regression reopens the same defect automatically']], widths=[1.5, 4.5, 10])
d.h2('6.2 Other outcomes'); d.bullets(['Reject: not a defect (reason required).', 'Defer: postpone by product decision (reason required).', 'Duplicate: link to the original defect.', 'Comments and the full history are on the defect page.'])
d.h1('7. Traceability and Reports')
d.img(os.path.join(SS, '08-traceability.png'), 'Traceability matrix', 15)
d.p('Project -> Traceability shows each requirement, its test cases, last results and open defects. Export CSV buttons are available for test cases, run results, defects and traceability.', align='j')
d.h1('8. Demo Lab')
d.img(os.path.join(SS, '09-lab.png'), 'Demo Lab', 15)
d.p('The Demo Lab controls the built-in Nexora Storefront target. "Deploy fix" repairs a planted fault; "Revert fix" re-introduces it. Typical demonstration: run the SHOP suite (failures appear and defects are raised) -> deploy fixes -> mark defects Fixed -> automated retest -> Verified -> Closed -> revert a fix and re-run to see the defect reopen.', align='j')
d.h1('9. Administration')
d.img(os.path.join(SS, '10-org.png'), 'Organisation', 15)
d.bullets(['Users (Admin): "+ New user" adds an employee, assign role and department, deactivate, reset password (a temporary password is shown once).', 'Audit log (Admin, QA Manager): who did what and when, with filters.'])
d.h1('10. Troubleshooting')
d.table([['Symptom', 'Fix'], ['"Set a base URL for this project"', 'Edit the project and enter the SUT URL (e.g. https://staging.example.com/api).'],
 ['"Account temporarily locked"', 'Wait 15 minutes or ask an administrator to reset the password.'], ['"Target host is blocked by policy"', 'Use a permitted http/https host; metadata addresses are blocked.'],
 ['Port already in use', 'Start with PORT=4100 npm start.'], ['Reset demo data', 'npm run seed (destroys current data).'], ['"connection refused" at start-up', 'Start PostgreSQL (docker compose up -d) and check DATABASE_URL.']], widths=[6, 10])
d.save('05_User_Manual.docx')
