# UniformLoop

UniformLoop is a community marketplace for passing school uniforms, textbooks, sportswear, and supplies to another family.

## Run the app

1. Install Node.js if it is not already installed.
2. In this folder, run `npm start`.
3. Open `http://localhost:3000` in your browser.

The server uses Node's built-in modules; there are no npm dependencies to install.

## Features

- Browse listings without signing in; search and rank matches by school, grade, and size.
- Create an account, sign in, and sign out.
- Add a listing while signed in and view only your listings under **My listings**.
- Send one request per listing. The listing owner can see the request count in its details.
- Persist accounts, listing records, sessions, and item requests in `data.json`.
- Store passwords as salted scrypt hashes; store only hashed session tokens in the data file.

## Data and prototype limits

On first start, the server copies the seeded sample data from `data.example.json` into a local `data.json`. The server updates that file as users register and interact; it is kept outside the static-file allowlist and ignored by Git so account/session data is not accidentally published. Back it up before resetting sample data.

This is a local, single-server prototype. It does not include email verification, password reset, direct messaging, payment processing, or production-grade database backups. Item requests are recorded for owners to see; contact details are not collected or exposed.
