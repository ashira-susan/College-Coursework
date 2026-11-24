# Pull request text (copy into GitHub)

**Title:** Add login feature

## What does this PR do?
Adds a login page with client-side validation on the `feature-login` branch.

## Changes
- `login.html`, `css/login.css` – login form UI (email, password, show/hide button)
- `js/login.js` – validation: valid email format, password of at least 8 characters, inline error messages
- `index.html` – link from the home page to the login page

## How to test
1. Open `login.html` in a browser.
2. Submit with an invalid email or a short password – error messages appear.
3. Enter a valid email and a password of 8+ characters – "Login successful (demo)" appears.

## Notes
Demo only: there is no back end, so no real authentication happens.
