# Ububiko

Ububiko is a small one-to-one chat app built with React, Express, Socket.IO, and MongoDB. People can create accounts, see other registered people, and exchange messages in real time.

Accounts must be registered with an age of 15 or older and a unique username. Email is used for account sign-in, but email verification is not required.

Public accounts can be searched by username. Private accounts are hidden from the directory; people add them using their five-digit ID, shown under **Profile & settings**. Profile settings include display-name/password editing, account privacy, desktop notifications, dark mode, and language selection in English or Kinyarwanda (English by default). Groups can be public or private; only the creator can add members or change group privacy. Private groups are invite-only.

## Requirements

- Node.js 18 or newer
- A MongoDB Atlas connection string

The server connects to MongoDB using `MONGO_URI` from `server/.env`. Set it to your MongoDB Atlas connection string before starting the API.

## Run locally

1. Copy `server/.env.example` to `server/.env`.
2. Set `JWT_SECRET` to a long, random value and replace `MONGO_URI` with your MongoDB Atlas connection string.
3. From the project root, install the packages (use `npm.cmd` in PowerShell if script execution blocks `npm`):

   ```powershell
   npm.cmd install
   npm.cmd install --prefix server
   npm.cmd install --prefix client
   ```

4. Start the API and React development server:

   ```powershell
   npm.cmd run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:5000](http://localhost:5000).

The client uses `VITE_API_URL` when set; otherwise, it connects to `http://localhost:5000`.

## Admin dashboard

1. Register the account that will be the administrator.
2. From the project root, grant admin access to that registered account:

   ```powershell
   npm.cmd run make-admin --prefix server -- admin@example.com
   ```

3. Sign out and sign back in. Choose **Admin dashboard** in the sidebar.

The dashboard lists accounts, usernames, ages, and private-account status, and lets administrators enable or disable messaging for each person. The API enforces the setting for both senders and recipients. Admin roles are stored on the account and can only be granted from the server command line.
