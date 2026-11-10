# Ububiko

Ububiko is a chat app built with React, Express, Socket.IO, and MongoDB. People can create accounts and find public accounts, but one-to-one messaging starts only after the recipient accepts a connection request. Private accounts can be requested by five-digit ID. Group chats are visible only to their members; only the group creator can add members.

Accounts must be registered with an age of 15 or older and a unique username. Email is used for account sign-in, but email verification is not required.

Public accounts can be searched by username. Private accounts are hidden from the directory; people can send a connection request using the five-digit ID shown under **Profile & settings**. A conversation becomes available only after the recipient accepts. The notification inbox keeps message, connection, and group alerts so they can be opened later. Profile settings include display-name/password editing, account privacy, desktop notifications, dark mode, and language selection in English or Kinyarwanda (English by default). Groups are private and member-only; only the creator can add members.

Accepted connections can start one-to-one audio or video calls from the conversation header. Call outcomes and durations are saved in the direct conversation history. Call setup requests media and network settings in parallel, and video starts at up to 720p before adjusting bitrate, resolution, and frame rate using live WebRTC packet-loss, latency, and bandwidth statistics. Calls require microphone/camera permission and a secure context (HTTPS, or localhost during development). STUN is used by default; for reliable calls across restrictive NATs and firewalls, configure Coturn with its REST shared-secret authentication:

- `TURN_URL`: comma-separated TURN/TURNS URLs (for example `turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349`)
- `TURN_SECRET`: the Coturn REST API shared secret

The server issues short-lived TURN credentials to authenticated users. Leave both settings blank to use STUN only.

In direct and group conversations, senders can edit or delete their own messages for up to 10 minutes after sending. Edits are saved for all participants and marked **Edited**; deleting a message removes it for everyone. The server enforces the time limit.

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

3. Sign in through the normal email/password login and choose **Admin dashboard** in the sidebar. Admin access is a role on the existing account; no shared or hard-coded admin password is used.

The dashboard lists accounts and registration/login/last-active details; reports sign-ins, messages, server uptime, currently active users, and estimated time spent with the app open; and lets administrators disable messaging or delete non-admin accounts and their associated data. Admin APIs enforce authorization on the server. Admin accounts cannot be deleted from the dashboard, and admin roles can only be granted from the server command line.

Usage tracking starts when this version is deployed. Time is estimated from visible app sessions and periodic heartbeats; earlier usage is not available.
