import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  ArrowUp,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  LogOut,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShieldOff,
  Smile,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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
    throw new Error(data.message || "We couldn't complete that request.");
  }
  return data;
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

function Avatar({ name, size = "normal", online = false }) {
  return (
    <div className={`avatar avatar-${size}`} aria-label={name}>
      <span>{getInitials(name)}</span>
      {online && <i className="online-dot" />}
    </div>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
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
        body: JSON.stringify({ ...(mode === "register" ? { name } : {}), email, password }),
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
      <div className="auth-art">
        <div className="art-glow" />
        <div className="auth-brand"><span className="brand-mark"><MessageCircle size={21} fill="currentColor" /></span> ububiko</div>
        <div className="art-copy">
          <div className="eyebrow"><Sparkles size={14} /> A little closer, every day</div>
          <h1>Good conversations<br />stay with you.</h1>
          <p>A calm, thoughtful space to catch up with your people — wherever life takes you.</p>
        </div>
        <div className="art-note"><span className="note-avatars"><i>J</i><i>A</i><i>M</i></span><span>Made for the people who matter.</span></div>
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
      </div>
      <section className="auth-panel">
        <div className="auth-mobile-brand"><span className="brand-mark"><MessageCircle size={18} fill="currentColor" /></span> ububiko</div>
        <div className="auth-form-wrap">
          <span className="welcome-tag">YOUR SPACE, YOUR PEOPLE</span>
          <h2>{mode === "login" ? "Welcome back" : "Find your people"}</h2>
          <p className="auth-subtitle">{mode === "login" ? "Pick up right where you left off." : "Create an account and start a conversation."}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && <label>Your name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" required minLength={2} maxLength={60} /></label>}
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button auth-submit" disabled={loading}>{loading ? "One moment…" : mode === "login" ? "Sign in" : "Create account"} <ArrowUp size={16} className="button-arrow" /></button>
          </form>
          <div className="auth-switch">{mode === "login" ? "New to Ububiko?" : "Already have an account?"} <button onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}> {mode === "login" ? "Create an account" : "Sign in"}</button></div>
        </div>
        <div className="auth-footer"><span><i /> Your conversations are private</span><button aria-label="Help"><CircleHelp size={17} /></button></div>
      </section>
    </main>
  );
}

function WelcomePanel({ user, people }) {
  const firstName = user.name.split(/\s+/)[0];
  return (
    <div className="welcome-panel">
      <div className="welcome-decor decor-a" /><div className="welcome-decor decor-b" />
      <div className="welcome-center">
        <div className="welcome-icon"><MessageCircle size={27} /></div>
        <span className="welcome-tag">A GOOD PLACE TO BEGIN</span>
        <h2>Hey, {firstName}.</h2>
        <p>Every good conversation starts with a hello.<br />Choose someone on the left and say yours.</p>
        <div className="people-count"><UsersRound size={15} /> {people.length} {people.length === 1 ? "person" : "people"} in your community</div>
      </div>
      <div className="welcome-bottom"><span>Small moments make lasting connections.</span><Sparkles size={15} /></div>
    </div>
  );
}

function AdminDashboard({ session, onUserUpdated }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const { users: loadedUsers } = await api("/admin/users", { token: session.token });
      setUsers(loadedUsers);
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

  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const enabledCount = users.filter((user) => user.messagingEnabled).length;

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <span className="welcome-tag">WORKSPACE SETTINGS</span>
          <h2>Messaging access</h2>
          <p>Choose who can start and receive conversations on Ububiko.</p>
        </div>
        <button className="admin-refresh" onClick={loadUsers} disabled={loading || Boolean(updatingId)} aria-label="Refresh accounts">
          <RefreshCw size={16} className={loading ? "refresh-spinning" : ""} /> Refresh
        </button>
      </header>
      <div className="admin-stats">
        <div className="admin-stat"><span className="admin-stat-icon"><UsersRound size={18} /></span><span><strong>{users.length}</strong><small>Registered people</small></span></div>
        <div className="admin-stat"><span className="admin-stat-icon enabled"><MessageSquare size={18} /></span><span><strong>{enabledCount}</strong><small>Can use messaging</small></span></div>
        <div className="admin-stat"><span className="admin-stat-icon paused"><ShieldOff size={18} /></span><span><strong>{users.length - enabledCount}</strong><small>Messaging paused</small></span></div>
      </div>
      <div className="admin-list-heading">
        <div><h3>People</h3><span>Manage messaging access for each account.</span></div>
        <label className="admin-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" /></label>
      </div>
      {error && <div className="admin-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button></div>}
      <div className="admin-users">
        {loading ? <div className="admin-empty">Loading accounts…</div> : filteredUsers.length ? filteredUsers.map((user) => (
          <div className="admin-user-row" key={user.id}>
            <Avatar name={user.name} />
            <div className="admin-user-info"><strong>{user.name}{user.isAdmin && <span className="admin-badge"><ShieldCheck size={12} /> Admin</span>}</strong><span>{user.email}</span></div>
            <span className={`access-status ${user.messagingEnabled ? "access-on" : "access-off"}`}><i />{user.messagingEnabled ? "Messaging on" : "Messaging off"}</span>
            <button className={`access-toggle ${user.messagingEnabled ? "" : "toggle-off"}`} onClick={() => toggleMessaging(user)} disabled={Boolean(updatingId)} aria-label={`${user.messagingEnabled ? "Disable" : "Enable"} messaging for ${user.name}`}>
              {updatingId === user.id ? <span className="toggle-spinner" /> : user.messagingEnabled ? "Disable" : "Enable"}
            </button>
          </div>
        )) : <div className="admin-empty">{search ? "No accounts match your search." : "No accounts to manage yet."}</div>}
      </div>
      <div className="admin-note"><ShieldCheck size={15} /><span>Messaging access is checked by the server, not just hidden in the app.</span></div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ububiko-session") || "null"); } catch { return null; }
  });
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const [adminView, setAdminView] = useState(false);
  const messageEndRef = useRef(null);
  const inputRef = useRef(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const selectedPerson = people.find((person) => person.id === selectedId);

  useEffect(() => {
    if (session) localStorage.setItem("ububiko-session", JSON.stringify(session));
    else localStorage.removeItem("ububiko-session");
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoadingPeople(true);
    api("/users", { token: session.token })
      .then(({ users }) => { if (active) setPeople(users); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingPeople(false); });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session || (session.user.isAdmin !== undefined && session.user.messagingEnabled !== undefined)) return;
    let active = true;
    api("/auth/me", { token: session.token })
      .then(({ user }) => {
        if (active) {
          setSession((current) => current?.token === session.token ? { ...current, user } : current);
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    const socket = io(API_URL, { auth: { token: session.token } });
    socket.on("message:new", (message) => {
      if (
        message.senderId !== selectedIdRef.current ||
        message.recipientId !== session.user.id
      ) {
        return;
      }
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });
    socket.on("connect_error", () => setError("Live connection lost. Please refresh to reconnect."));
    return () => socket.disconnect();
  }, [session]);

  useEffect(() => {
    if (!session || !selectedId) {
      setMessages([]);
      return undefined;
    }
    let active = true;
    setMessages([]);
    setLoadingMessages(true);
    setError("");
    api(`/messages/${selectedId}`, { token: session.token })
      .then(({ messages: loaded }) => {
        if (!active) return;
        setMessages((current) => {
          const currentConversation = current.filter((message) =>
            (message.senderId === selectedId && message.recipientId === session.user.id) ||
            (message.senderId === session.user.id && message.recipientId === selectedId)
          );
          const uniqueMessages = new Map(
            [...loaded, ...currentConversation].map((message) => [message.id, message])
          );
          return [...uniqueMessages.values()].sort(
            (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
          );
        });
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingMessages(false); });
    return () => { active = false; };
  }, [session, selectedId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people.filter((person) => !query || `${person.name} ${person.email}`.toLowerCase().includes(query));
  }, [people, search]);

  function signOut() {
    setSession(null);
    setPeople([]);
    setMessages([]);
    setSelectedId(null);
    setAdminView(false);
    setError("");
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
        body: JSON.stringify({ recipientId: selectedId, content }),
      });
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft("");
      if (inputRef.current) inputRef.current.style.height = "auto";
      inputRef.current?.focus();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  const canMessage = session?.user.messagingEnabled !== false && selectedPerson?.messagingEnabled !== false;

  if (!session) return <AuthScreen onAuthenticated={setSession} />;

  return (
    <main className={`app-shell ${mobileChat ? "mobile-chat-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <a className="app-brand" href="#" onClick={(event) => event.preventDefault()}><span className="brand-mark"><MessageCircle size={19} fill="currentColor" /></span><span>ububiko<small>YOUR LITTLE CORNER</small></span></a>
          <button className="icon-button sidebar-menu" aria-label="More options"><MoreHorizontal size={20} /></button>
        </div>
        <div className="sidebar-heading"><div><span className="section-label">YOUR COMMUNITY</span><h1>Messages <span>{people.length}</span></h1></div><button className="icon-button add-person" aria-label="Find someone" onClick={() => document.querySelector(".search-input")?.focus()}><UsersRound size={17} /></button></div>
        <div className="search-box"><Search size={16} /><input className="search-input" placeholder="Find someone…" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div>
        {session.user.isAdmin && <button className={`admin-nav ${adminView ? "active" : ""}`} onClick={() => { setAdminView(true); setMobileChat(false); setSelectedId(null); setError(""); }}><ShieldCheck size={16} /> Admin dashboard <span>Manage access</span></button>}
        <div className="people-label"><span>PEOPLE</span><button className="icon-button" aria-label="Sort people"><ChevronDown size={15} /></button></div>
        <div className="people-list">
          {loadingPeople ? <div className="list-state">Finding your people…</div> : filteredPeople.length ? filteredPeople.map((person) => {
            const lastMessage = messages.find((message) => message.senderId === person.id || message.recipientId === person.id);
            return <button key={person.id} className={`person-row ${person.id === selectedId ? "selected" : ""}`} onClick={() => { setAdminView(false); setSelectedId(person.id); setMobileChat(true); setError(""); }}>
              <Avatar name={person.name} size="normal" />
              <span className="person-info"><span className="person-name">{person.name}</span><span className="person-preview">{person.messagingEnabled === false ? "Messaging disabled" : lastMessage?.content || person.email}</span></span>
              {lastMessage && <span className="person-time">{formatTime(lastMessage.createdAt)}</span>}
            </button>;
          }) : <div className="empty-people"><span className="empty-icon"><UsersRound size={20} /></span><strong>{search ? "No one found" : "Your circle starts here"}</strong><p>{search ? "Try another name or email." : "When someone creates an account, they’ll show up here."}</p></div>}
        </div>
        <div className="sidebar-bottom">
          <button className="profile-button"><Avatar name={session.user.name} size="small" /><span className="profile-text"><strong>{session.user.name}</strong><small>My account</small></span><span className="profile-chevron"><ChevronDown size={15} /></span></button>
          <button className="signout-button" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>
      <section className="conversation">
        {adminView && session.user.isAdmin ? <AdminDashboard session={session} onUserUpdated={updateManagedUser} /> : !selectedPerson ? <WelcomePanel user={session.user} people={people} /> : <>
          <header className="chat-header">
            <button className="icon-button back-button" aria-label="Back to people" onClick={() => setMobileChat(false)}><ArrowLeft size={19} /></button>
            <Avatar name={selectedPerson.name} />
            <div className="chat-person"><h2>{selectedPerson.name}</h2><span>On Ububiko</span></div>
            <div className="chat-actions"><button className="icon-button" aria-label="Search conversation"><Search size={18} /></button><button className="icon-button" aria-label="Conversation options"><MoreHorizontal size={20} /></button></div>
          </header>
          <div className="messages-area">
            <div className="conversation-intro"><div className="intro-avatar"><Avatar name={selectedPerson.name} size="large" /></div><h3>{selectedPerson.name}</h3><span>{selectedPerson.email}</span><p>This is the beginning of your conversation.</p></div>
            {loadingMessages ? <div className="message-loading">Opening your conversation…</div> : messages.map((message, index) => {
              const own = message.senderId === session.user.id;
              const previous = messages[index - 1];
              const showDate = !previous || new Date(message.createdAt).toDateString() !== new Date(previous.createdAt).toDateString();
              return <div key={message.id}>{showDate && <div className="date-divider"><span>{formatDay(message.createdAt)}</span></div>}<div className={`message-row ${own ? "own-message" : ""}`}>
                {!own && <Avatar name={selectedPerson.name} size="tiny" />}
                <div className="message-content"><div className="message-bubble">{message.content}</div><span className="message-meta">{formatTime(message.createdAt)} {own && <CheckCheck size={14} />}</span></div>
              </div></div>;
            })}
            <div ref={messageEndRef} />
          </div>
          {error && <div className="inline-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button></div>}
          {canMessage ? <div className="composer-wrap"><form className="composer" onSubmit={sendMessage}><button type="button" className="icon-button composer-emoji" aria-label="Emoji"><Smile size={19} /></button><textarea ref={inputRef} value={draft} onChange={(event) => { setDraft(event.target.value); event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`Write a message to ${selectedPerson.name.split(/\s+/)[0]}…`} maxLength={4000} rows={1} /><button type="submit" className="send-button" disabled={!draft.trim() || sending} aria-label="Send message">{sending ? <span className="send-loading" /> : <Send size={17} />}</button></form><div className="composer-hint"><span>Keep it kind. Keep it you.</span><span><kbd>Enter</kbd> to send <span className="hint-dot">·</span> <kbd>Shift + Enter</kbd> for a new line</span></div></div> : <div className="messaging-disabled"><ShieldOff size={17} /><span>{session.user.messagingEnabled === false ? "Messaging is disabled for your account." : `${selectedPerson.name} is not accepting messages right now.`}</span></div>}
        </>}
      </section>
      <div className="toast-area" aria-live="polite">{!selectedPerson && error && <div className="toast-error">{error}<button onClick={() => setError("")}><X size={14} /></button></div>}</div>
    </main>
  );
}
