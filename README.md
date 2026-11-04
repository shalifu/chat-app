# Ububiko

Ububiko is a small one-to-one chat app built with React, Express, Socket.IO, and MongoDB. People can create accounts, see other registered people, and exchange messages in real time.

## Requirements

- Node.js 18 or newer
- MongoDB running locally, or a MongoDB connection string

The default database connection is `mongodb://127.0.0.1:27017/ububiko`. MongoDB creates the `ububiko` database when the app first writes data.

## Run locally

1. Copy `server/.env.example` to `server/.env`.
2. Set `JWT_SECRET` to a long, random value. Update `MONGODB_URI` if MongoDB is not running locally.
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

5. Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:4000](http://localhost:4000).

The client uses `VITE_API_URL` when set; otherwise, it connects to `http://localhost:4000`.

## Admin dashboard

1. Register the account that will be the administrator.
2. From the project root, grant admin access to that registered account:

   ```powershell
   npm.cmd run make-admin --prefix server -- admin@example.com
   ```

3. Sign out and sign back in. Choose **Admin dashboard** in the sidebar.

The dashboard lists accounts and lets administrators enable or disable messaging for each person. The API enforces the setting for both senders and recipients. Admin roles are stored on the account and can only be granted from the server command line; this app does not verify email addresses.
