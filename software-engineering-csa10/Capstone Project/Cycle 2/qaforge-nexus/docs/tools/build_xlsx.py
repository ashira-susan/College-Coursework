import json
from collections import defaultdict
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from common import DATA, DOCS, DS_CITE, DS_DISCLOSE, DS_TOTAL_BUGS, DS_TOTAL_CASES

wb = Workbook()
HF = PatternFill('solid', fgColor='1F4FD8'); thin = Side(style='thin', color='CCCCCC'); BD = Border(left=thin, right=thin, top=thin, bottom=thin)
def sheet(name, headers, rows, widths, first=False):
    ws = wb.active if first else wb.create_sheet(); ws.title = name
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF'); c.fill = HF; c.alignment = Alignment(wrap_text=True, vertical='center'); c.border = BD
    for r in rows: ws.append(r)
    for row in ws.iter_rows(min_row=2):
        for c in row: c.alignment = Alignment(wrap_text=True, vertical='top'); c.border = BD
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = 'A2'; ws.auto_filter.ref = ws.dimensions
    return ws

# ---- platform system test cases
ST = [
 ('ST-01','Authentication','Login with valid credentials','Account exists','Enter admin@nexora-tech.example / Nexus@123','Token issued; dashboard shown','FR-11','Automated API test #2','Pass'),
 ('ST-02','Authentication','Login with wrong password','Account exists','POST /api/auth/login with wrong password','401 Invalid email or password','FR-11','Automated API test #2','Pass'),
 ('ST-03','Authentication','Access API without token','-','GET /api/projects without Authorization','401 Authentication required','FR-11','Automated API test #2','Pass'),
 ('ST-04','Authentication','Tampered token rejected','Valid token','Alter last characters of token and call API','401','FR-11','Automated API test #2','Pass'),
 ('ST-05','Authentication','Weak password rejected on change','Logged in','Change password to "abc"','400 with policy message','FR-13','Automated API test #5','Pass'),
 ('ST-06','Authentication','Wrong current password rejected','Logged in','Change password giving wrong current password','400','FR-13','Automated API test #5','Pass'),
 ('ST-07','Authentication','Account lockout after 5 failures','Account exists','Submit 5 wrong passwords then correct one','423 locked for 15 minutes','FR-12','Not executed (time-based; covered by code review)','Not run'),
 ('ST-08','Users','Employee count within 100-200','Seeded DB','GET /api/users','Total between 100 and 200 (150)','FR-15','Automated API test #3','Pass'),
 ('ST-09','RBAC','QA engineer cannot read audit log','Logged in as QA engineer','GET /api/audit','403','FR-71','Automated API test #4','Pass'),
 ('ST-10','RBAC','Admin can read audit log','Logged in as admin','GET /api/audit','200','FR-71','Automated API test #4','Pass'),
 ('ST-11','RBAC','Non-admin cannot create users','QA engineer','POST /api/users','403','FR-14','Automated API test #4','Pass'),
 ('ST-12','RBAC','Viewer cannot start a run','Viewer account','POST /api/projects/SHOP/runs','403','FR-41','Automated API test #4','Pass'),
 ('ST-13','Execution','Automated run on faulty target','SHOP has base URL','Start run with retries=1','35 cases executed; 10 failed','FR-41,FR-42','Automated API test #6','Pass'),
 ('ST-14','Defects','Failed results create linked defects','ST-13 done','Open run results','Every failed result has defect code; assigned','FR-51,FR-54','Automated API test #6','Pass'),
 ('ST-15','Defects','No duplicate defects on re-run','ST-13 done','Run again with retries','Defect count unchanged; occurrences >= 2','FR-52','Automated API test #7','Pass'),
 ('ST-16','Lifecycle','Illegal transition blocked','Defect Assigned','Transition to Closed','409 Conflict','FR-56','Automated API test #8','Pass'),
 ('ST-17','Lifecycle','Non-assignee developer blocked','Defect Assigned','Other developer sets In Progress','403','FR-56','Automated API test #8','Pass'),
 ('ST-18','Lifecycle','Resolution mandatory for Fixed','Defect In Progress','Fixed without resolution','400','FR-57','Automated API test #8','Pass'),
 ('ST-19','Lifecycle','Automated retest verifies fix','Faults fixed; defect Fixed','POST /retest','Outcome verified; status Verified','FR-58','Automated API test #8','Pass'),
 ('ST-20','Lifecycle','Close with complete history','Defect Verified','QA closes','Closed; >= 6 history entries','FR-59','Automated API test #8','Pass'),
 ('ST-21','Execution','Regression run green after fixes','All faults fixed','Run with retries=2','0 failures','FR-41','Automated API test #9','Pass'),
 ('ST-22','Defects','Regression reopens closed defect','Defect Closed; faults reverted','Run suite','Same defect Reopened; reopen_count >= 1','FR-53','Automated API test #10','Pass'),
 ('ST-23','Test design','Empty title rejected','Manager logged in','POST testcase with empty title','400','FR-32','Automated API test #11','Pass'),
 ('ST-24','Test design','Create automated case with assertions','Manager logged in','POST valid case','Created','FR-32,FR-33','Automated API test #11','Pass'),
 ('ST-25','Reporting','Test case CSV export','Cases exist','GET testcases.csv','CSV containing new case','FR-35','Automated API test #11','Pass'),
 ('ST-26','Reporting','Defect CSV export','Defects exist','GET defects.csv','text/csv','FR-63','Automated API test #11','Pass'),
 ('ST-27','Reporting','Dashboard data','Seeded DB','GET /api/reports/dashboard','200 with metrics','FR-61','Automated API test #12','Pass'),
 ('ST-28','Reporting','Traceability data','Seeded DB','GET traceability','200','FR-62','Automated API test #12','Pass'),
 ('ST-29','Notifications','Notifications endpoint','Logged in','GET /api/notifications','200','FR-64','Automated API test #12','Pass'),
 ('ST-30','Security','SSRF metadata address blocked','Manager logged in','Case targeting 169.254.169.254','Rejected or execution error, not fetched','FR-45','Automated API test #13','Pass'),
 ('ST-31','UI','All 11 main pages render without console errors','QA manager logged in','Open dashboard, projects, project, cases, runs, defects, traceability, lab, org, audit','No page/console errors','NFR-5','Playwright smoke check','Pass'),
 ('ST-32','UI','Mobile layout collapses sidebar','Viewport < 860 px','Open app on narrow screen','Menu button toggles sidebar','NFR-5','Not executed','Not run'),
 ('ST-D1','Dataset','Dataset size 100-200 real defects','PostgreSQL seeded','GET /api/defects per Defects4J project','168 defects over 5 projects','FR-5x','dataset.test.js #1','Pass'),
 ('ST-D2','Dataset','Real report id, URL and revisions kept','Seeded','Inspect defect external_ref / external_url','Values match Defects4J','FR-5x','dataset.test.js #2','Pass'),
 ('ST-D3','Dataset','Trigger tests become traceable cases','Seeded','Open traceability for LANG','Every requirement has linked cases','FR-62','dataset.test.js #3','Pass'),
 ('ST-D4','Dataset','Workflow state consistent with history; CHECK constraints reject bad status','Seeded','Inspect history; UPDATE status to invalid value','Consistent; invalid rejected by PostgreSQL','NFR-4','dataset.test.js #4','Pass'),
 ('ST-D5','Dataset','Run history shows failures falling as defects are fixed','Seeded','Open runs for a dataset project','Fail count decreases across the 8 runs','FR-6x','dataset.test.js #5','Pass'),
 ('ST-D6','Dataset','API filtering, search, pagination, CSV, dashboard on dataset','Seeded','Call list endpoints with filters','200 and correct subsets','FR-6x','dataset.test.js #6','Pass'),
 ('ST-D7','Security','SQL injection neutralised by bind parameters','Seeded','Search with SQL metacharacters','No error; no data change','NFR-3','dataset.test.js #7','Pass'),
 ('ST-D8','Reliability','Connection pool handles concurrent requests','Seeded','Fire parallel API calls','All succeed','NFR-2','dataset.test.js #8','Pass'),
 ('ST-D9','Lifecycle','Lifecycle works on real dataset defects','Seeded','Assign, fix, verify, close a LANG defect','Transitions accepted and audited','FR-5x','dataset.test.js #9','Pass'),
]
ws = sheet('Platform Test Cases', ['ID','Module','Test case','Preconditions','Steps','Expected result','Requirement','Verified by','Status'], [list(r) for r in ST], [8,14,36,24,38,36,13,28,10], first=True)
dv = DataValidation(type='list', formula1='"Pass,Fail,Blocked,Not run"', allow_blank=True); ws.add_data_validation(dv); dv.add(f'I2:I{len(ST)+50}')
# ---- demo target cases
shop = [c for c in DATA['cases'] if c['pk'] == 'SHOP']
rows = []
for c in shop:
    a = json.loads(c['assertions']) if c['assertions'] else []
    rows.append([c['code'], c['suite'], c['title'], c['req'], c['type'], c['priority'], 'Yes' if c['automated'] else 'No', c['method'], c['endpoint'], '; '.join(x.get('desc') or f"{x['type']} {x.get('path','')} {x['op']} {x.get('value','')}" for x in a)])
sheet('Demo Target Suite (SHOP)', ['ID','Suite','Title','Requirement','Type','Priority','Automated','Method','Endpoint','Assertions'], rows, [9,18,44,11,11,8,10,8,22,60])
# ---- other projects manual cases
rows = [[c['pk'], c['code'], c['suite'], c['title'], c['req'], c['type'], c['priority'], c['steps_text'], c['expected_text'], c['external_ref']] for c in DATA['cases'] if c['pk'] != 'SHOP']
sheet('Dataset Cases (Defects4J)', ['Project','ID','Suite','Title','Requirement','Type','Priority','Steps','Expected','Defects4J trigger test'], rows, [9,9,22,44,11,11,8,44,44,50])
# ---- RTM
by_req = defaultdict(list)
for c in DATA['cases']: by_req[(c['pk'], c['req'])].append(c['code'])
by_def = defaultdict(list)
for d in DATA['defects']:
    if d['tc']: by_def[(d['pk'], d['tc'])].append(d['code'])
rows = []
for r in DATA['reqs']:
    cs = by_req.get((r['pk'], r['code']), [])
    rows.append([r['pk'], r['code'], r['title'], r['priority'], r['status'], ', '.join(cs), len(cs), ', '.join(x for c in cs for x in by_def.get((r['pk'], c), []))])
ws = sheet('RTM', ['Project','Requirement','Title','Priority','Status','Test cases','# cases','Linked defects'], rows, [9,12,50,9,10,40,9,36])
for i in range(2, len(rows) + 2): ws[f'I{i}'] = f'=IF(G{i}=0,"NOT COVERED","Covered")'
ws['I1'] = 'Coverage'; ws['I1'].font = Font(bold=True, color='FFFFFF'); ws['I1'].fill = HF; ws.column_dimensions['I'].width = 14
# ---- defects
rows = [[d['pk'], d['code'], d['title'], d['severity'], d['status'], d['type'], d['source'], d['tc'], d['occurrences'], d['reopen_count'], d['external_ref'], d['external_url']] for d in DATA['defects']]
sheet('Defect Log', ['Project','ID','Title','Severity','Status','Type','Source','Test case','Occurrences','Reopened','Upstream report','Report URL'], rows, [9,14,56,10,12,12,9,10,12,10,16,44])
# ---- demo bug catalogue
sheet('Planted Bugs (Demo)', ['ID','Area','Planted defect'], [[b['id'], b['area'], b['title']] for b in DATA['bugs']], [8,18,70])
# ---- dataset info
ws = sheet('Dataset Info', ['Item','Value'], [['Dataset','Defects4J (real, reproducible Java bugs)'],['Bugs imported',DS_TOTAL_BUGS],['Test cases derived',DS_TOTAL_CASES],['Citation',DS_CITE],['Disclosure',DS_DISCLOSE]], [20,110])
# ---- RBAC
PERMS = [('Manage users','Admin'),('View audit log','Admin, QA Manager'),('Create / edit projects','Admin, QA Manager'),('Manage project members','Admin, QA Manager'),
 ('Write requirements','Admin, QA Manager, QA Engineer, Product Owner'),('Write test cases','Admin, QA Manager, QA Engineer'),('Execute runs','Admin, QA Manager, QA Engineer'),
 ('Create defects','Admin, QA Manager, QA Engineer, Developer, Product Owner'),('Edit defects','Admin, QA Manager, QA Engineer'),('Comment on defects','Admin, QA Manager, QA Engineer, Developer, Product Owner'),
 ('Retest defects','Admin, QA Manager, QA Engineer'),('Use Demo Lab','Admin, QA Manager, QA Engineer, Developer')]
roles = ['Admin','QA Manager','QA Engineer','Developer','Product Owner']
sheet('RBAC Matrix', ['Permission'] + roles + ['Viewer'], [[p] + ['Yes' if r in who else '' for r in roles] + [''] for p, who in PERMS], [28,9,12,12,11,13,9])
# ---- summary with formulas
ws = wb.create_sheet('Summary', 0)
ws['A1'] = 'QAForge Nexus - Test Summary'; ws['A1'].font = Font(bold=True, size=14, color='1F4FD8')
items = [('Platform test cases', "=COUNTA('Platform Test Cases'!A2:A200)"), ('Passed', "=COUNTIF('Platform Test Cases'!I2:I200,\"Pass\")"), ('Failed', "=COUNTIF('Platform Test Cases'!I2:I200,\"Fail\")"),
         ('Not run', "=COUNTIF('Platform Test Cases'!I2:I200,\"Not run\")"), ('Pass rate (of executed)', "=IFERROR(B4/(B4+B5),0)"),
         ('Demo target cases', "=COUNTA('Demo Target Suite (SHOP)'!A2:A200)"), ('Requirements', "=COUNTA(RTM!B2:B200)"), ('Requirements NOT covered', "=COUNTIF(RTM!I2:I200,\"NOT COVERED\")"),
         ('Defects in log', "=COUNTA('Defect Log'!B2:B300)"), ('Open defects', "=COUNTA('Defect Log'!B2:B300)-COUNTIF('Defect Log'!E2:E300,\"Closed\")-COUNTIF('Defect Log'!E2:E300,\"Rejected\")-COUNTIF('Defect Log'!E2:E300,\"Duplicate\")")]
for i, (k, f) in enumerate(items, 3): ws[f'A{i}'] = k; ws[f'B{i}'] = f; ws[f'A{i}'].font = Font(bold=True)
ws['B7'].number_format = '0.0%'; ws.column_dimensions['A'].width = 30; ws.column_dimensions['B'].width = 14
ws['A15'] = 'Status values on "Platform Test Cases" are editable (drop-down); this summary recalculates automatically.'; ws['A15'].font = Font(italic=True)
wb.save(DOCS + '/04_Test_Cases_and_RTM.xlsx'); print('saved')
