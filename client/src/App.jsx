import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Phone, Video } from "lucide-react";
import CallOverlay from "./CallOverlay.jsx";
import useCall from "./useCall.js";
import {
  ArrowLeft,
  ArrowUp,
  Activity,
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Copy,
  Clock3,
  LogIn,
  LogOut,
  LockKeyhole,
  MessageCircle,
  MessageSquare,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShieldOff,
  Smile,
  Star,
  Sparkles,
  Sun,
  Trash2,
  UnlockKeyhole,
  UserRound,
  UsersRound,
  Forward,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const messageActionWindowMs = 10 * 60 * 1000;
const LanguageContext = createContext((value) => value);
const kinyarwanda = {
  "YOUR SPACE, YOUR PEOPLE": "AHANTU HAWE, ABANTU BAWE",
  "Welcome back": "Urakaza neza",
  "Find your people": "Shaka abantu bawe",
  "Pick up right where you left off.": "Komeza aho wari ugeze.",
  "Create an account and start a conversation.": "Fungura konti utangire kuganira.",
  "Your name": "Amazina yawe",
  "Unique username": "Izina ryihariye",
  "Everyone can find accounts by username.": "Buri wese ashobora gushaka konti akoresheje izina.",
  "Your age": "Imyaka yawe",
  "Make my account private": "Gira konti yanjye iyihariye",
  "People can find your account, but must connect and be accepted before messaging you.": "Abantu bashobora kubona konti yawe, ariko bagomba gusaba guhuza ukabyemera mbere yo kukwandikira.",
  "Email address": "Imeyili",
  "Password": "Ijambo ry'ibanga",
  "At least 8 characters": "Nibura inyuguti 8",
  "Sign in": "Injira",
  "Create account": "Fungura konti",
  "New to Ububiko?": "Ni ubwa mbere ukoresha Ububiko?",
  "Already have an account?": "Usanzwe ufite konti?",
  "Create an account": "Fungura konti",
  "YOUR COMMUNITY": "UMURYANGO WAWE",
  "Messages": "Ubutumwa",
  "Search by username…": "Shakisha ukoresheje izina…",
  "Add a private account": "Ongeraho konti yihariye",
  "Request connection with private ID": "Saba guhuza ukoresheje ID yihariye",
  "Enter 5-digit ID": "Andika ID y'imibare 5",
  "Adding…": "Birimo kongerwa…",
  "Add": "Ongeraho",
  "Manage access": "Genzura uburenganzira",
  "GROUPS": "AMATSINDA",
  "New": "Gishya",
  "PEOPLE": "ABANTU",
  "Finding your people…": "Turimo gushaka abantu bawe…",
  "No one found": "Nta muntu ubonetse",
  "Your circle starts here": "Abo muganira bahera hano",
  "Search again by username.": "Ongera ushake ukoresheje izina.",
  "Search by username to find any account.": "Shakisha ukoresheje izina kugira ngo ubone konti iyo ari yo yose.",
  "Sign out": "Sohoka",
  "Profile": "Umwirondoro",
  "My profile": "Umwirondoro wanjye",
  "ACCOUNT SETTINGS": "IMITERERE YA KONTI",
  "Your profile": "Umwirondoro wawe",
  "Connections": "Abo mwahuye",
  "Five-digit ID copied": "ID y'imibare itanu yakoporowe",
  "Your five-digit ID": "ID yawe y'imibare itanu",
  "Copy ID": "Koporora ID",
  "Dark mode": "Uburyo bw'ijoro",
  "Change how Ububiko looks on this device.": "Hindura uko Ububiko igaragara kuri iki gikoresho.",
  "Message notifications": "Kumenyeshwa ubutumwa",
  "Show browser alerts when new messages arrive.": "Erekana imenyesha iyo ubutumwa bushya buje.",
  "Private account": "Konti yihariye",
  "People must connect and be accepted before messaging you.": "Abantu bagomba gusaba guhuza ukabyemera mbere yo kukwandikira.",
  "Public account": "Konti igaragara",
  "People can find you by username and message you right away.": "Abantu bashobora kugushaka bakoresheje izina ryawe bakakwandikira ako kanya.",
  "Language / Ururimi": "Ururimi / Language",
  "Edit profile": "Hindura umwirondoro",
  "Display name": "Izina rigaragara",
  "Current password (to change password)": "Ijambo ry'ibanga rikoreshwa ubu",
  "New password": "Ijambo ry'ibanga rishya",
  "Leave blank to keep current password": "Reka ubusa niba udashaka kurihindura",
  "Save changes": "Bika impinduka",
  "Profile updated.": "Umwirondoro wahinduwe.",
  "Close settings": "Funga igenamiterere",
  "A GOOD PLACE TO BEGIN": "AHANTU HEZA HO GUTANGIRIRA",
  "Small moments make lasting connections.": "Ibihe bito byubaka ubucuti burambye.",
  "Messaging access": "Uburenganzira bwo kohereza ubutumwa",
  "Choose who can start and receive conversations on Ububiko.": "Hitamo abashobora gutangiza no kwakira ibiganiro kuri Ububiko.",
  "Registered people": "Abantu biyandikishije",
  "Can use messaging": "Bashobora kohereza ubutumwa",
  "Messaging paused": "Ubutumwa bwahagaritswe",
  "Private accounts": "Konti zihariye",
  "Refresh": "Kuvugurura",
  "People": "Abantu",
  "Search people": "Shakisha abantu",
  "Loading accounts…": "Konti zirimo gufunguka…",
  "Messaging on": "Ubutumwa burakora",
  "Messaging off": "Ubutumwa ntibukora",
  "Disable": "Hagarika",
  "Enable": "Emeza",
  "Members": "Abanyamuryango",
  "Public group": "Itsinda rusange",
  "Private group": "Itsinda ryihariye",
  "Make public": "Gira rusange",
  "Make private": "Gira iryihariye",
  "Add member": "Ongeraho umunyamuryango",
  "Add by username or 5-digit ID": "Ongeraho ukoresheje izina cyangwa ID y'imibare 5",
  "Join this group": "Injira muri iri tsinda",
  "Join group": "Injira mu itsinda",
  "This group has": "Iri tsinda rifite",
  "members. Join to view and send messages.": "abanyamuryango. Injira kugira ngo ubone ubutumwa wohereze n'ubwo kwakira.",
  "Opening group…": "Itsinda ririmo gufunguka…",
  "Open my profile": "Fungura umwirondoro wanjye",
  "Invite only": "Urajyamo utumiwe gusa",
  "Connect before chatting": "Banza musabe guhuza mbere yo kuganira",
  "Seen": "Byasomwe",
  "Not seen": "Ntibirasomwa",
  "Send a connection request to start a private conversation.": "Saba guhuza kugira ngo mutangire kuganira mu ibanga.",
  "Request connection": "Saba guhuza",
  "Connection request sent. You can chat after they accept.": "Ubusabe bwo guhuza bwoherejwe. Muzaganira namara kubwemera.",
  "Cancel request": "Hagarika ubusabe",
  "wants to connect with you.": "arashaka ko muhuza.",
  "Accept connection": "Emera guhuza",
  "Decline": "Anga",
  "Connected": "Mwahuye",
  "Connection request": "Ubusabe bwo guhuza",
  "Request sent": "Ubusabe bwoherejwe",
  "Group not found.": "Itsinda ntiriboneka.",
  "System administration": "Imicungire ya sisitemu",
  "Manage accounts, review usage, and control messaging.": "Genzura konti, imikoreshereze n'ubutumwa.",
  "Active in last 2 minutes": "Bakoresheje mu minota 2 ishize",
  "Tracked usage": "Igihe bamaze bakoresha",
  "Messages sent": "Ubutumwa bwoherejwe",
  "Total sign-ins": "Inshuro zose zinjiwemo",
  "Groups": "Amatsinda",
  "Sorted by tracked usage. Server uptime": "Bikurikiranye hakurikijwe imikoreshereze. Seriveri imaze",
  "Joined": "Yinjiye",
  "Last sign-in": "Aheruka kwinjira",
  "Last active": "Aheruka gukoresha",
  "sign-ins": "inshuro zinjiwemo",
  "messages": "ubutumwa",
  "Delete account": "Siba konti",
  "Delete account for": "Siba konti ya",
  "Messaging controls and account deletion are enforced by the server. Usage time is estimated while the app is open.": "Igenzura ry'ubutumwa no gusiba konti bikorwa na seriveri. Igihe cyo gukoresha kibarwa igihe porogaramu ifunguye.",
  "Notifications": "Amatangazo",
  "Mark all as read": "Shyira yose ko yasomwe",
  "No notifications yet": "Nta matangazo arahari",
  "View notification": "Reba itangazo",
  "Close notifications": "Funga amatangazo",
  "Accepting lets you exchange private messages.": "Kwemera bituma mushobora kohererezanya ubutumwa bw'ibanga.",
  "Loading…": "Birimo gufunguka…",
  "Create a group": "Kora itsinda",
  "Group name": "Izina ry'itsinda",
  "Create group": "Kora itsinda",
  "Only members can find and open this group. Only you can add members.": "Abanyamuryango ni bo babona itsinda. Wowe wenyine ni wowe ushobora kongeramo abantu.",
  "Find someone": "Shaka umuntu",
  "Admin dashboard": "Imbonerahamwe y'ubuyobozi",
  "Ububiko is for ages 15 and older": "Ububiko ni iy'abafite imyaka 15 kuzamura",
  "This account cannot use the app.": "Iyi konti ntiyemerewe gukoresha iyi porogaramu.",
  "A little closer, every day": "Turushaho kwegerana buri munsi",
  "Good conversations": "Ibiganiro byiza",
  "stay with you.": "bigumana nawe.",
  "A calm, thoughtful space to catch up with your people — wherever life takes you.": "Ahantu hatuje ho kuganirira n'abawe, aho waba uri hose.",
  "Made for the people who matter.": "Byagenewe abantu bakomeye kuri wowe.",
  "Your conversations are private": "Ibiganiro byawe ni ibanga",
  "One moment…": "Tegereza gato…",
  "ONE QUICK STEP": "INTAMBWE IMWE NGUFI",
  "Finish setting up": "Rangiza gutunganya konti",
  "Choose your unique username and enter your age to continue. Ububiko is for people aged 15 and older.": "Hitamo izina ryihariye wandike n'imyaka yawe kugira ngo ukomeze. Ububiko ni iy'abafite imyaka 15 kuzamura.",
  "Continue": "Komeza",
  "Saving…": "Birimo kubikwa…",
  "WORKSPACE SETTINGS": "IMITERERE Y'AKAZI",
  "Manage messaging access for each account.": "Genzura uburenganzira bwo kohereza ubutumwa kuri buri konti.",
  "No accounts match your search.": "Nta konti ijyanye n'ibyo washakishije.",
  "No accounts to manage yet.": "Nta konti zo gucunga zirahari.",
  "Messaging access is checked by the server, not just hidden in the app.": "Uburenganzira bwo kohereza ubutumwa bugenzurwa na seriveri.",
  "Opening your conversation…": "Ikiganiro kirimo gufunguka…",
  "This is the beginning of your conversation.": "Iki ni intangiriro y'ikiganiro cyanyu.",
  "Keep it kind. Keep it you.": "Gira umutima mwiza, ube wowe.",
  "Write a message to": "Andikira",
  "Search conversation": "Shakisha mu kiganiro",
  "Conversation options": "Amahitamo y'ikiganiro",
  "Send a notification": "Ohereza imenyesha",
  "Send an announcement to everyone or one account.": "Ohereza itangazo kuri bose cyangwa kuri konti imwe.",
  "Send to": "Ohereza kuri",
  "All users": "Abakoresha bose",
  "Notification title": "Umutwe w'imenyesha",
  "Notification message": "Ubutumwa bw'imenyesha",
  "Send notification": "Ohereza imenyesha",
  "Sending…": "Birimo koherezwa…",
  "Notification sent to": "Imenyesha ryoherejwe kuri",
  "Search messages": "Shakisha ubutumwa",
  "Checking your session…": "Turimo kugenzura konti yawe…",
  "Unable to verify your session": "Ntitwashoboye kugenzura konti yawe",
  "Try again": "Ongera ugerageze",
  "Return to sign in": "Subira ku kwinjira",
  "Search messages in this chat": "Shakisha ubutumwa muri iki kiganiro",
  "No messages match your search.": "Nta butumwa buhuye n'ibyo washakishije.",
  "Delete conversation": "Siba ibiganiro kuri iyi konti",
  "Delete seen messages after 1 day: On": "Siba ubutumwa bwabonwe nyuma y'umunsi 1: Bikora",
  "Delete seen messages after 1 day: Off": "Siba ubutumwa bwabonwe nyuma y'umunsi 1: Ntibikora",
  "Clear this conversation from your view? Messages will remain visible to the other person.": "Siba ibiganiro kuri konti yawe? Ubutumwa buzakomeza kuboneka ku wundi muntu.",
  "Block person": "Hagarika uyu muntu",
  "Unblock person": "Ongera wemerere uyu muntu",
  "Block this person? They will not be able to message you or send a connection request.": "Hagarika uyu muntu? Ntazongera kukwandikira cyangwa kohereza ubusabe bwo guhuza.",
  "Conversation cleared from your view.": "Ibiganiro byasibwe kuri konti yawe.",
  "This person is blocked. Unblock them to send a connection request.": "Uyu muntu waramuhagaritse. Mwemerere kugira ngo wohereze ubusabe bwo guhuza.",
  "This person is blocked.": "Uyu muntu uramuhagaritse.",
  "FAVORITES": "ABAKUNDAWE",
  "Add to favorites": "Shyira mu bakunzwe",
  "Remove from favorites": "Kura mu bakunzwe",
  "Favorite person": "Umuntu ukunda",
  "Message sent": "Ubutumwa bwoherejwe",
  "Yesterday": "Ejo hashize",
  "Today": "Uyu munsi",
  "Every good conversation starts with a hello.": "Ibiganiro byiza bitangirana no kuramukanya.",
  "Choose someone on the left and say yours.": "Hitamo umuntu ibumoso umutashye.",
  "person": "umuntu",
  "people": "abantu",
  "in your community": "mu muryango wawe",
  "Admin": "Umuyobozi",
  "Disable messaging for": "Hagarika ubutumwa kuri",
  "Enable messaging for": "Emeza ubutumwa kuri",
  "Hey,": "Muraho,",
  "members": "abanyamuryango",
  "Back to groups": "Subira ku matsinda",
  "Working…": "Birimo gukora…",
  "Dismiss error": "Funga ubutumwa bw'ikosa",
  "Send message": "Ohereza ubutumwa",
  "Active now": "Ari kuri interineti ubu",
  "Edited": "Byahinduwe",
  "Audio call": "Ihamagara ry'amajwi",
  "Video call": "Ihamagara rya videwo",
  "Missed call": "Ihamagara utitabye",
  "No answer": "Nta gisubizo",
  "Declined": "Byanzwe",
  "Declined call": "Ihamagara ryanzwe",
  "Cancelled": "Byahagaritswe",
  "Call cancelled": "Ihamagara ryahagaritswe",
  "Call disconnected": "Ihamagara ryacitse",
  "Call ended": "Ihamagara ryarangiye",
  "Call history": "Amateka y'ihamagara",
  "Edit": "Hindura",
  "Delete": "Siba",
  "Save": "Bika",
  "Cancel": "Reka",
  "Delete this message for everyone?": "Siba ubu butumwa ku bantu bose?",
  "Edit message": "Hindura ubutumwa",
  "Reply": "Subiza",
  "Forward": "Ohereza ku wundi",
  "Replying to": "Urasubiza",
  "Cancel reply": "Reka gusubiza",
  "Forward message": "Ohereza ubutumwa ku wundi",
  "Forwarded from": "Byoherejwe mbere na",
  "Choose a conversation": "Hitamo ikiganiro",
  "Connect with someone before forwarding a message.": "Banza uhuze n'umuntu mbere yo kumwoherereza ubutumwa.",
  "No conversations available to forward to.": "Nta biganiro bihari byo koherezamo ubutumwa.",
  "SHARE A MESSAGE": "SANGIZA UBUTUMWA",
  "a group member": "umunyamuryango w'itsinda",
  "Message": "Ubutumwa",
  "Joining…": "Birimo kwinjira…",
  "Private": "Byihariye",
  "Messaging disabled": "Ubutumwa bwahagaritswe",
  "Messaging disabled for your account.": "Ubutumwa bwahagaritswe kuri konti yawe.",
  "is not accepting messages right now.": "ntashobora kwakira ubutumwa ubu.",
  "Open my profile and settings": "Fungura umwirondoro n'igenamiterere",
  "Close create group": "Funga igice cyo gukora itsinda",
  "e.g. Weekend plans": "urugero: gahunda z'ikiruhuko",
  "Creating…": "Birimo gukorwa…",
  "Emoji": "Emojis",
  "to send": "kugira ngo wohereze",
  "for a new line": "kugira ngo utangire umurongo mushya",
  "New message": "Ubutumwa bushya",
  "Message from": "Ubutumwa buvuye kuri",
};

function useT() {
  const language = useContext(LanguageContext);
  return (value) => language === "rw" ? (kinyarwanda[value] || value) : value;
}

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }
  if (!response.ok) {
    const error = new Error(data.message || "We couldn't complete that request.");
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

function updatePersonLastMessage(people, userId, createdAt) {
  const timestamp = new Date(createdAt).getTime();
  return people.map((person) => {
    if (person.id !== userId || (person.lastMessageAt && new Date(person.lastMessageAt).getTime() >= timestamp)) {
      return person;
    }
    return { ...person, lastMessageAt: createdAt };
  });
}

function getInitials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

function formatDay(date) {
  const value = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (value.toDateString() === today.toDateString()) return "Today";
  if (value.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(value);
}

function formatDuration(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days) return `${days}d ${hours % 24}h`;
  if (hours) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatDateTime(date) {
  return date
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date))
    : "Never";
}

function Avatar({ name, size = "normal", online = false }) {
  return (
    <div className={`avatar avatar-${size}`} aria-label={online ? `${name} (active now)` : name} title={online ? `${name} is active now` : undefined}>
      <span>{getInitials(name)}</span>
      {online && <i className="online-dot" />}
    </div>
  );
}

function canChangeMessage(createdAt) {
  const age = Date.now() - new Date(createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < messageActionWindowMs;
}

function MessageItem({ message, own, avatarName, senderName, sourceType, onEdit, onDelete, onReply, onForward }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [busy, setBusy] = useState(false);
  const [withinActionWindow, setWithinActionWindow] = useState(() => own && canChangeMessage(message.createdAt));
  const readReceipt = own && sourceType === "direct" && message.type !== "call" && (
    <span className="read-receipt" aria-label={t(message.seenAt ? "Seen" : "Not seen")} title={t(message.seenAt ? "Seen" : "Not seen")}>
      {message.seenAt ? <CheckCheck size={14} /> : <Check size={14} />}
      <span>{t(message.seenAt ? "Seen" : "Not seen")}</span>
    </span>
  );

  useEffect(() => {
    if (!own) return undefined;
    const expiresIn = new Date(message.createdAt).getTime() + messageActionWindowMs - Date.now();
    if (expiresIn <= 0) {
      setWithinActionWindow(false);
      setEditing(false);
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setWithinActionWindow(false);
      setEditing(false);
    }, expiresIn);
    return () => window.clearTimeout(timeoutId);
  }, [message.createdAt, own]);

  if (message.type === "call") {
    const icon = message.callType === "video" ? <Video size={17} /> : <Phone size={17} />;
    const callLabel = t(message.callType === "video" ? "Video call" : "Audio call");
    const outcome = message.callStatus === "missed"
      ? own ? t("No answer") : t("Missed call")
      : message.callStatus === "declined"
        ? own ? t("Declined") : t("Declined call")
        : message.callStatus === "cancelled"
          ? own ? t("Cancelled") : t("Call cancelled")
          : message.callStatus === "disconnected"
            ? t("Call disconnected")
            : t("Call ended");
    const duration = message.durationSeconds > 0
      ? ` · ${Math.floor(message.durationSeconds / 60)}:${String(message.durationSeconds % 60).padStart(2, "0")}`
      : "";
    return <div className={`message-row call-history-row ${own ? "own-message" : ""}`}>
      {!own && <Avatar name={avatarName || senderName} size="tiny" />}
      <div className="message-content">
        <div className="call-history-card">{icon}<span><strong>{callLabel}</strong><small>{outcome}{message.callStatus === "completed" ? duration : ""}</small></span></div>
        <span className="message-meta">{formatTime(message.createdAt)} {readReceipt}</span>
      </div>
    </div>;
  }

  async function saveEdit(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || content === message.content || busy) return;
    setBusy(true);
    try {
      if (await onEdit(message.id, content)) setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage() {
    if (busy || !window.confirm(t("Delete this message for everyone?"))) return;
    setBusy(true);
    try {
      await onDelete(message.id);
    } finally {
      setBusy(false);
    }
  }

  return <div className={`message-row ${own ? "own-message" : ""}`}>
    {!own && <Avatar name={avatarName || senderName} size="tiny" />}
    <div className="message-content">
      {senderName && !own && <small className="group-sender-name">{senderName}</small>}
      {message.forwardedFrom && <div className="message-forwarded-label"><Forward size={12} /> {t("Forwarded from")} {message.forwardedFrom.senderName}</div>}
      {editing ? <form className="message-edit-form" onSubmit={saveEdit}>
        <textarea
          autoFocus
          value={draft}
          maxLength={4000}
          rows={Math.min(4, Math.max(1, draft.split("\n").length))}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(message.content);
              setEditing(false);
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          aria-label={t("Edit message")}
        />
        <span className="message-edit-actions">
          <button type="submit" disabled={!draft.trim() || draft.trim() === message.content || busy}>{busy ? t("Working…") : t("Save")}</button>
          <button type="button" disabled={busy} onClick={() => { setDraft(message.content); setEditing(false); }}>{t("Cancel")}</button>
        </span>
      </form> : <div className="message-bubble">
        {message.replyTo && <div className="message-reply-preview"><strong>{message.replyTo.senderName}</strong><span>{message.replyTo.content}</span></div>}
        {message.content}
      </div>}
      {!editing && <div className="message-actions">
        <button type="button" disabled={busy} onClick={() => onReply({ ...message, senderName: senderName || message.senderName, sourceType })}>{t("Reply")}</button>
        <button type="button" disabled={busy} onClick={() => onForward({ ...message, senderName: senderName || message.senderName, sourceType })}>{t("Forward")}</button>
        {own && withinActionWindow && <>
          <button type="button" disabled={busy} onClick={() => { setDraft(message.content); setEditing(true); }}>{t("Edit")}</button>
          <button type="button" disabled={busy} onClick={deleteMessage}>{t("Delete")}</button>
        </>}
      </div>}
      <span className="message-meta">
        {formatTime(message.createdAt)} {message.editedAt && <span className="message-edited">{t("Edited")}</span>}
        {readReceipt}
      </span>
    </div>
  </div>;
}

const EmojiPalette = lazy(() => import("./EmojiPalette.jsx"));

function EmojiPicker({ value, onChange, textareaRef }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    function onPointerDown(event) {
      if (open && !pickerRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (open && event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function insertEmoji(emoji) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const nextValue = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    if (nextValue.length > 4000) return;
    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  return (
    <span className="composer-emoji-wrap" ref={pickerRef}>
      <button
        type="button"
        className="icon-button composer-emoji"
        aria-label={t("Emoji")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      ><Smile size={19} /></button>
      {open && <Suspense fallback={<span className="emoji-picker-loading" role="status">{t("Loading emojis…")}</span>}>
        <EmojiPalette onSelect={insertEmoji} />
      </Suspense>}
    </span>
  );
}

function ThemeToggle({ darkMode, onToggle }) {
  const t = useT();
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={t(darkMode ? "Switch to light mode" : "Switch to dark mode")}
      title={t(darkMode ? "Switch to light mode" : "Switch to dark mode")}
    >
      {darkMode ? <Sun size={17} /> : <Moon size={17} />}
      <span>{t(darkMode ? "Light mode" : "Dark mode")}</span>
    </button>
  );
}

function AuthScreen({ onAuthenticated, darkMode, onToggleDarkMode }) {
  const t = useT();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api(`/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify({
          ...(mode === "register" ? { name, username, age: Number(age), isPrivate } : {}),
          email,
          password,
        }),
      });
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-brand-inline"><span className="brand-mark"><MessageCircle size={18} fill="currentColor" /></span> ububiko</div>
          <span className="welcome-tag">{t("YOUR SPACE, YOUR PEOPLE")}</span>
          <h2>{t(mode === "login" ? "Welcome back" : "Find your people")}</h2>
          <p className="auth-subtitle">{t(mode === "login" ? "Pick up right where you left off." : "Create an account and start a conversation.")}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && <>
              <label>{t("Your name")}<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" required minLength={2} maxLength={60} /></label>
              <label>{t("Unique username")}<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())} placeholder="e.g. alex_morgan" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" /><small className="field-hint">{t("Everyone can find accounts by username.")}</small></label>
              <label>{t("Your age")}<input type="number" inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value)} placeholder="15 or older" required min={15} max={120} step={1} /></label>
              <label className="privacy-choice"><input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} /><span><strong>{t("Make my account private")}</strong><small>{t("People can find your account, but must connect and be accepted before messaging you.")}</small></span></label>
            </>}
            <label>{t("Email address")}<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>{t("Password")}<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("At least 8 characters")} required minLength={8} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button auth-submit" disabled={loading}>{loading ? "One moment…" : t(mode === "login" ? "Sign in" : "Create account")} <ArrowUp size={16} className="button-arrow" /></button>
          </form>
          <div className="auth-switch">{t(mode === "login" ? "New to Ububiko?" : "Already have an account?")} <button onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}> {t(mode === "login" ? "Create an account" : "Sign in")}</button></div>
        </div>
        <div className="auth-footer"><span><i /> {t("Your conversations are private")}</span><button aria-label="Help"><CircleHelp size={17} /></button></div>
      </section>
    </main>
  );
}

function CompleteProfile({ session, onCompleted, onSignOut, darkMode, onToggleDarkMode }) {
  const t = useT();
  const [username, setUsername] = useState(session.user.username || "");
  const [age, setAge] = useState(session.user.age ? String(session.user.age) : "");
  const [isPrivate, setIsPrivate] = useState(session.user.isPrivate === true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { user } = await api("/auth/profile", {
        token: session.token,
        method: "PATCH",
        body: JSON.stringify({ username, age: Number(age), isPrivate }),
      });
      onCompleted({ ...session, user });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page profile-setup-page">
      <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />
      <section className="profile-setup">
        <span className="welcome-tag">{t("ONE QUICK STEP")}</span>
        <h1>{t("Finish setting up")}</h1>
        <p>{t("Choose your unique username and enter your age to continue. Ububiko is for people aged 15 and older.")}</p>
        <form onSubmit={submit} className="auth-form">
          <label>{t("Unique username")}<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" /></label>
          <label>{t("Your age")}<input type="number" inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value)} required min={15} max={120} step={1} /></label>
          <label className="privacy-choice"><input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} /><span><strong>{t("Make my account private")}</strong><small>{t("People can find your account, but must connect and be accepted before messaging you.")}</small></span></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button auth-submit" disabled={saving}>{saving ? t("Saving…") : t("Continue")} <ArrowUp size={16} className="button-arrow" /></button>
        </form>
        <button className="setup-signout" onClick={onSignOut}>{t("Sign out")}</button>
      </section>
    </main>
  );
}

function ProfileSettings({
  session,
  connectedPeopleCount,
  onClose,
  onUpdated,
  darkMode,
  onToggleDarkMode,
  notificationsEnabled,
  onToggleNotifications,
  onTogglePrivacy,
  updatingPrivacy,
  language,
  onLanguageChange,
}) {
  const t = useT();
  const [name, setName] = useState(session.user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const { user } = await api("/auth/profile", {
        token: session.token,
        method: "PATCH",
        body: JSON.stringify({
          name,
          ...(newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      onUpdated({ ...session, user });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess(t("Profile updated."));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyId() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable in this browser.");
      await navigator.clipboard.writeText(session.user.userCode);
      setCopied(true);
    } catch (copyError) {
      setError(copyError.message);
    }
  }

  return (
    <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div><span className="welcome-tag">{t("ACCOUNT SETTINGS")}</span><h2 id="settings-title">{t("Your profile")}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label={t("Close settings")}><X size={19} /></button>
        </header>
        <div className="settings-id-card">
          <Avatar name={session.user.name} size="large" />
          <div><strong>{session.user.name}</strong><span>@{session.user.username}</span><small>{copied ? t("Five-digit ID copied") : t("Your five-digit ID")}</small></div>
          <strong className="settings-user-code">{session.user.userCode}</strong>
          <button type="button" className="settings-copy-button" onClick={copyId}><Copy size={14} /> {t("Copy ID")}</button>
        </div>
        <div className="settings-connection-count">
          <UsersRound size={17} />
          <span><strong>{connectedPeopleCount}</strong><small>{t("Connections")}</small></span>
        </div>
        <div className="settings-options">
          <button className="settings-option" type="button" onClick={onToggleDarkMode} aria-pressed={darkMode}>
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            <span><strong>{t("Dark mode")}</strong><small>{t("Change how Ububiko looks on this device.")}</small></span>
            <span className={`privacy-switch ${darkMode ? "is-private" : ""}`} />
          </button>
          <button className="settings-option" type="button" onClick={onToggleNotifications} aria-pressed={notificationsEnabled}>
            {notificationsEnabled ? <Bell size={17} /> : <BellOff size={17} />}
            <span><strong>{t("Message notifications")}</strong><small>{t("Show browser alerts when new messages arrive.")}</small></span>
            <span className={`privacy-switch ${notificationsEnabled ? "is-private" : ""}`} />
          </button>
          <button className="settings-option" type="button" onClick={onTogglePrivacy} disabled={updatingPrivacy} aria-pressed={session.user.isPrivate}>
            {session.user.isPrivate ? <LockKeyhole size={17} /> : <UnlockKeyhole size={17} />}
            <span><strong>{t(session.user.isPrivate ? "Private account" : "Public account")}</strong><small>{t(session.user.isPrivate ? "People must connect and be accepted before messaging you." : "People can find you by username and message you right away.")}</small></span>
            <span className={`privacy-switch ${session.user.isPrivate ? "is-private" : ""}`} />
          </button>
        </div>
        <label className="language-setting"><span>{t("Language / Ururimi")}</span><select value={language} onChange={(event) => onLanguageChange(event.target.value)}><option value="en">English</option><option value="rw">Kinyarwanda</option></select></label>
        <form className="profile-edit-form" onSubmit={saveProfile}>
          <h3>{t("Edit profile")}</h3>
          <label>{t("Display name")}<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required /></label>
          <label>{t("Current password (to change password)")}<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label>{t("New password")}<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={72} placeholder={t("Leave blank to keep current password")} /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          {success && <div className="form-success" role="status">{success}</div>}
          <button className="primary-button profile-save" disabled={saving}>{saving ? t("Saving…") : t("Save changes")}</button>
        </form>
      </section>
    </div>
  );
}

function WelcomePanel({ user, people }) {
  const t = useT();
  const firstName = user.name.split(/\s+/)[0];
  return (
    <div className="welcome-panel">
      <div className="welcome-decor decor-a" /><div className="welcome-decor decor-b" />
      <div className="welcome-center">
        <div className="welcome-icon"><MessageCircle size={27} /></div>
        <span className="welcome-tag">{t("A GOOD PLACE TO BEGIN")}</span>
        <h2>{t("Hey,")} {firstName}.</h2>
        <p>{t("Every good conversation starts with a hello.")}<br />{t("Choose someone on the left and say yours.")}</p>
        <div className="people-count"><UsersRound size={15} /> {people.length} {t(people.length === 1 ? "person" : "people")} {t("in your community")}</div>
      </div>
      <div className="welcome-bottom"><span>{t("Small moments make lasting connections.")}</span><Sparkles size={15} /></div>
    </div>
  );
}

function GroupChatPanel({ group, session, messages, onMessagesLoaded, onMessage, onMessageUpdated, onMessageDeleted, onGroupUpdated, onGoBack, onOpenProfile, onForward }) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (!group.isMember) {
      setLoading(false);
      return () => { active = false; };
    }
    api(`/groups/${group.id}/messages`, { token: session.token })
      .then(({ messages: loaded }) => { if (active) onMessagesLoaded(group.id, loaded); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [group.id, group.isMember, session.token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    try {
      const { message } = await api(`/groups/${group.id}/messages`, {
        token: session.token,
        method: "POST",
        body: JSON.stringify({
          content,
          ...(replyTarget ? { replyTo: { messageId: replyTarget.id, sourceType: replyTarget.sourceType } } : {}),
        }),
      });
      onMessage(message);
      setDraft("");
      setReplyTarget(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  async function editGroupMessage(messageId, content) {
    setError("");
    try {
      const { message } = await api(`/groups/${group.id}/messages/${messageId}`, {
        token: session.token,
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      onMessageUpdated(message);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function deleteGroupMessage(messageId) {
    setError("");
    try {
      await api(`/groups/${group.id}/messages/${messageId}`, {
        token: session.token,
        method: "DELETE",
      });
      onMessageDeleted(group.id, messageId);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function addMember(event) {
    event.preventDefault();
    if (!identifier.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { group: updatedGroup } = await api(`/groups/${group.id}/members`, {
        token: session.token,
        method: "POST",
        body: JSON.stringify({ identifier }),
      });
      onGroupUpdated(updatedGroup);
      setIdentifier("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group-chat">
      <header className="chat-header">
        <button className="icon-button back-button" aria-label={t("Back to groups")} onClick={onGoBack}><ArrowLeft size={19} /></button>
        <span className="group-chat-icon"><UsersRound size={19} /></span>
        <div className="chat-person"><h2>{group.name}</h2><span><LockKeyhole size={12} /> {t("Private group")} · {group.memberCount} {t("members")}</span></div>
        <button className="icon-button profile-quick-button" type="button" onClick={onOpenProfile} aria-label={t("Open my profile")} title={t("My profile")}><UserRound size={18} /><span>{t("Profile")}</span></button>
      </header>
      {group.isMember ? <>
        <div className="group-members-strip"><strong>{t("Members")}</strong><span>{group.members.map((member) => `@${member.username}`).join(" · ")}</span></div>
        {group.createdBy === session.user.id && <form className="group-add-member" onSubmit={addMember}><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={t("Add by username or 5-digit ID")} required /><button type="submit" disabled={busy}>{busy ? t("Working…") : t("Add member")}</button></form>}
        <div className="messages-area group-messages">
          {loading ? <div className="message-loading">{t("Opening group…")}</div> : messages.map((message, index) => {
            const own = message.senderId === session.user.id;
            const previous = messages[index - 1];
            const showDate = !previous || new Date(message.createdAt).toDateString() !== new Date(previous.createdAt).toDateString();
            return <div key={message.id}>{showDate && <div className="date-divider"><span>{formatDay(message.createdAt)}</span></div>}<MessageItem
              message={message}
              own={own}
              senderName={message.senderName}
              sourceType="group"
              onEdit={editGroupMessage}
              onDelete={deleteGroupMessage}
              onReply={setReplyTarget}
              onForward={onForward}
            /></div>;
          })}
          <div ref={endRef} />
        </div>
        {error && <div className="inline-error" role="alert">{error}<button onClick={() => setError("")} aria-label={t("Dismiss error")}><X size={14} /></button></div>}
        <div className="composer-wrap">
          {replyTarget && <div className="reply-composer-preview"><span><strong>{t("Replying to")} {replyTarget.senderName}</strong><small>{replyTarget.content}</small></span><button type="button" onClick={() => setReplyTarget(null)} aria-label={t("Cancel reply")}><X size={15} /></button></div>}
          <form className="composer" onSubmit={send}><EmojiPicker value={draft} onChange={setDraft} textareaRef={inputRef} /><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`${t("Message")} ${group.name}…`} maxLength={4000} rows={1} /><button type="submit" className="send-button" disabled={!draft.trim() || sending} aria-label={t("Send message")}>{sending ? <span className="send-loading" /> : <Send size={17} />}</button></form>
        </div>
      </> : <div className="group-join-state"><h3>{t("Group not found.")}</h3></div>}
    </div>
  );
}

function AdminDashboard({ session, onUserUpdated, onUserDeleted }) {
  const t = useT();
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [notificationRecipient, setNotificationRecipient] = useState("all");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationSuccess, setNotificationSuccess] = useState("");
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const { users: loadedUsers, summary: loadedSummary } = await api("/admin/analytics", { token: session.token });
      setUsers(loadedUsers);
      setSummary(loadedSummary);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [session.token]);

  async function toggleMessaging(user) {
    setUpdatingId(user.id);
    setError("");
    try {
      const { user: updatedUser } = await api(`/admin/users/${user.id}/messaging`, {
        token: session.token,
        method: "PATCH",
        body: JSON.stringify({ messagingEnabled: !user.messagingEnabled }),
      });
      setUsers((current) => current.map((item) => item.id === updatedUser.id ? updatedUser : item));
      onUserUpdated(updatedUser);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingId("");
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Permanently delete ${user.name} and their messages? This cannot be undone.`)) return;
    setDeletingId(user.id);
    setError("");
    try {
      await api(`/admin/users/${user.id}`, { token: session.token, method: "DELETE" });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      onUserDeleted(user.id);
      await loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId("");
    }
  }

  async function sendAdminNotification(event) {
    event.preventDefault();
    if (sendingNotification) return;
    setSendingNotification(true);
    setError("");
    setNotificationSuccess("");
    try {
      const { sent } = await api("/admin/notifications", {
        token: session.token,
        method: "POST",
        body: JSON.stringify({
          recipientId: notificationRecipient,
          title: notificationTitle,
          body: notificationBody,
        }),
      });
      setNotificationSuccess(`${t("Notification sent to")} ${sent} ${t(sent === 1 ? "person" : "people")}.`);
      setNotificationTitle("");
      setNotificationBody("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSendingNotification(false);
    }
  }

  const filteredUsers = [...users].sort((first, second) => second.activeSeconds - first.activeSeconds).filter((user) =>
    `${user.name} ${user.username} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const enabledCount = users.filter((user) => user.messagingEnabled).length;
  const privateCount = users.filter((user) => user.isPrivate).length;
  const busy = Boolean(updatingId || deletingId);

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <span className="welcome-tag">{t("WORKSPACE SETTINGS")}</span>
          <h2>{t("System administration")}</h2>
          <p>{t("Manage accounts, review usage, and control messaging.")}</p>
        </div>
        <button className="admin-refresh" onClick={loadUsers} disabled={loading || busy} aria-label="Refresh accounts">
          <RefreshCw size={16} className={loading ? "refresh-spinning" : ""} /> {t("Refresh")}
        </button>
      </header>
      <div className="admin-stats">
        <div className="admin-stat"><span className="admin-stat-icon"><UsersRound size={18} /></span><span><strong>{summary?.totalUsers ?? users.length}</strong><small>{t("Registered people")}</small></span></div>
        <div className="admin-stat"><span className="admin-stat-icon enabled"><Activity size={18} /></span><span><strong>{summary?.activeNow ?? 0}</strong><small>{t("Active in last 2 minutes")}</small></span></div>
        <div className="admin-stat"><span className="admin-stat-icon private"><Clock3 size={18} /></span><span><strong>{formatDuration(summary?.totalActiveSeconds)}</strong><small>{t("Tracked usage")}</small></span></div>
        <div className="admin-stat"><span className="admin-stat-icon paused"><MessageSquare size={18} /></span><span><strong>{summary?.totalMessages ?? 0}</strong><small>{t("Messages sent")}</small></span></div>
        <div className="admin-stat"><span className="admin-stat-icon private"><LogIn size={18} /></span><span><strong>{summary?.totalLogins ?? 0}</strong><small>{t("Total sign-ins")}</small></span></div>
        <div className="admin-stat"><span className="admin-stat-icon"><UsersRound size={18} /></span><span><strong>{summary?.totalGroups ?? 0}</strong><small>{t("Groups")}</small></span></div>
      </div>
      <form className="admin-notification-form" onSubmit={sendAdminNotification}>
        <div className="admin-notification-heading"><span className="admin-stat-icon"><Bell size={17} /></span><div><h3>{t("Send a notification")}</h3><p>{t("Send an announcement to everyone or one account.")}</p></div></div>
        <label>{t("Send to")}
          <select value={notificationRecipient} onChange={(event) => setNotificationRecipient(event.target.value)}>
            <option value="all">{t("All users")}</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name} (@{user.username || "—"}){user.isAdmin ? ` · ${t("Admin")}` : ""}</option>)}
          </select>
        </label>
        <label>{t("Notification title")}<input value={notificationTitle} onChange={(event) => setNotificationTitle(event.target.value)} maxLength={120} required /></label>
        <label>{t("Notification message")}<textarea value={notificationBody} onChange={(event) => setNotificationBody(event.target.value)} maxLength={240} rows={3} required /></label>
        <div className="admin-notification-footer">
          <span>{notificationSuccess && <span className="admin-notification-success" role="status">{notificationSuccess}</span>}</span>
          <button type="submit" className="primary-button" disabled={sendingNotification || loading}>{sendingNotification ? t("Sending…") : <><Send size={14} /> {t("Send notification")}</>}</button>
        </div>
      </form>
      <div className="admin-list-heading">
        <div><h3>{t("People")}</h3><span>{t("Sorted by tracked usage. Server uptime")}: {formatDuration(summary?.serverUptimeSeconds)}</span></div>
        <label className="admin-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search people")} /></label>
      </div>
      {error && <div className="admin-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button></div>}
      <div className="admin-users">
        {loading ? <div className="admin-empty">{t("Loading accounts…")}</div> : filteredUsers.length ? filteredUsers.map((user) => (
          <div className="admin-user-row" key={user.id}>
            <Avatar name={user.name} />
            <div className="admin-user-info"><strong>{user.name}{user.isAdmin && <span className="admin-badge"><ShieldCheck size={12} /> Admin</span>}</strong><span>@{user.username || "username missing"} · {Number.isInteger(user.age) ? `${user.age} years old` : "age missing"} · {user.email}</span><small>{t("Joined")}: {formatDateTime(user.createdAt)} · {t("Last sign-in")}: {formatDateTime(user.lastLoginAt)} · {t("Last active")}: {formatDateTime(user.lastActiveAt)}</small></div>
            <div className="admin-usage-metrics"><span><Clock3 size={12} /> {formatDuration(user.activeSeconds)}</span><span><LogIn size={12} /> {user.loginCount} · {t("sign-ins")}</span><span><MessageSquare size={12} /> {user.messagesSent} · {t("messages")}</span></div>
            {user.isPrivate && <span className="private-account-badge"><LockKeyhole size={12} /> Private</span>}
            <span className={`access-status ${user.messagingEnabled ? "access-on" : "access-off"}`}><i />{t(user.messagingEnabled ? "Messaging on" : "Messaging off")}</span>
            <button className={`access-toggle ${user.messagingEnabled ? "" : "toggle-off"}`} onClick={() => toggleMessaging(user)} disabled={busy || user.isAdmin} aria-label={`${user.messagingEnabled ? "Disable" : "Enable"} messaging for ${user.name}`}>
              {updatingId === user.id ? <span className="toggle-spinner" /> : t(user.messagingEnabled ? "Disable" : "Enable")}
            </button>
            {!user.isAdmin && <button className="admin-delete-button" type="button" onClick={() => deleteUser(user)} disabled={busy} aria-label={`${t("Delete account for")} ${user.name}`} title={t("Delete account")}>
              {deletingId === user.id ? <span className="toggle-spinner" /> : <Trash2 size={15} />}
            </button>}
          </div>
        )) : <div className="admin-empty">{search ? "No accounts match your search." : "No accounts to manage yet."}</div>}
      </div>
      <div className="admin-note"><ShieldCheck size={15} /><span>{t("Messaging controls and account deletion are enforced by the server. Usage time is estimated while the app is open.")}</span></div>
    </div>
  );
}

function NotificationInbox({
  notifications,
  unreadCount,
  loading,
  onClose,
  onSelect,
  onMarkAllRead,
}) {
  const t = useT();

  return (
    <section className="notification-panel" role="dialog" aria-label={t("Notifications")}>
      <header className="notification-header">
        <div><h2>{t("Notifications")}</h2><span>{unreadCount}</span></div>
        <div className="notification-header-actions">
          {unreadCount > 0 && <button type="button" onClick={onMarkAllRead}>{t("Mark all as read")}</button>}
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("Close notifications")}><X size={16} /></button>
        </div>
      </header>
      <div className="notification-list">
        {loading ? <div className="notification-empty">{t("Loading…")}</div> : notifications.length ? notifications.map((notification) => (
          <button
            type="button"
            className={`notification-item ${notification.readAt ? "" : "notification-unread"}`}
            key={notification.id}
            onClick={() => onSelect(notification)}
            aria-label={`${t("View notification")}: ${notification.title}`}
          >
            <span className="notification-icon">{notification.type === "admin_announcement" ? <Bell size={16} /> : notification.type === "connection_request" ? <UsersRound size={16} /> : notification.targetType === "group" ? <MessageSquare size={16} /> : <MessageCircle size={16} />}</span>
            <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.body}</span><small>{formatDateTime(notification.createdAt)}</small></span>
            {!notification.readAt && <i className="notification-unread-dot" />}
          </button>
        )) : <div className="notification-empty">{t("No notifications yet")}</div>}
      </div>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ububiko-session") || "null"); } catch { return null; }
  });
  const [authStatus, setAuthStatus] = useState(() => session ? "checking" : "ready");
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
  const [authError, setAuthError] = useState("");
  const [language, setLanguage] = useState(() => localStorage.getItem("ububiko-language") === "rw" ? "rw" : "en");
  const t = (value) => language === "rw" ? (kinyarwanda[value] || value) : value;
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState({});
  const [unreadPeople, setUnreadPeople] = useState({});
  const [unreadGroups, setUnreadGroups] = useState({});
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [conversationActionBusy, setConversationActionBusy] = useState(false);
  const [deleteAfterSeen, setDeleteAfterSeen] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [forwardError, setForwardError] = useState("");
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const [adminView, setAdminView] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ububiko-session") || "null")?.user?.isAdmin === true; } catch { return false; }
  });
  const [notifications, setNotifications] = useState([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [privateId, setPrivateId] = useState("");
  const [lookingUpPrivate, setLookingUpPrivate] = useState(false);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState("");
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("ububiko-dark-mode") === "true");
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem("ububiko-notifications") === "true");
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const messageEndRef = useRef(null);
  const inputRef = useRef(null);
  const conversationSearchInputRef = useRef(null);
  const conversationMenuRef = useRef(null);
  const selectedIdRef = useRef(selectedId);
  const selectedGroupIdRef = useRef(selectedGroupId);
  const notificationsEnabledRef = useRef(notificationsEnabled);
  const sessionRef = useRef(session);
  const languageRef = useRef(language);
  selectedIdRef.current = selectedId;
  selectedGroupIdRef.current = selectedGroupId;
  notificationsEnabledRef.current = notificationsEnabled;
  sessionRef.current = session;
  languageRef.current = language;
  const selectedPerson = people.find((person) => person.id === selectedId);
  const canOpenConversation = !selectedPerson?.isPrivate || selectedPerson.connectionStatus === "connected";
  const visibleMessages = conversationSearch.trim()
    ? messages.filter((message) => `${message.content} ${message.replyTo?.content || ""} ${message.forwardedFrom?.senderName || ""}`
      .toLocaleLowerCase().includes(conversationSearch.trim().toLocaleLowerCase()))
    : messages;
  const forwardablePeople = people.filter((person) => !person.isPrivate || person.connectionStatus === "connected");
  const connectedPeopleCount = people.filter((person) => person.connectionStatus === "connected").length;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;
  const callManager = useCall(socket, session?.token, (invite) => {
    setSelectedGroupId(null);
    setSelectedId(invite.fromId);
    setAdminView(false);
    setMobileChat(true);
    setError("");
  });

  useEffect(() => {
    if (session) localStorage.setItem("ububiko-session", JSON.stringify(session));
    else localStorage.removeItem("ububiko-session");
  }, [session]);

  useEffect(() => {
    if (!session?.token) {
      if (session) setSession(null);
      setAuthStatus("ready");
      return undefined;
    }

    let active = true;
    setAuthStatus("checking");
    setAuthError("");
    api("/auth/me", { token: session.token })
      .then(({ user }) => {
        if (!active) return;
        setSession((current) => current?.token === session.token ? { ...current, user } : current);
        setAdminView(user.isAdmin === true);
        setAuthStatus("ready");
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.status === 401 || requestError.status === 404) {
          setSession((current) => current?.token === session.token ? null : current);
          setAuthStatus("ready");
          return;
        }
        setAuthError(requestError.message);
        setAuthStatus("error");
      });
    return () => { active = false; };
  }, [session?.token, authCheckAttempt]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("ububiko-language", language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!session || authStatus !== "ready") return undefined;
    let active = true;
    setLoadingPeople(true);
    api("/users", { token: session.token })
      .then(({ users }) => { if (active) setPeople(users); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingPeople(false); });
    return () => { active = false; };
  }, [session, authStatus]);

  useEffect(() => {
    setReplyTarget(null);
    setConversationSearchOpen(false);
    setConversationSearch("");
    setConversationMenuOpen(false);
  }, [selectedId, selectedGroupId]);

  useEffect(() => {
    if (conversationSearchOpen) conversationSearchInputRef.current?.focus();
  }, [conversationSearchOpen]);

  useEffect(() => {
    if (!conversationMenuOpen) return undefined;
    function dismissMenu(event) {
      if (event.type === "keydown" && event.key === "Escape") {
        setConversationMenuOpen(false);
      } else if (event.type === "pointerdown" && !conversationMenuRef.current?.contains(event.target)) {
        setConversationMenuOpen(false);
      }
    }
    document.addEventListener("keydown", dismissMenu);
    document.addEventListener("pointerdown", dismissMenu);
    return () => {
      document.removeEventListener("keydown", dismissMenu);
      document.removeEventListener("pointerdown", dismissMenu);
    };
  }, [conversationMenuOpen]);

  useEffect(() => {
    if (!session || authStatus !== "ready") return undefined;
    let active = true;
    api("/groups", { token: session.token })
      .then(({ groups: loadedGroups }) => { if (active) setGroups(loadedGroups); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [session?.token, authStatus]);

  useEffect(() => {
    if (!session) {
      setNotifications([]);
      setNotificationUnreadCount(0);
      return undefined;
    }
    if (authStatus !== "ready") return undefined;
    let active = true;
    setLoadingNotifications(true);
    api("/notifications", { token: session.token })
      .then(({ notifications: loaded, unreadCount }) => {
        if (!active) return;
        setNotifications((current) => {
          const merged = new Map(loaded.map((item) => [item.id, item]));
          for (const item of current) if (!merged.has(item.id)) merged.set(item.id, item);
          return [...merged.values()].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
        });
        setNotificationUnreadCount(unreadCount);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingNotifications(false); });
    return () => { active = false; };
  }, [session?.token, authStatus]);

  useEffect(() => {
    if (!session || authStatus !== "ready") return undefined;
    let active = true;
    let sessionId = sessionStorage.getItem("ububiko-usage-session");
    let activityQueue = Promise.resolve();

    function ensureSessionId() {
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem("ububiko-usage-session", sessionId);
      }
      return sessionId;
    }

    function heartbeat() {
      if (document.visibilityState === "hidden") return;
      const currentSessionId = ensureSessionId();
      activityQueue = activityQueue
        .then(() => api("/activity/heartbeat", {
          token: session.token,
          method: "POST",
          body: JSON.stringify({ sessionId: currentSessionId }),
        }))
        .catch((requestError) => { if (active) setError(requestError.message); });
    }

    function endSession() {
      if (!sessionId) return;
      const endingId = sessionId;
      sessionId = null;
      sessionStorage.removeItem("ububiko-usage-session");
      activityQueue = activityQueue
        .then(() => api("/activity/end", {
          token: session.token,
          method: "POST",
          body: JSON.stringify({ sessionId: endingId }),
        }))
        .catch((requestError) => { if (active) setError(requestError.message); });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") endSession();
      else heartbeat();
    }

    heartbeat();
    const intervalId = window.setInterval(heartbeat, 30000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      endSession();
    };
  }, [session?.token, authStatus]);

  useEffect(() => {
    const activeSession = sessionRef.current;
    if (!activeSession || authStatus !== "ready") return undefined;
    const socket = io(API_URL, { auth: { token: activeSession.token }, autoConnect: false });
    let connectedOnce = false;
    setSocket(socket);
    socket.on("connect", () => {
      socket.emit("presence:list", (userIds) => {
        if (Array.isArray(userIds)) setOnlineUsers(new Set(userIds));
      });
      if (connectedOnce) {
        const groupId = selectedGroupIdRef.current;
        const personId = selectedIdRef.current;
        if (groupId) {
          api(`/groups/${groupId}/messages`, { token: activeSession.token })
            .then(({ messages: loaded }) => {
              setGroupMessages((current) => {
                const combined = new Map([
                  ...(current[groupId] || []).map((message) => [message.id, message]),
                  ...loaded.map((message) => [message.id, message]),
                ]);
                return {
                  ...current,
                  [groupId]: [...combined.values()].sort(
                    (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
                  ),
                };
              });
            })
            .catch((requestError) => setError(requestError.message));
        } else if (personId) {
          api(`/messages/${personId}`, { token: activeSession.token })
            .then(({ messages: loaded }) => {
              setMessages((current) => {
                if (selectedIdRef.current !== personId || selectedGroupIdRef.current) return current;
                const combined = new Map([...current, ...loaded].map((message) => [message.id, message]));
                return [...combined.values()].sort(
                  (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
                );
              });
            })
            .catch((requestError) => setError(requestError.message));
        }
      }
      connectedOnce = true;
    });
    socket.on("presence:update", ({ userId, online }) => {
      setOnlineUsers((current) => {
        const next = new Set(current);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });
    socket.on("message:new", (message) => {
      const currentUser = sessionRef.current?.user;
      if (!currentUser) return;
      const currentUserId = currentUser.id;
      const isParticipant = message.senderId === currentUserId || message.recipientId === currentUserId;
      if (!isParticipant) return;
      const otherUserId = message.senderId === currentUserId ? message.recipientId : message.senderId;
      setPeople((current) => updatePersonLastMessage(current, otherUserId, message.createdAt));
      if (otherUserId === selectedIdRef.current && !selectedGroupIdRef.current) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        if (message.recipientId === currentUserId) {
          markMessagesSeen(otherUserId);
        }
      } else if (message.recipientId === currentUserId) {
        setUnreadPeople((current) => ({ ...current, [message.senderId]: (current[message.senderId] || 0) + 1 }));
        const translatedTitle = languageRef.current === "rw" ? (kinyarwanda[message.type === "call" ? "Call history" : "New message"] || (message.type === "call" ? "Call history" : "New message")) : (message.type === "call" ? "Call history" : "New message");
        notifyMessage(translatedTitle, message.content);
      }
    });
    socket.on("message:updated", (message) => {
      setMessages((current) => current.map((item) => item.id === message.id ? message : item));
    });
    socket.on("message:deleted", ({ messageId }) => {
      setMessages((current) => current.filter((item) => item.id !== messageId));
    });
    socket.on("message:seen", ({ senderId, messageIds = [], seenAt, expiresAt }) => {
      const currentUser = sessionRef.current?.user;
      if (!messageIds.length || !currentUser || senderId !== currentUser.id) return;
      const seenTime = seenAt || new Date().toISOString();
      setMessages((current) => current.map((item) =>
        messageIds.includes(item.id) && item.senderId === currentUser.id
          ? { ...item, seenAt: seenTime, ...(expiresAt ? { expiresAt } : {}) }
          : item
      ));
    });
    socket.on("group:message:new", (message) => {
      if (message.groupId === selectedGroupIdRef.current) {
        setGroupMessages((current) => ({
          ...current,
          [message.groupId]: current[message.groupId]?.some((item) => item.id === message.id)
            ? current[message.groupId]
            : [...(current[message.groupId] || []), message],
        }));
      } else {
        setUnreadGroups((current) => ({ ...current, [message.groupId]: (current[message.groupId] || 0) + 1 }));
        const translatedTitle = languageRef.current === "rw" ? (kinyarwanda["Message from"] || "Message from") : "Message from";
        notifyMessage(`${translatedTitle} ${message.senderName}`, message.content);
      }
    });
    socket.on("group:message:updated", (message) => {
      setGroupMessages((current) => current[message.groupId]
        ? {
          ...current,
          [message.groupId]: current[message.groupId].map((item) => item.id === message.id ? message : item),
        }
        : current);
    });
    socket.on("group:message:deleted", ({ groupId, messageId }) => {
      setGroupMessages((current) => current[groupId]
        ? {
          ...current,
          [groupId]: current[groupId].filter((item) => item.id !== messageId),
        }
        : current);
    });
    socket.on("group:added", (group) => {
      setGroups((current) => current.some((item) => item.id === group.id)
        ? current.map((item) => item.id === group.id ? group : item)
        : [group, ...current]);
    });
    socket.on("group:updated", (group) => {
      setGroups((current) => current.map((item) => item.id === group.id ? group : item));
    });
    socket.on("connection:updated", () => {
      api("/users", { token: activeSession.token })
        .then(({ users }) => setPeople(users))
        .catch((requestError) => setError(requestError.message));
    });
    socket.on("notification:new", (notification) => {
      if (notificationsRef.current.some((item) => item.id === notification.id)) return;
      setNotifications((current) => [notification, ...current].slice(0, 100));
      setNotificationUnreadCount((current) => current + 1);
      notifyMessage(notification.title, notification.body);
    });
    socket.on("account:deleted", () => {
      setPeople([]);
      setGroups([]);
      setSession(null);
    });
    socket.on("connect_error", () => setError("Live connection lost. Please refresh to reconnect."));
    socket.connect();
    return () => {
      setSocket((current) => current === socket ? null : current);
      socket.disconnect();
    };
  }, [session?.token, authStatus]);

  useEffect(() => {
    if (authStatus !== "ready" || !session || !selectedId || !canOpenConversation) {
      setMessages([]);
      setLoadingMessages(false);
      return undefined;
    }
    let active = true;
    setMessages([]);
    setLoadingMessages(true);
    setError("");
    api(`/messages/${selectedId}`, { token: session.token })
      .then(({ messages: loaded, settings }) => {
        if (!active) return;
        setDeleteAfterSeen(Boolean(settings?.deleteAfterSeen));
        setMessages((current) => {
          const currentConversation = current.filter((message) =>
            (message.senderId === selectedId && message.recipientId === session.user.id) ||
            (message.senderId === session.user.id && message.recipientId === selectedId)
          );
          const uniqueMessages = new Map(
            [...loaded, ...currentConversation].map((message) => [message.id, message])
          );
          const nextMessages = [...uniqueMessages.values()].sort(
            (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
          );
          return nextMessages;
        });
        markMessagesSeen(selectedId);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingMessages(false); });
    return () => { active = false; };
  }, [authStatus, session, selectedId, canOpenConversation]);

  useEffect(() => {
    const expiring = messages.filter((message) => message.expiresAt);
    if (!expiring.length) return undefined;
    const nextExpiry = Math.max(0, Math.min(...expiring.map((message) => new Date(message.expiresAt).getTime())) - Date.now());
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setMessages((current) => current.filter((message) => !message.expiresAt || new Date(message.expiresAt).getTime() > now));
    }, nextExpiry + 50);
    return () => window.clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people
      .filter((person) => !query || person.username?.toLowerCase().includes(query))
      .sort((first, second) => {
        if (first.isFavorite !== second.isFavorite) return first.isFavorite ? -1 : 1;
        const firstTime = first.lastMessageAt ? new Date(first.lastMessageAt).getTime() : 0;
        const secondTime = second.lastMessageAt ? new Date(second.lastMessageAt).getTime() : 0;
        return secondTime - firstTime || first.name.localeCompare(second.name);
      });
  }, [people, search]);
  const favoritePeople = filteredPeople.filter((person) => person.isFavorite);
  const otherPeople = filteredPeople.filter((person) => !person.isFavorite);

  async function toggleFavorite(person) {
    if (favoriteBusyId) return;
    const isFavorite = !person.isFavorite;
    setFavoriteBusyId(person.id);
    setError("");
    try {
      await api(`/users/${person.id}/favorite`, {
        token: session.token,
        method: "PATCH",
        body: JSON.stringify({ isFavorite }),
      });
      setPeople((current) => current.map((item) => item.id === person.id ? { ...item, isFavorite } : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setFavoriteBusyId("");
    }
  }

  function renderPersonRow(person) {
    return <div key={person.id} className="person-row-shell">
      <button className={`person-row ${person.id === selectedId ? "selected" : ""}`} onClick={() => {
        setAdminView(false);
        setSelectedGroupId(null);
        setSelectedId(person.id);
        setUnreadPeople((current) => ({ ...current, [person.id]: 0 }));
        setMobileChat(true);
        setError("");
      }}>
        <Avatar name={person.name} size="normal" online={onlineUsers.has(person.id)} />
        <span className="person-info"><span className="person-name">{person.name}</span><span className={`person-preview ${person.connectionStatus === "received" ? "connection-preview" : ""}`}>{person.connectionStatus === "received" ? t("Connection request") : person.connectionStatus === "sent" ? t("Request sent") : person.messagingEnabled === false ? t("Messaging disabled") : person.isPrivate ? `${t("Private account")} · @${person.username}` : `@${person.username}`}</span></span>
        {unreadPeople[person.id] > 0 && <span className="unread-badge">{unreadPeople[person.id]}</span>}
        {person.lastMessageAt && <span className="person-time">{formatTime(person.lastMessageAt)}</span>}
      </button>
      <button
        type="button"
        className={`favorite-toggle ${person.isFavorite ? "is-favorite" : ""}`}
        disabled={favoriteBusyId === person.id}
        onClick={() => toggleFavorite(person)}
        aria-label={t(person.isFavorite ? "Remove from favorites" : "Add to favorites")}
        aria-pressed={person.isFavorite}
        title={t(person.isFavorite ? "Remove from favorites" : "Add to favorites")}
      ><Star size={15} fill={person.isFavorite ? "currentColor" : "none"} /></button>
    </div>;
  }

  function signOut() {
    setSession(null);
    setPeople([]);
    setGroups([]);
    setMessages([]);
    setSelectedId(null);
    setSelectedGroupId(null);
    setAdminView(false);
    setNotificationOpen(false);
    setNotifications([]);
    setNotificationUnreadCount(0);
    setError("");
  }

  function handleAuthenticated(nextSession) {
    setSession(nextSession);
    setAuthStatus("ready");
    setAdminView(nextSession.user.isAdmin === true);
  }

  async function markMessagesSeen(personId) {
    const activeSession = sessionRef.current;
    if (!activeSession || !personId) return false;
    try {
      const { messageIds, seenAt: markedAt, expiresAt } = await api(`/messages/${personId}/seen`, {
        token: activeSession.token,
        method: "PATCH",
      });
      if (!messageIds?.length) return false;
      const seenAt = markedAt || new Date().toISOString();
      setMessages((current) => current.map((message) =>
        message.senderId === personId && message.recipientId === activeSession.user.id && !message.seenAt && messageIds.includes(message.id)
          ? { ...message, seenAt, ...(expiresAt ? { expiresAt } : {}) }
          : message
      ));
      return true;
    } catch (requestError) {
      if (requestError.status !== 404) setError(requestError.message);
      return false;
    }
  }

  function updateManagedUser(updatedUser) {
    setPeople((current) => current.map((person) =>
      person.id === updatedUser.id
        ? { ...person, messagingEnabled: updatedUser.messagingEnabled }
        : person
    ));
    if (updatedUser.id === session.user.id) {
      setSession((current) => current
        ? { ...current, user: { ...current.user, messagingEnabled: updatedUser.messagingEnabled } }
        : current
      );
    }
  }

  function removeManagedUser(userId) {
    setPeople((current) => current.filter((person) => person.id !== userId));
    if (selectedId === userId) {
      setSelectedId(null);
      setMessages([]);
    }
  }

  async function markNotificationRead(notification) {
    if (notification.readAt) return;
    await api(`/notifications/${notification.id}/read`, {
      token: session.token,
      method: "PATCH",
    });
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt } : item));
    setNotificationUnreadCount((current) => Math.max(0, current - 1));
  }

  async function markAllNotificationsRead() {
    try {
      await api("/notifications/read-all", { token: session.token, method: "PATCH" });
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
      setNotificationUnreadCount(0);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function openNotification(notification) {
    try {
      await markNotificationRead(notification);
      setNotificationOpen(false);
      if (notification.targetType === "announcement") return;
      setAdminView(false);
      setError("");
      if (notification.targetType === "group") {
        let targetGroup = groups.find((group) => group.id === notification.targetId);
        if (!targetGroup) {
          const { groups: loadedGroups } = await api("/groups", { token: session.token });
          setGroups(loadedGroups);
          targetGroup = loadedGroups.find((group) => group.id === notification.targetId);
        }
        if (!targetGroup) {
          setError("That group is no longer available.");
          return;
        }
        setSelectedId(null);
        setSelectedGroupId(targetGroup.id);
        setMobileChat(true);
        return;
      }

      let targetPerson = people.find((person) => person.id === notification.targetId);
      if (!targetPerson) {
        const { users: loadedUsers } = await api("/users", { token: session.token });
        setPeople(loadedUsers);
        targetPerson = loadedUsers.find((person) => person.id === notification.targetId);
      }
      if (!targetPerson) {
        setError("That account is no longer available.");
        return;
      }
      setSelectedGroupId(null);
      setSelectedId(targetPerson.id);
      setMobileChat(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function addByPrivateId(event) {
    event.preventDefault();
    if (!/^\d{5}$/.test(privateId) || lookingUpPrivate) return;
    setLookingUpPrivate(true);
    setError("");
    try {
      const { user } = await api("/users/private", {
        token: session.token,
        method: "POST",
        body: JSON.stringify({ userCode: privateId }),
      });
      setPeople((current) => current.some((person) => person.id === user.id)
        ? current.map((person) => person.id === user.id ? user : person)
        : [...current, user]);
      setSelectedId(user.id);
      setSelectedGroupId(null);
      setPrivateId("");
      setSearch("");
      setAdminView(false);
      setMobileChat(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLookingUpPrivate(false);
    }
  }

  async function requestConnection(person) {
    setConnectionBusy(true);
    setError("");
    try {
      const { user } = await api(`/users/${person.id}/connect`, {
        token: session.token,
        method: "POST",
      });
      setPeople((current) => current.map((item) => item.id === user.id ? user : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConnectionBusy(false);
    }
  }

  async function updateConnection(action) {
    if (!selectedPerson?.connectionId || connectionBusy) return;
    setConnectionBusy(true);
    setError("");
    try {
      await api(`/users/connections/${selectedPerson.connectionId}${action === "accept" ? "/accept" : ""}`, {
        token: session.token,
        method: action === "accept" ? "POST" : "DELETE",
      });
      const { users } = await api("/users", { token: session.token });
      setPeople(users);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConnectionBusy(false);
    }
  }

  async function togglePrivacy() {
    setUpdatingPrivacy(true);
    setError("");
    try {
      const { user } = await api("/auth/profile", {
        token: session.token,
        method: "PATCH",
        body: JSON.stringify({ isPrivate: !session.user.isPrivate }),
      });
      setSession((current) => current?.token === session.token ? { ...current, user } : current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingPrivacy(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || sending) return;
    setSending(true);
    setError("");
    try {
      const { message } = await api("/messages", {
        token: session.token,
        method: "POST",
        body: JSON.stringify({
          recipientId: selectedId,
          content,
          ...(replyTarget ? { replyTo: { messageId: replyTarget.id, sourceType: replyTarget.sourceType } } : {}),
        }),
      });
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setPeople((current) => updatePersonLastMessage(current, selectedId, message.createdAt));
      setDraft("");
      setReplyTarget(null);
      if (inputRef.current) inputRef.current.style.height = "auto";
      inputRef.current?.focus();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  async function forwardToPerson(person) {
    if (!forwardTarget || forwardBusy) return;
    setForwardBusy(true);
    setForwardError("");
    try {
      const { message } = await api("/messages", {
        token: session.token,
        method: "POST",
        body: JSON.stringify({
          recipientId: person.id,
          content: forwardTarget.content,
          forwardedFrom: { messageId: forwardTarget.id, sourceType: forwardTarget.sourceType },
        }),
      });
      setPeople((current) => updatePersonLastMessage(current, person.id, message.createdAt));
      if (selectedIdRef.current === person.id && !selectedGroupIdRef.current) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      }
      setForwardTarget(null);
    } catch (requestError) {
      setForwardError(requestError.message);
    } finally {
      setForwardBusy(false);
    }
  }

  async function forwardToGroup(group) {
    if (!forwardTarget || forwardBusy) return;
    setForwardBusy(true);
    setForwardError("");
    try {
      const { message } = await api(`/groups/${group.id}/messages`, {
        token: session.token,
        method: "POST",
        body: JSON.stringify({
          content: forwardTarget.content,
          forwardedFrom: { messageId: forwardTarget.id, sourceType: forwardTarget.sourceType },
        }),
      });
      groupMessageAdded(message);
      setForwardTarget(null);
    } catch (requestError) {
      setForwardError(requestError.message);
    } finally {
      setForwardBusy(false);
    }
  }

  async function editDirectMessage(messageId, content) {
    setError("");
    try {
      const { message } = await api(`/messages/${messageId}`, {
        token: session.token,
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      setMessages((current) => current.map((item) => item.id === message.id ? message : item));
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function deleteDirectMessage(messageId) {
    setError("");
    try {
      await api(`/messages/${messageId}`, { token: session.token, method: "DELETE" });
      setMessages((current) => current.filter((item) => item.id !== messageId));
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function clearConversation() {
    if (!selectedPerson || conversationActionBusy) return;
    if (!window.confirm(t("Clear this conversation from your view? Messages will remain visible to the other person."))) return;
    setConversationActionBusy(true);
    setError("");
    try {
      await api(`/messages/${selectedPerson.id}/clear`, { token: session.token, method: "DELETE" });
      setMessages([]);
      setPeople((current) => current.map((person) => person.id === selectedPerson.id
        ? { ...person, lastMessageAt: null }
        : person));
      setConversationSearch("");
      setConversationMenuOpen(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConversationActionBusy(false);
    }
  }

  async function toggleDeleteAfterSeen() {
    if (!selectedPerson || conversationActionBusy) return;
    setConversationActionBusy(true);
    setError("");
    try {
      const { deleteAfterSeen: enabled } = await api(`/messages/${selectedPerson.id}/settings`, {
        token: session.token,
        method: "PATCH",
        body: JSON.stringify({ deleteAfterSeen: !deleteAfterSeen }),
      });
      setDeleteAfterSeen(enabled);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConversationActionBusy(false);
    }
  }

  async function togglePersonBlock() {
    if (!selectedPerson || conversationActionBusy) return;
    if (!selectedPerson.isBlocked && !window.confirm(t("Block this person? They will not be able to message you or send a connection request."))) return;
    setConversationActionBusy(true);
    setError("");
    try {
      await api(`/users/${selectedPerson.id}/block`, {
        token: session.token,
        method: selectedPerson.isBlocked ? "DELETE" : "POST",
      });
      const { users: loadedUsers } = await api("/users", { token: session.token });
      setPeople(loadedUsers);
      setConversationMenuOpen(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setConversationActionBusy(false);
    }
  }

  const canMessage = session?.user.messagingEnabled !== false && selectedPerson?.messagingEnabled !== false;
  const notifyMessage = (title, body) => {
    if (notificationsEnabledRef.current && document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  async function toggleNotifications() {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem("ububiko-notifications", "false");
      return;
    }
    if (!("Notification" in window)) {
      setError("This browser does not support desktop notifications.");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      setError("Allow notifications in your browser settings to turn them on.");
      return;
    }
    setNotificationsEnabled(true);
    localStorage.setItem("ububiko-notifications", "true");
  }

  function toggleDarkMode() {
    setDarkMode((current) => {
      localStorage.setItem("ububiko-dark-mode", String(!current));
      return !current;
    });
  }

  async function createGroup(event) {
    event.preventDefault();
    setCreatingGroup(true);
    setError("");
    try {
      const { group } = await api("/groups", {
        token: session.token,
        method: "POST",
        body: JSON.stringify({ name: groupName }),
      });
      setGroups((current) => [group, ...current]);
      setGroupMessages((current) => ({ ...current, [group.id]: [] }));
      setSelectedId(null);
      setSelectedGroupId(group.id);
      setGroupName("");
      setCreateGroupOpen(false);
      setMobileChat(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreatingGroup(false);
    }
  }

  function updateGroup(updatedGroup) {
    setGroups((current) => current.some((group) => group.id === updatedGroup.id)
      ? current.map((group) => group.id === updatedGroup.id ? updatedGroup : group)
      : [updatedGroup, ...current]);
  }

  function groupMessageAdded(message) {
    setGroupMessages((current) => ({
      ...current,
      [message.groupId]: current[message.groupId]?.some((item) => item.id === message.id)
        ? current[message.groupId]
        : [...(current[message.groupId] || []), message],
    }));
  }

  function groupMessageUpdated(message) {
    setGroupMessages((current) => current[message.groupId]
      ? {
        ...current,
        [message.groupId]: current[message.groupId].map((item) => item.id === message.id ? message : item),
      }
      : current);
  }

  function groupMessageDeleted(groupId, messageId) {
    setGroupMessages((current) => current[groupId]
      ? { ...current, [groupId]: current[groupId].filter((item) => item.id !== messageId) }
      : current);
  }

  if (session && authStatus !== "ready") return <LanguageContext.Provider value={language}>
    <main className="auth-page auth-session-check">
      {authStatus === "checking" ? <div className="session-check-status"><span className="send-loading" /> {t("Checking your session…")}</div> : <section className="profile-setup">
        <span className="welcome-tag">{t("YOUR SPACE, YOUR PEOPLE")}</span>
        <h1>{t("Unable to verify your session")}</h1>
        <p>{authError}</p>
        <button className="primary-button auth-check-retry" type="button" onClick={() => setAuthCheckAttempt((current) => current + 1)}>{t("Try again")}</button>
        <button className="setup-signout" type="button" onClick={signOut}>{t("Return to sign in")}</button>
      </section>}
    </main>
  </LanguageContext.Provider>;
  if (!session) return <LanguageContext.Provider value={language}><AuthScreen onAuthenticated={handleAuthenticated} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} /></LanguageContext.Provider>;
  if (Number.isInteger(session.user.age) && session.user.age < 15) {
    return <LanguageContext.Provider value={language}><main className="age-blocked"><ThemeToggle darkMode={darkMode} onToggle={toggleDarkMode} /><h1>{t("Ububiko is for ages 15 and older")}</h1><p>{t("This account cannot use the app.")}</p><button className="primary-button" onClick={signOut}>{t("Sign out")}</button></main></LanguageContext.Provider>;
  }
  if (!session.user.username || !Number.isInteger(session.user.age) || !session.user.userCode) {
    return <LanguageContext.Provider value={language}><CompleteProfile session={session} onCompleted={setSession} onSignOut={signOut} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} /></LanguageContext.Provider>;
  }

  return (
    <LanguageContext.Provider value={language}>
    <main className={`app-shell ${mobileChat ? "mobile-chat-open" : ""} ${darkMode ? "dark-mode" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <a className="app-brand" href="#" onClick={(event) => event.preventDefault()}><span className="brand-mark"><MessageCircle size={19} fill="currentColor" /></span><span>ububiko<small>YOUR LITTLE CORNER</small></span></a>
          <div className="sidebar-top-actions">
            <button className="icon-button notification-trigger" type="button" onClick={() => setNotificationOpen((current) => !current)} aria-label={`${t("Notifications")}${notificationUnreadCount ? ` (${notificationUnreadCount})` : ""}`} title={t("Notifications")}>
              <Bell size={18} />
              {notificationUnreadCount > 0 && <span className="notification-badge">{notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}</span>}
            </button>
            <button className="icon-button sidebar-profile-button" onClick={() => setProfileOpen(true)} aria-label={t("Open my profile and settings")} title={t("My profile")}><UserRound size={19} /><span>{t("Profile")}</span></button>
          </div>
        </div>
        {notificationOpen && <NotificationInbox
          notifications={notifications}
          unreadCount={notificationUnreadCount}
          loading={loadingNotifications}
          onClose={() => setNotificationOpen(false)}
          onSelect={openNotification}
          onMarkAllRead={markAllNotificationsRead}
        />}
        <div className="sidebar-heading"><div><span className="section-label">{t("YOUR COMMUNITY")}</span><h1>{t("Messages")} <span>{people.length}</span></h1></div><button className="icon-button add-person" aria-label={t("Find someone")} onClick={() => document.querySelector(".search-input")?.focus()}><UsersRound size={17} /></button></div>
        <div className="search-box"><Search size={16} /><input className="search-input" placeholder={t("Search by username…")} value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div>
        <form className="private-id-search" onSubmit={addByPrivateId}>
          <label htmlFor="private-user-id">{t("Request connection with private ID")}</label>
          <div><input id="private-user-id" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={privateId} onChange={(event) => setPrivateId(event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder={t("Enter 5-digit ID")} required /><button type="submit" disabled={privateId.length !== 5 || lookingUpPrivate}>{lookingUpPrivate ? t("Adding…") : t("Request connection")}</button></div>
        </form>
        {session.user.isAdmin && <button className={`admin-nav ${adminView ? "active" : ""}`} onClick={() => { setAdminView(true); setMobileChat(false); setSelectedId(null); setError(""); }}><ShieldCheck size={16} /> {t("Admin dashboard")} <span>{t("Manage access")}</span></button>}
        <div className="people-label"><span>{t("GROUPS")}</span><button className="group-create-button" aria-label={t("Create group")} onClick={() => setCreateGroupOpen(true)}><UsersRound size={14} /><span>{t("New")}</span></button></div>
        <div className="people-list">
          {groups.map((group) => <button key={group.id} className={`person-row group-list-row ${group.id === selectedGroupId ? "selected" : ""}`} onClick={() => {
            setAdminView(false);
            setSelectedId(null);
            setSelectedGroupId(group.id);
            setUnreadGroups((current) => ({ ...current, [group.id]: 0 }));
            setMobileChat(true);
            setError("");
          }}>
            <span className="group-list-icon"><UsersRound size={16} /></span>
            <span className="person-info"><span className="person-name">{group.name}</span><span className="person-preview">{t("Private group")}</span></span>
            {unreadGroups[group.id] > 0 && <span className="unread-badge">{unreadGroups[group.id]}</span>}
          </button>)}
          {loadingPeople ? <><div className="people-label people-subheading"><span>{t("PEOPLE")}</span></div><div className="list-state">{t("Finding your people…")}</div></> : filteredPeople.length ? <>
            {favoritePeople.length > 0 && <>
              <div className="people-label people-subheading"><span>{t("FAVORITES")}</span></div>
              {favoritePeople.map(renderPersonRow)}
            </>}
            <div className="people-label people-subheading"><span>{t("PEOPLE")}</span></div>
            {otherPeople.map(renderPersonRow)}
          </> : <div className="empty-people"><span className="empty-icon"><UsersRound size={20} /></span><strong>{t(search ? "No one found" : "Your circle starts here")}</strong><p>{t(search ? "Search again by username." : "Search by username to find any account.")}</p></div>}
        </div>
        <div className="sidebar-bottom">
          <button className="signout-button" onClick={signOut}><LogOut size={15} /> {t("Sign out")}</button>
        </div>
      </aside>
      <section className="conversation">
        {adminView && session.user.isAdmin ? <AdminDashboard session={session} onUserUpdated={updateManagedUser} onUserDeleted={removeManagedUser} /> : selectedGroup ? <GroupChatPanel
          group={selectedGroup}
          session={session}
          messages={groupMessages[selectedGroup.id] || []}
          onMessagesLoaded={(groupId, loaded) => setGroupMessages((current) => {
            const combined = new Map([...(current[groupId] || []), ...loaded].map((message) => [message.id, message]));
            return { ...current, [groupId]: [...combined.values()].sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt)) };
          })}
          onMessage={groupMessageAdded}
          onMessageUpdated={groupMessageUpdated}
          onMessageDeleted={groupMessageDeleted}
          onGroupUpdated={updateGroup}
          onGoBack={() => setMobileChat(false)}
          onOpenProfile={() => setProfileOpen(true)}
          onForward={(message) => { setForwardTarget(message); setForwardError(""); }}
        /> : !selectedPerson ? <WelcomePanel user={session.user} people={people}  /> : <>
          <header className="chat-header">
            <button className="icon-button back-button" aria-label="Back to people" onClick={() => setMobileChat(false)}><ArrowLeft size={19} /></button>
            <Avatar name={selectedPerson.name} online={onlineUsers.has(selectedPerson.id)} />
            <div className="chat-person"><h2>{selectedPerson.name}</h2><span>{onlineUsers.has(selectedPerson.id) && <><i className="status-dot" /> {t("Active now")} · </>}{selectedPerson.isPrivate ? <><LockKeyhole size={12} /> {t("Private account")} · @{selectedPerson.username}</> : `@${selectedPerson.username}`}</span></div>
            <div className="chat-actions">
              {selectedPerson.connectionStatus === "connected" && session.user.messagingEnabled !== false && selectedPerson.messagingEnabled !== false && <>
                <button className="icon-button call-action-button" type="button" disabled={!!callManager.call || !socket?.connected} onClick={() => callManager.startCall(selectedPerson, false)} aria-label={`Start audio call with ${selectedPerson.name}`} title="Audio call"><Phone size={17} /></button>
                <button className="icon-button call-action-button" type="button" disabled={!!callManager.call || !socket?.connected} onClick={() => callManager.startCall(selectedPerson, true)} aria-label={`Start video call with ${selectedPerson.name}`} title="Video call"><Video size={18} /></button>
              </>}
              <button className={`icon-button ${conversationSearchOpen ? "active" : ""}`} type="button" disabled={!canOpenConversation} onClick={() => {
                if (conversationSearchOpen) setConversationSearch("");
                setConversationSearchOpen(!conversationSearchOpen);
              }} aria-label={t("Search conversation")} title={t("Search messages")}><Search size={18} /></button>
              <div className="conversation-menu-wrap" ref={conversationMenuRef}>
                <button className={`icon-button ${conversationMenuOpen ? "active" : ""}`} type="button" onClick={() => setConversationMenuOpen((open) => !open)} aria-label={t("Conversation options")} aria-expanded={conversationMenuOpen}><MoreHorizontal size={20} /></button>
                {conversationMenuOpen && <div className="conversation-menu" role="menu">
                  <button type="button" role="menuitem" disabled={conversationActionBusy} onClick={toggleDeleteAfterSeen} aria-pressed={deleteAfterSeen}>
                    <Clock3 size={15} />{t(deleteAfterSeen ? "Delete seen messages after 1 day: On" : "Delete seen messages after 1 day: Off")}
                  </button>
                  <button type="button" role="menuitem" disabled={conversationActionBusy} onClick={clearConversation}><Trash2 size={15} />{t("Delete conversation")}</button>
                  <button type="button" role="menuitem" className={selectedPerson.isBlocked ? "" : "danger-menu-item"} disabled={conversationActionBusy} onClick={togglePersonBlock}>
                    <Ban size={15} />{t(selectedPerson.isBlocked ? "Unblock person" : "Block person")}
                  </button>
                </div>}
              </div>
              <button className="icon-button profile-quick-button" type="button" onClick={() => setProfileOpen(true)} aria-label={t("Open my profile")} title={t("My profile")}><UserRound size={18} /><span>{t("Profile")}</span></button>
            </div>
          </header>
          {conversationSearchOpen && canOpenConversation && <div className="conversation-search-bar">
            <Search size={15} />
            <input ref={conversationSearchInputRef} value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Escape") {
                setConversationSearch("");
                setConversationSearchOpen(false);
              }
            }} placeholder={t("Search messages in this chat")} aria-label={t("Search messages in this chat")} />
            {conversationSearch && <span className="search-result-count">{visibleMessages.length} {t("messages")}</span>}
            <button type="button" onClick={() => { setConversationSearch(""); setConversationSearchOpen(false); }} aria-label={t("Close search")}><X size={15} /></button>
          </div>}
          {selectedPerson.isBlocked ? <div className="connection-gate">
            <span className="welcome-icon"><Ban size={24} /></span>
            <h3>{t("This person is blocked.")}</h3>
            <p>{t("This person is blocked. Unblock them to send a connection request.")}</p>
            <button className="primary-button" type="button" disabled={conversationActionBusy} onClick={togglePersonBlock}>{conversationActionBusy ? t("Working…") : t("Unblock person")}</button>
          </div> : selectedPerson.isPrivate && selectedPerson.connectionStatus !== "connected" ? <div className="connection-gate">
            <span className="welcome-icon"><LockKeyhole size={24} /></span>
            {error && <div className="form-error" role="alert">{error}</div>}
            {selectedPerson.connectionStatus === "received" ? <>
              <h3>{selectedPerson.name} {t("wants to connect with you.")}</h3>
              <p>{t("Accepting lets you exchange private messages.")}</p>
              <div className="connection-actions">
                <button className="primary-button" type="button" disabled={connectionBusy} onClick={() => updateConnection("accept")}>{connectionBusy ? t("Working…") : t("Accept connection")}</button>
                <button className="connection-secondary" type="button" disabled={connectionBusy} onClick={() => updateConnection("decline")}>{t("Decline")}</button>
              </div>
            </> : selectedPerson.connectionStatus === "sent" ? <>
              <h3>{t("Connect before chatting")}</h3>
              <p>{t("Connection request sent. You can chat after they accept.")}</p>
              <button className="connection-secondary" type="button" disabled={connectionBusy} onClick={() => updateConnection("cancel")}>{t("Cancel request")}</button>
            </> : <>
              <h3>{t("Connect before chatting")}</h3>
              <p>{t("Send a connection request to start a private conversation.")}</p>
              <button className="primary-button" type="button" disabled={connectionBusy} onClick={() => requestConnection(selectedPerson)}>{connectionBusy ? t("Working…") : t("Request connection")}</button>
            </>}
          </div> : <>
            <div className="messages-area">
              <div className="conversation-intro"><div className="intro-avatar"><Avatar name={selectedPerson.name} size="large" /></div><h3>{selectedPerson.name}</h3><span>@{selectedPerson.username}</span><p>{t("This is the beginning of your conversation.")}</p></div>
              {loadingMessages ? <div className="message-loading">{t("Opening your conversation…")}</div> : visibleMessages.length === 0 && conversationSearch ? <div className="message-loading">{t("No messages match your search.")}</div> : visibleMessages.map((message, index) => {
                const own = message.senderId === session.user.id;
                const previous = visibleMessages[index - 1];
                const showDate = !previous || new Date(message.createdAt).toDateString() !== new Date(previous.createdAt).toDateString();
                return <div key={message.id}>{showDate && <div className="date-divider"><span>{formatDay(message.createdAt)}</span></div>}<MessageItem
                  message={message}
                  own={own}
                  avatarName={selectedPerson.name}
                  senderName={own ? session.user.name : selectedPerson.name}
                  sourceType="direct"
                  onEdit={editDirectMessage}
                  onDelete={deleteDirectMessage}
                  onReply={setReplyTarget}
                  onForward={(item) => { setForwardTarget(item); setForwardError(""); }}
                /></div>;
              })}
              <div ref={messageEndRef} />
            </div>
            {error && <div className="inline-error" role="alert">{error}<button onClick={() => setError("")} aria-label={t("Dismiss error")}><X size={14} /></button></div>}
            {canMessage ? <div className="composer-wrap">
              {replyTarget && <div className="reply-composer-preview"><span><strong>{t("Replying to")} {replyTarget.senderName}</strong><small>{replyTarget.content}</small></span><button type="button" onClick={() => setReplyTarget(null)} aria-label={t("Cancel reply")}><X size={15} /></button></div>}
              <form className="composer" onSubmit={sendMessage}><EmojiPicker value={draft} onChange={setDraft} textareaRef={inputRef} /><textarea ref={inputRef} value={draft} onChange={(event) => { setDraft(event.target.value); event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`${t("Write a message to")} ${selectedPerson.name.split(/\s+/)[0]}…`} maxLength={4000} rows={1} /><button type="submit" className="send-button" disabled={!draft.trim() || sending} aria-label={t("Send message")}>{sending ? <span className="send-loading" /> : <Send size={17} />}</button></form><div className="composer-hint"><span>{t("Keep it kind. Keep it you.")}</span><span><kbd>Enter</kbd> {t("to send")} <span className="hint-dot">·</span> <kbd>Shift + Enter</kbd> {t("for a new line")}</span></div>
            </div> : <div className="messaging-disabled"><ShieldOff size={17} /><span>{session.user.messagingEnabled === false ? t("Messaging disabled for your account.") : <>{selectedPerson.name} {t("is not accepting messages right now.")}</>}</span></div>}
          </>}
        </>}
      </section>
      <div className="toast-area" aria-live="polite">{!selectedPerson && !selectedGroup && error && <div className="toast-error">{error}<button onClick={() => setError("")}><X size={14} /></button></div>}</div>
      <CallOverlay
        call={callManager.call}
        localStream={callManager.localStream}
        remoteStream={callManager.remoteStream}
        muted={callManager.muted}
        cameraEnabled={callManager.cameraEnabled}
        quality={callManager.quality}
        callError={callManager.callError}
        onAnswer={callManager.answerCall}
        onReject={callManager.rejectCall}
        onEnd={callManager.endCall}
        onToggleMute={callManager.toggleMute}
        onToggleCamera={callManager.toggleCamera}
        onDismissError={callManager.clearCallError}
      />
      {profileOpen && <ProfileSettings
        session={session}
        connectedPeopleCount={connectedPeopleCount}
        onClose={() => setProfileOpen(false)}
        onUpdated={(updatedSession) => setSession(updatedSession)}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={toggleNotifications}
        onTogglePrivacy={togglePrivacy}
        updatingPrivacy={updatingPrivacy}
        language={language}
        onLanguageChange={setLanguage}
      />}
      {createGroupOpen && <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateGroupOpen(false); }}>
        <section className="create-group-dialog" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
          <header className="settings-header"><div><span className="welcome-tag">{t("YOUR COMMUNITY")}</span><h2 id="create-group-title">{t("Create a group")}</h2></div><button className="icon-button" onClick={() => setCreateGroupOpen(false)} aria-label={t("Close create group")}><X size={19} /></button></header>
          <form className="profile-edit-form" onSubmit={createGroup}>
            <label>{t("Group name")}<input value={groupName} onChange={(event) => setGroupName(event.target.value)} minLength={2} maxLength={80} required placeholder={t("e.g. Weekend plans")} /></label>
            <p className="group-privacy-note">{t("Only members can find and open this group. Only you can add members.")}</p>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button profile-save" disabled={creatingGroup}>{creatingGroup ? t("Creating…") : t("Create group")}</button>
          </form>
        </section>
      </div>}
      {forwardTarget && <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !forwardBusy) setForwardTarget(null); }}>
        <section className="forward-dialog" role="dialog" aria-modal="true" aria-labelledby="forward-title">
          <header className="settings-header"><div><span className="welcome-tag">{t("SHARE A MESSAGE")}</span><h2 id="forward-title">{t("Forward message")}</h2></div><button className="icon-button" disabled={forwardBusy} onClick={() => setForwardTarget(null)} aria-label={t("Cancel")}><X size={19} /></button></header>
          <div className="forward-message-preview"><strong>{t("Forwarded from")} {forwardTarget.senderName || (forwardTarget.senderId === session.user.id ? session.user.name : selectedPerson?.name || t("a group member"))}</strong><p>{forwardTarget.content}</p></div>
          <h3>{t("Choose a conversation")}</h3>
          {forwardError && <div className="form-error" role="alert">{forwardError}</div>}
          <div className="forward-people-list">
            {forwardablePeople.length > 0 && <small className="forward-section-title">{t("People")}</small>}
            {forwardablePeople.map((person) => <button key={person.id} type="button" disabled={forwardBusy || session.user.messagingEnabled === false || person.messagingEnabled === false} onClick={() => forwardToPerson(person)}>
              <Avatar name={person.name} size="tiny" /><span>{person.name}</span>{forwardBusy ? <span className="toggle-spinner" /> : <Forward size={15} />}
            </button>)}
            {groups.length > 0 && <small className="forward-section-title">{t("Groups")}</small>}
            {groups.map((group) => <button key={group.id} type="button" disabled={forwardBusy || session.user.messagingEnabled === false} onClick={() => forwardToGroup(group)}>
              <span className="group-list-icon"><UsersRound size={15} /></span><span>{group.name}</span>{forwardBusy ? <span className="toggle-spinner" /> : <Forward size={15} />}
            </button>)}
            {!forwardablePeople.length && !groups.length && <p>{t("No conversations available to forward to.")}</p>}
          </div>
        </section>
      </div>}
    </main>
    </LanguageContext.Provider>
  );
}
