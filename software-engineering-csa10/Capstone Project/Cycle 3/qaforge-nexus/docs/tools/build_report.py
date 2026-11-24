from common import *

d = Doc('QAForge Nexus', TITLE, 'Project Report')
d.toc()

d.h1('Abstract')
d.p('Functional testing in mid-sized software organisations is usually split across spreadsheets, stand-alone automation scripts and a separate bug tracker. '
    'Test evidence is scattered, failures are copied by hand into defects, and nobody can answer "which requirement is not covered?" or "was this fix really verified?" quickly. '
    'QAForge Nexus is a web-based functional testing and software validation platform that closes this gap for an organisation of 100-200 employees. '
    'Testers describe black-box test cases once (request, expected status, body, header and timing assertions). The platform executes them automatically against any HTTP/JSON system under test, '
    'retries failures to separate flaky behaviour from genuine faults, and turns every genuine failure into a tracked defect with full evidence. '
    'Defects follow an enforced eleven-state lifecycle (New, Assigned, In Progress, Fixed, Retesting, Verified, Closed, Reopened, Rejected, Deferred, Duplicate) with role-based permissions, SLA clocks, automatic assignment to the least-loaded developer, automated retest and regression-aware re-opening. '
    'The system is implemented as a zero-dependency Node.js 22 application with a PostgreSQL 16 database and a single-page web client. It is loaded with the public Defects4J dataset (168 real bugs from five open-source Java projects, 369 derived black-box test cases), a 150-employee demonstration organisation and a built-in target application containing eleven switchable defects. '
    'In validation, the automated suite of 35 black-box cases detected all ten deterministic seeded defects, de-duplicated repeated failures, verified fixes by automated retest, and re-opened a closed defect when it regressed; 31 automated tests (13 platform, 9 dataset-integrity, 9 v3 algorithm) pass against PostgreSQL.', align='j')
d.p('Keywords: functional testing, black-box testing, test automation, defect lifecycle, traceability, software validation, quality assurance.', italic=True)

d.h1('1. Introduction')
d.h2('1.1 Background')
d.p('Software validation confirms that a product behaves as its requirements state. Black-box testing, where a tester examines inputs and outputs without reference to internal code, is the dominant technique for functional validation because it mirrors how users and integrating systems experience the product. '
    'As organisations grow past roughly one hundred people, the number of products, teams and releases grows faster than the ability of ad-hoc tooling to keep up. A 150-person company typically has several product teams, a dedicated QA group and a management layer that needs trustworthy quality metrics.', align='j')
d.h2('1.2 Problem statement')
d.bullets([
 ('Fragmented evidence.', 'Test cases live in spreadsheets, results in CI logs and defects in a tracker; none of them reference each other.'),
 ('Manual defect logging.', 'Every failed check is re-typed into a bug report, producing delays, missing evidence and duplicates.'),
 ('Unreliable verification.', 'Fixes are marked "done" without proof; regressions are rediscovered by customers.'),
 ('No requirement visibility.', 'Managers cannot see which requirements have tests, which pass, and which have open defects.'),
 ('Weak governance.', 'Anyone can close a bug; there is no audit trail, SLA, or role separation between developers and testers.')])
d.h2('1.3 Objectives')
d.numbered([
 'Provide a single web platform for requirements, test design, execution and defect management.',
 'Execute black-box functional test cases automatically against HTTP/JSON systems and capture request/response evidence.',
 'Identify defects automatically from failed executions, avoiding duplicates and re-opening regressions.',
 'Enforce a governed defect lifecycle with role-based permissions, SLA tracking and a full audit trail.',
 'Offer live dashboards, requirement traceability and CSV exports for managers.',
 'Support an organisation of 100-200 employees: multiple departments, projects, roles and concurrent users.'])
d.h2('1.4 Scope')
d.p('In scope: functional black-box validation of web APIs, manual test recording for UI/mobile products, defect management, reporting, user and role administration and auditing. '
    'Out of scope for v1.0: browser-driven UI automation, performance load generation, white-box coverage measurement and e-mail delivery (notifications are in-application).', align='j')
d.h2('1.5 Target organisation')
d.p('The platform is configured for the fictitious company Nexora Technologies: 150 employees in 12 departments. Table 1 and Table 2 show the simulated organisation used for demonstration and testing; employees are synthetic and no real personal data is used.', align='j')
d.h2('1.6 Public dataset used')
d.p('To avoid synthetic quality data, the platform is populated from Defects4J, a public database of real, reproducible bugs in Java programs. A subset of '+str(DS_TOTAL_BUGS)+' bugs from five projects is imported, each project becoming a QAForge project, each bug a defect with its upstream report link, and each trigger test a black-box test case (total '+str(DS_TOTAL_CASES)+' cases).', align='j')
d.table([['Project','Source library','Bugs (defects)','Test cases','Requirements']]+[[k, DS_NAMES[k], str(DS_DEF[k]), str(DS_CASES[k]), str(DS_REQ[k])] for k in DS_KEYS]+[['Total','',str(DS_TOTAL_BUGS),str(DS_TOTAL_CASES),str(sum(DS_REQ[k] for k in DS_KEYS))]], caption='Defects4J subset imported', widths=[2,5,3,3,3])
d.p('Source: '+DS_CITE, italic=True)
d.p(DS_DISCLOSE, align='j')
d.table([['Department', 'Code', 'Employees']] + [[a, b, str(c)] for a, b, c in ORG] + [['Total', '', str(sum(x[2] for x in ORG))]], caption='Departments of Nexora Technologies', widths=[8, 3, 3])
d.table([['Platform role', 'Key', 'Users']] + [[a, b, str(c)] for a, b, c in ROLES] + [['Total', '', str(sum(x[2] for x in ROLES))]], caption='Platform roles', widths=[8, 4, 3])

d.h1('2. Literature Survey and Existing Systems')
d.p('Several established tools address parts of the problem. None of them combines automated black-box execution, automatic defect identification and a governed lifecycle in one lightweight, self-hosted package suited to a mid-sized firm.', align='j')
d.table([
 ['Tool category', 'Examples', 'Strength', 'Limitation relevant to this project'],
 ['UI/API automation frameworks', 'Selenium, Playwright, REST-assured, Postman/Newman', 'Powerful scripted execution', 'No test management, no defect lifecycle; results live in CI logs'],
 ['Test management suites', 'TestRail, Zephyr, qTest', 'Case organisation, reporting', 'Execution is mostly manual; defect linkage is via third-party trackers; licence cost'],
 ['Issue trackers', 'Jira, Bugzilla, MantisBT', 'Flexible workflows', 'Defects are created by people, not by failed executions; no native black-box runner'],
 ['CI platforms', 'Jenkins, GitHub Actions', 'Scheduling and triggers', 'Pass/fail only; no requirement traceability or lifecycle'],
 ['QAForge Nexus (proposed)', '-', 'Design + execute + identify + govern in one tool', 'Targets HTTP/JSON systems; UI automation planned']],
 caption='Comparison with existing approaches', widths=[3.2, 3.6, 4, 5.5], size=9)
d.h2('2.1 Black-box techniques supported')
d.bullets(['Equivalence partitioning and boundary value analysis (e.g. password length 7 vs 8 characters).',
           'Negative and error-guessing tests (malformed e-mail, negative quantity, empty password).',
           'State-based and dependency tests via set-up cases and variable extraction (log in, then use the token).',
           'Security-oriented functional checks (broken access control on another user\'s order).',
           'Non-functional smoke checks using response-time assertions.'])

d.h1('3. Proposed System')
d.h2('3.1 Overview')
d.p('QAForge Nexus follows a closed loop: Requirement -> Test case -> Automated run -> Result evidence -> Defect -> Fix -> Automated retest -> Verified -> Closed, with regression detection feeding back into Reopened.', align='j')
d.h2('3.2 Key features')
d.table([['#', 'Feature', 'Description'],
 ['1', 'Automated black-box runner', 'Executes HTTP test cases in dependency order with variables, retries (0-3), timeouts and an SSRF guard'],
 ['2', 'Five assertion types', 'status, body (JSON path), header, text and response time with 13 operators (eq, neq, contains, matches, gt, lt, in, type, exists ...)'],
 ['3', 'Flaky detection', 'A case that fails then passes on retry is marked flaky and does not raise a defect'],
 ['4', 'Automatic defect identification', 'A failed result creates a defect with severity derived from test priority, steps, expected/actual and request/response evidence'],
 ['5', 'De-duplication and regression handling', 'Repeat failures increment an occurrence counter; failures after Fixed/Verified/Closed reopen the same defect'],
 ['6', 'Governed lifecycle', 'Eleven states; transition rules per role; mandatory notes for reopen, reject, defer; mandatory resolution for Fixed'],
 ['7', 'Automated retest', 'One click re-runs the linked case: pass -> Verified, fail -> Reopened'],
 ['8', 'SLA tracking', 'Due dates by severity (Critical 24 h, High 72 h, Medium 7 d, Low 14 d) and breach flags'],
 ['9', 'Traceability', 'Requirement -> test cases -> last result -> open defects matrix with CSV export'],
 ['10', 'Dashboards', 'Pass-rate trend, opened vs resolved defects, severity and stage distribution, developer workload, MTTR, SLA breaches'],
 ['11', 'Security and audit', 'scrypt password hashing, signed tokens, account lockout, RBAC, project scoping, audit log'],
 ['12', 'Demo Lab', 'Built-in target with 11 switchable defects so the whole loop can be demonstrated without external systems']],
 caption='Feature summary', widths=[0.9, 4.5, 10.6])

d.h1('4. System Analysis')
d.h2('4.1 Feasibility')
d.bullets([('Technical.', 'Node.js 22 built-ins only (http, crypto, net, tls) plus a PostgreSQL 16 server. The database driver is an in-project implementation of the PostgreSQL wire protocol (SCRAM-SHA-256, TLS, connection pool) with the same interface as the "pg" package, so the official driver can be substituted without changing application code.'),
           ('Economic.', 'No licence cost; a single small server serves 200 users (measured workload is dominated by short REST calls).'),
           ('Operational.', 'Browser-based; familiar roles; the imported Defects4J data allows training on realistic bugs in minutes.'),
           ('Schedule.', 'Modular layers (engine, lifecycle, routes, SPA) allow incremental delivery.')])
d.h2('4.2 Functional requirements (summary)')
d.p('The complete requirements are in the separate Software Requirements Specification (02_SRS.docx). Principal groups: authentication and users (FR-1x), projects and members (FR-2x), requirements and test design (FR-3x), execution (FR-4x), defects and lifecycle (FR-5x), reporting (FR-6x), administration and audit (FR-7x).', align='j')
d.h2('4.3 Non-functional requirements (summary)')
d.bullets(['Security: salted scrypt hashes, HMAC-SHA256 tokens (8 h), lockout after 5 failures, per-IP rate limit, SSRF protection, secret redaction in stored evidence.',
           'Performance: dashboard and list APIs respond in tens of milliseconds on the 404-case, 168-defect data set; runs execute sequentially with at most a fixed number in parallel.',
           'Reliability: PostgreSQL ACID transactions with CHECK and foreign-key constraints, transactional defect operations, graceful shutdown.',
           'Usability: single-page application, keyboard-accessible controls, light/dark theme.',
           'Portability: runs on any OS with Node.js 22.13+.'])

d.h1('5. System Design')
d.h2('5.1 Architecture')
d.p('The system is a three-tier web application: a browser SPA, a Node.js server containing the HTTP layer, authentication/RBAC, REST routes, the execution engine and the defect lifecycle engine, and a PostgreSQL 16 data store. The engine reaches the system under test only through HTTP, preserving the black-box property.', align='j')
d.img(os.path.join(DG, 'architecture.png'), 'System architecture', 14)
d.h2('5.2 Data flow')
d.img(os.path.join(DG, 'dfd-level1.png'), 'Level-1 data flow diagram', 16)
d.h2('5.3 Use cases')
d.img(os.path.join(DG, 'use-case.png'), 'Use cases by role', 16.5)
d.h2('5.4 Database design')
d.img(os.path.join(DG, 'er-diagram.png'), 'Entity-relationship diagram', 15)
d.table([['Table', 'Purpose', 'Key columns'],
 ['departments / users', 'Organisation directory and accounts', 'emp_code, email, role, department_id, password_hash, locked_until'],
 ['projects / project_members', 'Products under test and their teams', 'key, base_url, owner_id'],
 ['requirements', 'Business requirements', 'code (REQ-nnn), priority, status'],
 ['suites / test_cases', 'Test design', 'method, endpoint, headers, body, assertions (JSON), extract (JSON), automated, is_setup, depends_on_previous'],
 ['test_runs / test_results', 'Execution history and evidence', 'status, totals, attempts, flaky, request_snapshot, response_excerpt, assertion_log, defect_id'],
 ['defects', 'Defect register', 'severity, priority, status, source (auto/manual), occurrences, reopen_count, sla_due, duplicate_of'],
 ['defect_history / defect_comments', 'Audit trail and discussion', 'from_status, to_status, actor_id, note'],
 ['notifications / audit_log', 'User alerts and security audit', 'message, link, action, entity, ip'],
 ['counters', 'Per-project sequence generator', 'kind (defect, run, case, requirement)']],
 caption='Data dictionary (summary; full DDL in docs/schema.sql)', widths=[4, 4.5, 7.5])
d.h2('5.5 Defect lifecycle design')
d.img(os.path.join(DG, 'defect-lifecycle.png'), 'Defect state machine', 15)
d.table([['Target state', 'Allowed roles', 'Required input'],
 ['Assigned', 'Admin, QA Manager', 'Assignee (must be project member)'],
 ['In Progress', 'Admin, QA Manager, assigned Developer', '-'],
 ['Fixed', 'Admin, QA Manager, assigned Developer', 'Resolution note'],
 ['Retesting / Verified / Closed', 'Admin, QA Manager, QA Engineer', '-'],
 ['Reopened', 'Admin, QA Manager, QA Engineer', 'Reason note'],
 ['Rejected', 'Admin, QA Manager, assigned Developer', 'Reason note'],
 ['Deferred', 'Admin, QA Manager, Product Owner', 'Reason note'],
 ['Duplicate', 'Admin, QA Manager, QA Engineer', 'Reference to another defect in the same project']],
 caption='Transition rules', widths=[4, 6, 6])
d.h2('5.6 Execution sequence')
d.img(os.path.join(DG, 'run-sequence.png'), 'Automated run sequence', 15.5)
d.h2('5.7 Security design')
d.bullets(['Passwords: scrypt (N=16384, r=8) with 16-byte random salt; policy of 8+ characters with upper, lower and digit; seeded users must change password at first login.',
           'Sessions: HMAC-SHA256 signed tokens, 8-hour lifetime, verified with constant-time comparison; user re-checked in the database on each request.',
           'Brute-force protection: login throttle per IP+e-mail and 15-minute account lockout after 5 failures.',
           'Authorisation: permission table (PERMS) checked on every route; project membership scoping for non-managers; developer actions limited to assigned defects.',
           'SSRF guard: automated cases may only use http/https targets; cloud-metadata (169.254.x.x) and policy-blocked hosts are rejected before any request is sent.',
           'Evidence hygiene: passwords, tokens and secrets are redacted from stored request/response snapshots.',
           'Audit: logins, user changes, runs, defect operations and demo-lab actions are written to audit_log.'])

d.h1('6. Implementation')
d.h2('6.1 Technology stack')
d.table([['Layer', 'Technology', 'Reason'],
 ['Client', 'HTML5, CSS3, vanilla JavaScript SPA with hash router', 'No build step; accessible and fast'],
 ['Server', 'Node.js 22 (http, crypto, fetch)', 'Single runtime; native fetch drives black-box requests'],
 ['Database', 'PostgreSQL 16 (own wire-protocol client, pg-compatible API)', 'Concurrent multi-user ACID store, JSONB, constraints; replaces the earlier SQLite prototype'],
 ['Dataset', 'Defects4J subset (JSON, generated by scripts/extract-defects4j.js)', 'Real bugs, trigger tests and report links; MIT licence'],
 ['Tests', 'node:test', 'Built-in runner; end-to-end over real HTTP']],
 caption='Technology stack', widths=[3, 7, 6])
d.h2('6.2 Code organisation')
d.code('''qaforge-nexus/
  server/
    index.js         entry point, rate limiter, route registration
    lib/http.js      minimal router, JSON parsing, static files
    pgclient.js      PostgreSQL v3 wire-protocol client and pool
    db.js            PostgreSQL schema, async helpers, transactions, counters
    datasets/        defects4j-subset.json (168 real bugs)
    auth.js          scrypt, tokens, RBAC permission table, project scoping
    engine.js        assertions, test execution, retries, run orchestration
    lifecycle.js     defect state machine, auto-identification, SLA
    demo-sut.js      built-in target application with 11 switchable defects
    seed.js, seed-data.js   organisation, SHOP demo and Defects4J import
    routes/          core, projects, testing, defects, reports
  public/            index.html, app.js (SPA), ui.js (components), styles.css
  tests/             platform.test.js (13), dataset.test.js (9)
  docker-compose.yml, scripts/start-local-postgres.sh
  docs/              reports, workbook, diagrams, screenshots, schema.sql''')
d.h2('6.3 Test case model')
d.p('A black-box case is data, not code. Example (login set-up case with variable extraction):', align='j')
d.code('''{ "title": "Login with valid credentials", "method": "POST", "endpoint": "/auth/login",
  "body": {"email": "demo@store.test", "password": "Store@123"},
  "assertions": [
    {"type": "status", "op": "eq", "value": 200},
    {"type": "body", "path": "token", "op": "exists"} ],
  "extract": {"token": "token"}, "is_setup": true }''')
d.p('Assertion types: status, body (dotted JSON path), header, text and time. Operators: eq, neq, contains, not_contains, exists, not_exists, gt, gte, lt, lte, matches, in, type. Extracted values are available as variables to later cases.', align='j')
d.h2('6.4 Execution algorithm')
d.code('''executeRun(run, plan, retries):
  for each (case, isPrereq) in plan:            # dependencies ordered first
      attempts = 0
      do: attempts++; result = execute(case)    # HTTP call + assertions
      while result.failed and attempts <= retries
      flaky = result.passed and attempts > 1
      if result.failed and not isPrereq:
          autoDefectFromResult(case, result)    # identification
      store(result, evidence)
  finalise run totals''')
d.h2('6.5 Defect identification algorithm')
d.code('''autoDefectFromResult(tc, result):
  prev = latest defect for tc
  if prev is open/rejected/duplicate:
      prev.occurrences++ ; refresh evidence
      if prev in (Fixed, Retesting, Verified): Reopen(prev)
  elif prev is Closed:
      Reopen(prev)  # regression
  else:
      create defect: severity = P1 Critical, P2 High, P3 Medium, P4 Low
      attach steps, expected, actual, request/response evidence
      auto-assign least-loaded developer in project; notify''')
d.h2('6.6 Built-in system under test')
d.p('To allow a full demonstration without external dependencies, the server hosts the Nexora Storefront API (registration, login, catalogue, cart, discounts, orders, sales report). It contains the following switchable faults which the Demo Lab page can "fix" or "regress":', align='j')
d.table([['ID', 'Area', 'Defect']] + [[b['id'], b['area'], b['title']] for b in DATA['bugs']], caption='Planted defects in the demo target (Nexora Storefront)', widths=[1.5, 3.5, 11])

d.h1('7. Testing and Validation')
d.h2('7.1 Strategy')
d.p('Testing is performed at three levels. (1) The platform itself is verified by 13 end-to-end tests that start a real server on a throw-away PostgreSQL database and drive it over HTTP. (2) The platform\'s own capabilities are exercised on the demo target by a 35-case automated black-box suite. (3) 9 dataset tests check the Defects4J import. The complete test plan, test cases and traceability matrix are provided in 03_Test_Plan_and_Report.docx and 04_Test_Cases_and_RTM.xlsx.', align='j')
d.h2('7.2 Platform test results')
d.table([['#', 'Test', 'Result'],
 ['1', 'Health endpoint and static front-end served', 'Pass'], ['2', 'Valid / invalid login, missing and forged token', 'Pass'],
 ['3', 'Organisation size within 100-200 employees', 'Pass'], ['4', 'Role-based access control (viewer, QA engineer, admin)', 'Pass'],
 ['5', 'Password policy enforced', 'Pass'], ['6', 'Automated run detects planted defects and auto-raises them (35 cases, 10 failures, 10 defects, auto-assigned)', 'Pass'],
 ['7', 'Re-run does not duplicate defects; occurrences increment', 'Pass'],
 ['8', 'Lifecycle: illegal jump -> 409; non-assignee -> 403; resolution mandatory; Fixed -> automated retest -> Verified -> Closed; audit trail', 'Pass'],
 ['9', 'After all fixes deployed, full regression run has 0 failures', 'Pass'],
 ['10', 'Regression re-opens the closed defect (same record, reopen_count >= 1)', 'Pass'],
 ['11', 'Test case validation, creation and CSV export', 'Pass'], ['12', 'Dashboard, traceability and notification endpoints', 'Pass'],
 ['13', 'SSRF guard blocks cloud-metadata address', 'Pass']],
 caption='End-to-end test outcomes (platform suite, 13 of 13; with the 9 dataset tests npm test passes 31 of 31 on PostgreSQL 16)', widths=[1, 12, 3])
d.h2('7.3 Defect detection effectiveness')
d.p('On the first automated run against the demo target with all faults present, 25 of 35 cases passed and 10 failed, producing 10 auto-created defects assigned to developers; the intermittent endpoint (F01) was classified as flaky by retry and correctly did not raise a defect. A second run raised no new defects (occurrence counters incremented). After all fixes were deployed, a regression run produced zero failures; after reverting the fixes, the previously closed defect was re-opened automatically.', align='j')

d.h2('7.4 Dataset validation')
d.p('The nine dataset tests confirm: 100-200 real defects across the five projects; every dataset defect keeps its real report id, URL and revisions; trigger tests became traceable cases linked to requirements; workflow state is consistent with defect history under the PostgreSQL CHECK constraints; run history shows failures falling as defects are fixed; the API serves filtering, search, pagination, CSV and dashboard on this data; SQL-injection attempts are neutralised by bind parameters; the connection pool handles concurrent requests; and the lifecycle works on real dataset defects. Resulting defect statuses: '+', '.join(f'{k} {v}' for k,v in ST_COUNTS.most_common())+'. Severities: '+', '.join(f'{k} {v}' for k,v in SEV_COUNTS.most_common())+'.', align='j')
d.h1('8. Results and Screens')
shots = [('02-dashboard', 'Quality dashboard'), ('03-projects', 'Projects'), ('05-test-cases', 'Test case repository'), ('06-runs', 'Test runs'),
         ('07-defects', 'Defect register'), ('08-traceability', 'Requirement traceability matrix'), ('09-lab', 'Demo Lab'), ('10-org', 'Organisation view')]
for f, c in shots:
    d.img(os.path.join(SS, f + '.png'), c, 15.5)

d.h1('9. Conclusion and Future Enhancements')
d.p('QAForge Nexus demonstrates that a compact, self-hosted platform can unify test design, automated black-box execution and defect governance for a 100-200 person organisation. Automatic defect identification with de-duplication removes manual bug logging, automated retest provides evidence-based verification and regression detection prevents silent re-introduction of faults.', align='j')
d.bullets(['Browser-level UI automation (Playwright driver) as an additional execution backend.',
           'CI/CD webhooks and scheduled runs; e-mail and chat notifications.',
           'Jira / GitHub issue synchronisation; SSO (OIDC/SAML).',
           'Performance and load test profiles; flaky-test analytics over time.',
           'Horizontal scaling of runners and read replicas for larger organisations; swap in the official "pg" driver where the npm registry is available.', 'Fetch the upstream JIRA text for richer defect titles; import further Defects4J projects.'])

d.h1('Appendix A: Installation and Execution')
d.code('''# Requires Node.js 22.13+ and PostgreSQL 14+ (16 tested). No npm install is needed.
docker compose up -d      # or: scripts/start-local-postgres.sh   (db/user/password: qaforge)
export DATABASE_URL=postgres://qaforge:qaforge@127.0.0.1:5432/qaforge
npm start                 # http://localhost:4000 (creates schema, seeds on first start)
npm test                  # 31 tests (needs a role allowed to CREATE DATABASE)
npm run seed              # reset: organisation + SHOP demo + Defects4J (168 bugs)
npm run seed:minimal      # reset, organisation and projects only (no history)
npm run dataset:extract   # regenerate defects4j-subset.json from a Defects4J checkout''')
d.table([['Role', 'E-mail', 'Password'],
 ['Administrator', 'admin@nexora-tech.example', 'Nexus@123'], ['QA Manager', 'qa.manager@nexora-tech.example', 'Nexus@123'],
 ['QA Engineer', 'qa.engineer@nexora-tech.example', 'Nexus@123'], ['Developer', 'developer@nexora-tech.example', 'Nexus@123'],
 ['Product Owner', 'product.owner@nexora-tech.example', 'Nexus@123'], ['Viewer', 'viewer@nexora-tech.example', 'Nexus@123']],
 caption='Demonstration accounts (change before any real deployment)', widths=[4, 7.5, 4])
d.h1('Appendix B: References')
d.bullets(['ISTQB Foundation Level Syllabus - black-box test design techniques.',
           'IEEE Std 830-1998 - Recommended Practice for Software Requirements Specifications.',
           'ISO/IEC/IEEE 29119 - Software testing standard series.',
           'ISO/IEC 25010 - Systems and software quality models.',
           'OWASP Application Security Verification Standard and SSRF Prevention Cheat Sheet.',
           'Just, R., Jalali, D., Ernst, M.D. Defects4J: A Database of Existing Faults to Enable Controlled Testing Studies for Java Programs. ISSTA 2014. https://github.com/rjust/defects4j',
           'PostgreSQL 16 documentation: frontend/backend protocol, SCRAM-SHA-256, JSONB. Node.js documentation: node:crypto, node:net, node:test.',
           'Documentation of Selenium, Playwright, Postman, TestRail, Jira and Bugzilla for the comparison in Chapter 2.'])
d.save('01_Project_Report.docx')
