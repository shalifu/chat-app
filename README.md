# Ububiko

Ububiko is a chat app built with React, Express, Socket.IO, and MongoDB. Signed-in members can find every account in the people directory. Public accounts can be messaged immediately; private accounts require a connection request that the recipient accepts before messaging is available. Group chats are visible only to their members; only the group creator can add members.

Accounts must be registered with an age of 15 or older and a unique username. Email is used for account sign-in, but email verification is not required.

The site opens on the sign-in screen for visitors who are not logged in. A valid saved session is checked on startup and takes the user directly to their home; expired sessions return to sign-in.

All accounts are visible to signed-in members and searchable by username. Public accounts can be messaged immediately. Private accounts remain discoverable, but require an accepted connection before messaging; requests can be sent from the directory or by using the five-digit ID shown under **Profile & settings**. Direct messages show whether they have been seen. The notification inbox keeps message, connection, and group alerts so they can be opened later. Profile settings include display-name/password editing, account privacy, desktop notifications, dark mode, and language selection in English or Kinyarwanda (English by default). Groups are private and member-only; only the creator can add members.

People in the sidebar can be marked as favorites with the star beside their name. Favorites are saved to the account and appear in a separate section above the rest of the people list.

Accepted connections can start one-to-one audio or video calls from the conversation header. Call outcomes and durations are saved in the direct conversation history. Call setup requests media and network settings in parallel, and video starts at up to 720p before adjusting bitrate, resolution, and frame rate using live WebRTC packet-loss, latency, and bandwidth statistics. Calls require microphone/camera permission and a secure context (HTTPS, or localhost during development). STUN is used by default; for reliable calls across restrictive NATs and firewalls, configure Coturn with its REST shared-secret authentication:

- `TURN_URL`: comma-separated TURN/TURNS URLs (for example `turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349`)
- `TURN_SECRET`: the Coturn REST API shared secret

The server issues short-lived TURN credentials to authenticated users. Leave both settings blank to use STUN only.

In direct and group conversations, senders can edit or delete their own messages for up to 10 minutes after sending. Edits are saved for all participants and marked **Edited**; deleting a message removes it for everyone. The server enforces the time limit.

Messages can be replied to or forwarded to any public account, an accepted private connection, or a group. In a direct conversation, the header search filters loaded messages, and the options menu can clear the conversation from your view or block/unblock the other person. Clearing is per-account and does not remove messages from the other person's history. Blocking prevents direct messages, calls, and new connection requests until unblocked.

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

Administrators can also send an in-app notification to all accounts or to one selected account from the dashboard. Announcements appear in each recipient's notification inbox.

Usage tracking starts when this version is deployed. Time is estimated from visible app sessions and periodic heartbeats; earlier usage is not available.
