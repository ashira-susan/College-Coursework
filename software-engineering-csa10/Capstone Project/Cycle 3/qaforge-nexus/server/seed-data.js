'use strict';
/** Static data used to seed the demo organisation "Nexora Technologies" (150 employees). */

const DOMAIN = 'nexora-tech.example';
const DEMO_PASSWORD = 'Nexus@123';

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Reyansh', 'Ishaan', 'Kabir', 'Rohan', 'Karthik', 'Siddharth', 'Rahul', 'Vikram', 'Nikhil', 'Pranav',
  'Harish', 'Suresh', 'Ramesh', 'Manoj', 'Deepak', 'Ankit', 'Priya', 'Ananya', 'Diya', 'Kavya', 'Meera', 'Neha', 'Pooja', 'Riya', 'Sneha', 'Divya',
  'Lakshmi', 'Shreya', 'Aishwarya', 'Nandini', 'Swati', 'Anjali', 'Revathi', 'Sangeetha', 'Janani', 'Harini', 'Ravi', 'Gopal', 'Mohan', 'Imran',
  'Farhan', 'Zoya', 'Fatima', 'Sara', 'John', 'Emily', 'Daniel', 'Olivia', 'Michael', 'Sophia', 'David', 'Grace', 'Thomas', 'Maria', 'Kevin', 'Linda'];
const LAST = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Mehta', 'Gupta', 'Singh', 'Kumar', 'Krishnan', 'Subramanian', 'Rajan', 'Menon', 'Pillai',
  'Das', 'Banerjee', 'Chatterjee', 'Joshi', 'Kulkarni', 'Deshmukh', 'Naidu', 'Raju', 'Chaudhary', 'Khan', 'Ansari', 'Sheikh', 'Mirza', 'DSouza',
  'Fernandes', 'Thomas', 'Mathew', 'George', 'Varghese', 'Srinivasan', 'Venkatesh', 'Murthy', 'Bhat', 'Hegde', 'Shetty', 'Kapoor', 'Malhotra', 'Arora',
  'Bansal', 'Saxena', 'Tiwari', 'Pandey', 'Mishra', 'Ghosh', 'Sen'];

// 150 employees in total
const DEPARTMENTS = [
  { code: 'EXE', name: 'Executive Management', roles: [['viewer', 6]], desig: { viewer: ['Chief Executive Officer', 'Chief Technology Officer', 'Chief Financial Officer', 'Chief Operating Officer', 'Chief Product Officer', 'Chief Information Security Officer'] } },
  { code: 'PRD', name: 'Product Management', roles: [['product_owner', 10]], desig: { product_owner: ['Product Owner', 'Product Manager', 'Senior Product Manager', 'Business Analyst', 'Head of Product'] } },
  { code: 'BE', name: 'Backend Engineering', roles: [['developer', 26]], desig: { developer: ['Software Engineer', 'Senior Software Engineer', 'Backend Engineer', 'Tech Lead', 'Staff Engineer'] } },
  { code: 'FE', name: 'Frontend Engineering', roles: [['developer', 20]], desig: { developer: ['Frontend Engineer', 'Senior Frontend Engineer', 'UI Engineer', 'Tech Lead'] } },
  { code: 'MOB', name: 'Mobile Engineering', roles: [['developer', 14]], desig: { developer: ['Android Engineer', 'iOS Engineer', 'Mobile Engineer', 'Senior Mobile Engineer'] } },
  { code: 'OPS', name: 'DevOps & SRE', roles: [['admin', 2], ['developer', 7]], desig: { admin: ['Platform Administrator'], developer: ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Engineer'] } },
  { code: 'QA', name: 'Quality Assurance', roles: [['qa_manager', 3], ['qa_engineer', 25]], desig: { qa_manager: ['QA Manager', 'Test Lead', 'Test Lead'], qa_engineer: ['QA Engineer', 'Senior QA Engineer', 'SDET', 'Automation Engineer', 'Manual Tester'] } },
  { code: 'UX', name: 'UX Design', roles: [['viewer', 8]], desig: { viewer: ['UX Designer', 'Senior UX Designer', 'UX Researcher', 'Visual Designer'] } },
  { code: 'SUP', name: 'Customer Support', roles: [['viewer', 10]], desig: { viewer: ['Support Engineer', 'Customer Success Manager', 'Support Lead'] } },
  { code: 'SAL', name: 'Sales & Marketing', roles: [['viewer', 8]], desig: { viewer: ['Account Executive', 'Sales Manager', 'Marketing Manager', 'Growth Analyst'] } },
  { code: 'HR', name: 'HR & Administration', roles: [['viewer', 6]], desig: { viewer: ['HR Business Partner', 'Talent Acquisition Lead', 'HR Manager', 'Office Administrator'] } },
  { code: 'FIN', name: 'Finance', roles: [['viewer', 5]], desig: { viewer: ['Accountant', 'Finance Manager', 'Financial Analyst'] } },
];

// well-known demo accounts (first slot of the matching role is replaced by these)
const DEMO_USERS = [
  { email: `admin@${DOMAIN}`, name: 'Ravi Shankar', role: 'admin', dept: 'OPS', desig: 'Platform Administrator' },
  { email: `qa.manager@${DOMAIN}`, name: 'Meera Krishnan', role: 'qa_manager', dept: 'QA', desig: 'QA Manager' },
  { email: `qa.engineer@${DOMAIN}`, name: 'Arjun Nair', role: 'qa_engineer', dept: 'QA', desig: 'Senior QA Engineer' },
  { email: `developer@${DOMAIN}`, name: 'Karthik Iyer', role: 'developer', dept: 'BE', desig: 'Senior Software Engineer' },
  { email: `product.owner@${DOMAIN}`, name: 'Priya Sharma', role: 'product_owner', dept: 'PRD', desig: 'Product Owner' },
  { email: `viewer@${DOMAIN}`, name: 'Vikram Malhotra', role: 'viewer', dept: 'EXE', desig: 'Chief Technology Officer' },
];

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */
const PROJECTS = [
  { key: 'SHOP', name: 'Nexora Storefront API', base_url: '/demo-sut', live: true,
    description: 'E-commerce REST API (built-in demo target with switchable defects). Fully automated black-box suite.' },
];

/* ------------------------------------------------------------------ */
/* SHOP (demo SUT) - 35 automated black-box test cases                 */
/* ------------------------------------------------------------------ */
const st = (v) => ({ type: 'status', op: 'eq', value: v });
const stIn = (arr) => ({ type: 'status', op: 'in', value: arr });
const js = (path, op, value) => ({ type: 'body', path, op, value });
const jsx = (path, op) => ({ type: 'body', path, op });
const under = (ms) => ({ type: 'time', op: 'lt', value: ms, desc: `response time < ${ms} ms` });
const AUTH = { Authorization: 'Bearer {{token}}' };
const AUTH2 = { Authorization: 'Bearer {{token2}}' };
const J = (o) => JSON.stringify(o);

const SHOP_REQS = [
  'User login and session tokens', 'User registration', 'Product catalogue browsing and pagination', 'Product search',
  'Shopping cart management', 'Discount codes', 'Access control and authentication enforcement', 'Order placement and retrieval',
  'Reporting performance', 'Service health and availability',
];

const SHOP_SUITES = ['Authentication', 'Catalogue', 'Cart & Discounts', 'Orders', 'Reports & Reliability'];

// [suite#, req#, title, type, priority, method, endpoint, headers, body, assertions, extract, flags, steps, expected]
const SHOP_CASES = [
  [1, 1, 'Login with valid credentials', 'smoke', 'P1', 'POST', '/auth/login', null, J({ email: 'demo@store.test', password: 'Store@123' }),
    [st(200), jsx('$.token', 'exists'), js('$.user.email', 'eq', 'demo@store.test')], [{ var: 'token', path: '$.token' }], { setup: 1 },
    'POST /auth/login with the demo shopper credentials', '200 OK with a session token'],
  [1, 1, 'Login with wrong password is rejected', 'negative', 'P2', 'POST', '/auth/login', null, J({ email: 'demo@store.test', password: 'wrong-pass' }),
    [st(401), jsx('$.error', 'exists')], [], {}, 'POST /auth/login with an incorrect password', '401 Unauthorized with an error message'],
  [1, 1, 'Login with missing fields is rejected', 'negative', 'P3', 'POST', '/auth/login', null, '{}',
    [st(400)], [], {}, 'POST /auth/login with an empty JSON object', '400 Bad Request'],
  [1, 1, 'Login with an empty password is rejected', 'security', 'P1', 'POST', '/auth/login', null, J({ email: 'demo@store.test', password: '' }),
    [stIn([400, 401])], [], {}, 'POST /auth/login with a valid e-mail and an empty password', '400 or 401 - no token issued'],
  [1, 2, 'Register a new shopper with valid data', 'functional', 'P2', 'POST', '/auth/register', null, J({ email: 'user{{random}}@store.test', password: 'Abcd@1234' }),
    [st(201), jsx('$.id', 'exists')], [], {}, 'POST /auth/register with a unique e-mail and strong password', '201 Created with the new user id'],
  [1, 2, 'Registration rejects a malformed e-mail address', 'negative', 'P2', 'POST', '/auth/register', null, J({ email: 'not-an-email', password: 'Abcd@1234' }),
    [st(400)], [], {}, 'POST /auth/register with "not-an-email"', '400 Bad Request'],
  [1, 2, 'Registration rejects a password shorter than 8 characters', 'boundary', 'P3', 'POST', '/auth/register', null, J({ email: 'short{{random}}@store.test', password: 'abc' }),
    [st(400)], [], {}, 'POST /auth/register with a 3-character password', '400 Bad Request'],
  [1, 1, 'Login as the second shopper (setup for access-control tests)', 'functional', 'P3', 'POST', '/auth/login', null, J({ email: 'other@store.test', password: 'Store@123' }),
    [st(200), jsx('$.token', 'exists')], [{ var: 'token2', path: '$.token' }], { setup: 1 }, 'POST /auth/login as other@store.test', '200 OK with a token'],

  [2, 3, 'List products returns the catalogue', 'smoke', 'P1', 'GET', '/products', null, null,
    [st(200), js('$.total', 'eq', 12), js('$.items', 'type', 'array'), js('$.items.length', 'gte', 1)], [], {}, 'GET /products', '200 OK with 12 products in total'],
  [2, 3, 'Pagination page 1 returns the first five products', 'functional', 'P2', 'GET', '/products?page=1&limit=5', null, null,
    [st(200), js('$.items.length', 'eq', 5), js('$.items[0].id', 'eq', 1)], [], {}, 'GET /products?page=1&limit=5', 'Items 1-5'],
  [2, 3, 'Pagination page 2 starts at product 6', 'functional', 'P2', 'GET', '/products?page=2&limit=5', null, null,
    [st(200), js('$.items[0].id', 'eq', 6)], [], {}, 'GET /products?page=2&limit=5', 'First item on page 2 has id 6'],
  [2, 3, 'Get a product by id', 'functional', 'P2', 'GET', '/products/1', null, null,
    [st(200), js('$.name', 'eq', 'Wireless Mouse'), js('$.price', 'eq', 799)], [], {}, 'GET /products/1', 'Wireless Mouse, price 799'],
  [2, 3, 'Unknown product id returns 404', 'negative', 'P2', 'GET', '/products/999', null, null,
    [st(404)], [], {}, 'GET /products/999', '404 Not Found'],
  [2, 4, 'Search is case-insensitive', 'functional', 'P3', 'GET', '/products?q=MOUSE', null, null,
    [st(200), js('$.total', 'eq', 1)], [], {}, 'GET /products?q=MOUSE', 'One match (Wireless Mouse)'],
  [2, 4, 'Search with no match returns an empty list', 'negative', 'P3', 'GET', '/products?q=zzzz', null, null,
    [st(200), js('$.items.length', 'eq', 0)], [], {}, 'GET /products?q=zzzz', '200 OK with an empty list'],
  [2, 3, 'A limit above the maximum is rejected', 'boundary', 'P3', 'GET', '/products?limit=51', null, null,
    [st(400)], [], {}, 'GET /products?limit=51', '400 Bad Request'],

  [3, 5, 'Clear the cart (setup)', 'functional', 'P3', 'DELETE', '/cart', AUTH, null,
    [st(200)], [], { setup: 1 }, 'DELETE /cart as the demo shopper', 'Cart cleared'],
  [3, 5, 'Add an item to the cart', 'functional', 'P1', 'POST', '/cart/items', AUTH, J({ productId: 1, quantity: 2 }),
    [st(201), js('$.quantity', 'eq', 2)], [], { dep: 1 }, 'POST /cart/items {productId:1, quantity:2}', '201 Created, quantity 2'],
  [3, 5, 'Cart shows the correct subtotal', 'functional', 'P1', 'GET', '/cart', AUTH, null,
    [st(200), js('$.items.length', 'eq', 1), js('$.subtotal', 'eq', 1598)], [], { dep: 1 }, 'GET /cart after adding 2 x 799', 'Subtotal 1598'],
  [3, 6, 'Apply discount code SAVE10', 'functional', 'P2', 'POST', '/cart/discount', AUTH, J({ code: 'SAVE10' }),
    [st(200), js('$.percent', 'eq', 10)], [], { dep: 1 }, 'POST /cart/discount {code:"SAVE10"}', '10 percent discount'],
  [3, 6, 'Apply discount code SAVE20', 'functional', 'P2', 'POST', '/cart/discount', AUTH, J({ code: 'SAVE20' }),
    [st(200), js('$.percent', 'eq', 20)], [], { dep: 1 }, 'POST /cart/discount {code:"SAVE20"}', '20 percent discount'],
  [3, 6, 'Invalid discount code is rejected', 'negative', 'P3', 'POST', '/cart/discount', AUTH, J({ code: 'BOGUS' }),
    [st(400)], [], { dep: 1 }, 'POST /cart/discount {code:"BOGUS"}', '400 Bad Request'],
  [3, 5, 'Zero quantity is rejected', 'boundary', 'P3', 'POST', '/cart/items', AUTH, J({ productId: 1, quantity: 0 }),
    [st(400)], [], { dep: 1 }, 'POST /cart/items with quantity 0', '400 Bad Request'],
  [3, 5, 'Unknown product cannot be added', 'negative', 'P3', 'POST', '/cart/items', AUTH, J({ productId: 999, quantity: 1 }),
    [st(404)], [], { dep: 1 }, 'POST /cart/items with productId 999', '404 Not Found'],
  [3, 5, 'Negative quantity is rejected', 'negative', 'P2', 'POST', '/cart/items', AUTH, J({ productId: 2, quantity: -2 }),
    [st(400)], [], { dep: 1 }, 'POST /cart/items with quantity -2', '400 Bad Request'],
  [3, 7, 'Cart requires authentication', 'security', 'P1', 'GET', '/cart', null, null,
    [st(401)], [], {}, 'GET /cart without an Authorization header', '401 Unauthorized'],

  [4, 8, 'Clear the cart before ordering', 'functional', 'P3', 'DELETE', '/cart', AUTH, null,
    [st(200)], [], {}, 'DELETE /cart', 'Cart cleared'],
  [4, 8, 'Add 10 units of Desk Lamp', 'functional', 'P3', 'POST', '/cart/items', AUTH, J({ productId: 8, quantity: 10 }),
    [st(201)], [], { dep: 1 }, 'POST /cart/items {productId:8, quantity:10}', '201 Created'],
  [4, 8, 'Place a bulk order and verify the total', 'functional', 'P1', 'POST', '/orders', AUTH, null,
    [st(201), js('$.total', 'eq', 8990), js('$.status', 'eq', 'PLACED')], [{ var: 'orderId', path: '$.id' }], { dep: 1 }, 'POST /orders for 10 x 899', 'Total 8990'],
  [4, 8, 'Customer can view their own order', 'functional', 'P2', 'GET', '/orders/{{orderId}}', AUTH, null,
    [st(200), js('$.status', 'eq', 'PLACED'), js('$.id', 'eq', '{{orderId}}')], [], { dep: 1 }, 'GET /orders/{id} as the owner', '200 OK'],
  [4, 7, 'Another customer cannot view the order', 'security', 'P1', 'GET', '/orders/{{orderId}}', AUTH2, null,
    [st(403)], [], { dep: 1 }, 'GET /orders/{id} using the second shopper\'s token', '403 Forbidden'],
  [4, 8, 'Ordering with an empty cart is rejected', 'negative', 'P2', 'POST', '/orders', AUTH, null,
    [st(400)], [], { dep: 1 }, 'POST /orders right after the cart was consumed', '400 Bad Request'],

  [5, 9, 'Sales report responds within 800 ms', 'performance', 'P2', 'GET', '/reports/sales', AUTH, null,
    [st(200), under(800)], [], {}, 'GET /reports/sales', '200 OK in under 800 ms'],
  [5, 10, 'Health endpoint reports OK', 'smoke', 'P1', 'GET', '/health', null, null,
    [st(200), js('$.status', 'eq', 'ok')], [], {}, 'GET /health', '200 OK, status ok'],
  [5, 10, 'Status endpoint is stable (flaky-test demo)', 'regression', 'P4', 'GET', '/status/flaky', null, null,
    [st(200), js('$.status', 'eq', 'up')], [], {}, 'GET /status/flaky', '200 OK (retry logic marks it flaky when the first attempt fails)'],
];

// historical, already-closed defects for the demo project (linked to test cases that currently pass)
const SHOP_OLD_DEFECTS = [
  [2, 'Wrong-password login returned HTTP 500'], [7, 'Weak passwords were accepted at registration'], [10, 'Page 1 returned 11 items when limit=10'],
  [19, 'Cart subtotal ignored quantities above 9'], [20, 'SAVE10 applied twice when re-submitted'], [30, 'Order total shown without discount'],
];

module.exports = { DOMAIN, DEMO_PASSWORD, FIRST, LAST, DEPARTMENTS, DEMO_USERS, PROJECTS, SHOP_REQS, SHOP_SUITES, SHOP_CASES, SHOP_OLD_DEFECTS };
