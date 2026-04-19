# CLAUDE.md — Knot Project Context

> **HOW TO USE:** Paste this entire file into any AI coding tool when starting a session.
> Then just say: "Read CLAUDE.md. Current task: [X]. Continue."
> No need to re-explain anything.

---

## What is Knot?

Knot is a **production-grade, self-hosted real-time messaging web app** — a premium dark-themed alternative to Discord/Telegram. It has real-time chat via WebSockets, admin control panel, user reporting, message delivery receipts, block system, file uploads via Cloudinary, and a deeply refined "Deep Blue / Night" aesthetic.

**Core philosophy:** `#0a0a0c` background. No light mode. No generic UI. Premium glassmorphic design. Every pixel is intentional.

---

## Tech Stack

### Backend (Node.js — project root `/Knot`)
| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript (strict mode) |
| Framework | Express.js v5 |
| ORM | Prisma v7 with `@prisma/adapter-pg` |
| Database | PostgreSQL via Neon DB (serverless, connection pooling via `pg` Pool max:10) |
| Real-time | Socket.io v4 |
| Auth | JWT in HttpOnly cookies (`jwt`) + bcryptjs |
| Validation | Zod v4 (safeParse pattern everywhere) |
| Logging | Winston (console only) |
| File Upload | Multer (memory storage) → Cloudinary v2 |
| Security | Helmet, express-rate-limit (2 tiers), CORS |

### Frontend (`/Knot/frontend/`)
| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4.0+ |
| Animations | Framer Motion v12 |
| Icons | lucide-react ONLY |
| HTTP Client | Axios via `@/lib/api` (withCredentials:true, 15s timeout, 401→auto-redirect) |
| Real-time | Socket.io-client v4 |

---

## Exact Folder Structure

```
Knot/                                   ← Project root (IS the backend)
├── src/
│   ├── config/env.ts                   ← Validates ALL env vars at startup (fails fast)
│   ├── controllers/
│   │   ├── admin.controller.ts         ← getUsers, updateUserStatus, getReports, resolveReport, warnUser
│   │   ├── auth.controller.ts          ← register, login, logout, getMe
│   │   ├── message.controller.ts       ← getMessages, getConversations, markAsRead, deleteMessage
│   │   ├── report.controller.ts        ← createReport (last 15 msgs snapshot, reversed to chronological)
│   │   ├── upload.controller.ts        ← uploadFile → Cloudinary (content verified via file-type lib)
│   │   └── user.controller.ts          ← searchUsers, getAllUsers, updateProfile, getUserProfile,
│   │                                      blockUser, unblockUser, getBlockedUsers
│   ├── middlewares/
│   │   ├── auth.middleware.ts           ← protect (verifies JWT cookie, attaches req.user)
│   │   ├── admin.middleware.ts          ← requireAdmin (role === 'ADMIN')
│   │   ├── error.middleware.ts          ← Global errorHandler middleware
│   │   └── validate.middleware.ts       ← Zod schema validator wrapper
│   ├── routes/
│   │   ├── admin.routes.ts             ← /api/admin/* (protect + requireAdmin on all)
│   │   ├── auth.routes.ts              ← /api/auth/*
│   │   ├── health.routes.ts            ← /api/health (DB ping)
│   │   ├── message.routes.ts           ← /api/messages/* (NOTE: /conversations before /:partnerId)
│   │   ├── report.routes.ts            ← /api/reports/*
│   │   ├── upload.routes.ts            ← /api/upload (multer middleware here)
│   │   └── user.routes.ts              ← /api/users/*
│   ├── sockets/
│   │   └── chat.socket.ts              ← ALL Socket.io logic: auth, rooms, messaging,
│   │                                      typing, presence, block enforcement
│   ├── types/
│   │   ├── express/index.d.ts          ← Express.Request extended with `user?: User`
│   │   └── socket.io/index.d.ts        ← Socket extended with `user?: {id, role}`
│   ├── utils/
│   │   ├── db.ts                       ← Prisma singleton with pg Pool
│   │   ├── logger.ts                   ← Winston logger instance
│   │   └── socketEvents.ts             ← SOCKET_EVENTS const (source of truth for event names)
│   └── server.ts                       ← Express app, two rate limiters, all routes mounted
├── prisma/schema.prisma
├── prisma.config.ts
├── test-admin.ts                       ← Test script to verify ADMIN role assignment
├── tsconfig.json                       ← rootDir:./src, outDir:./dist, target:es2022
└── package.json

frontend/src/
├── app/
│   ├── (auth)/login/page.tsx           ← Login (identifier field = email OR username)
│   ├── (auth)/register/page.tsx        ← Register
│   ├── dashboard/page.tsx              ← Main app orchestrator (protected)
│   ├── layout.tsx                      ← Root layout wrapping providers
│   └── page.tsx                        ← Landing page (/)
├── components/
│   ├── AdminPanel.tsx                  ← Users tab + Reports tab (warn/ban/resolve actions)
│   ├── ChatList.tsx                    ← Conversation list (block-aware, uses useChat+useSocket)
│   ├── ChatWindow.tsx                  ← Chat UI (reply, delete, emoji, file upload, report modal)
│   ├── ContactsTab.tsx                 ← Contacts with cursor pagination
│   ├── CursorGlow.tsx                  ← Auth-pages only cursor glow effect
│   ├── SearchPanel.tsx                 ← User discovery (debounced 400ms + AbortController)
│   ├── SettingsSection.tsx             ← Profile + notifications + privacy + blocked users + logout
│   ├── Sidebar.tsx                     ← Desktop icon rail + mobile bottom nav
│   └── UserProfilePanel.tsx            ← Slide-in profile drawer (banner, bio, join date)
├── lib/api.ts                          ← Axios instance (baseURL=NEXT_PUBLIC_API_URL)
├── providers/
│   ├── ChatProvider.tsx                ← Global state (currentUser, messages, blocks, privacy)
│   └── SocketProvider.tsx              ← Socket.io context (onlineUsers Map, typingUsers Map)
└── utils/socketEvents.ts               ← Same SOCKET_EVENTS const (frontend mirror)
```

---

## Database Schema (Prisma — Current)

```prisma
enum Role              { USER, ADMIN }
enum FriendshipStatus  { PENDING, ACCEPTED }
enum ReportStatus      { PENDING, RESOLVED }
enum MessageStatus     { SENT, DELIVERED, READ }   // ← Replaced old isSeen boolean

model User {
  id(uuid), email(unique), username(unique), displayName?,
  password, bio?, profilePic?, banner?,
  isOnline(bool), lastSeen?,
  role(Role default USER), isVerified(bool), isBanned(bool),
  privacySettings Json? default: {"allowDisplayVerifiedBadge":true,"showTyping":true}
  createdAt, updatedAt
}

model Message {
  id(uuid), content?, fileUrl?,
  senderId, receiverId,
  isDeleted(bool default false),
  status(MessageStatus default SENT),   // ← Key field for read receipts
  replyToId?,                           // ← Self-relation for reply feature
  timestamp
  DB Indexes: [senderId,receiverId], [receiverId],
              [senderId,receiverId,status], [timestamp]
}

model Report {
  id(uuid), reporterId, reportedUserId,
  reason(string), contextMessages(Json),
  status(ReportStatus default PENDING), createdAt
}

model Friendship {
  id, userId, friendId,
  status(FriendshipStatus default PENDING)
  Unique: [userId, friendId]
}

model Block {
  id, blockerId, blockedId, createdAt
  Unique: [blockerId, blockedId]
}
```

**Critical schema notes:**
- `isSeen` boolean is **REMOVED** — use `MessageStatus` enum everywhere
- `replyToId` is a self-relation on Message (reply-to feature)
- Block model is **fully functional** (bidirectional socket enforcement)

---

## Complete API Reference

### Auth `/api/auth`
| Method | Route | Access | Notes |
|---|---|---|---|
| POST | `/register` | Public | email=ADMIN_EMAIL env → ADMIN role |
| POST | `/login` | Public + sensitiveLimiter | Accepts email OR username as identifier |
| POST | `/logout` | Public | Clears JWT cookie |
| GET | `/me` | protect | Returns full user profile |

### Users `/api/users` (all: protect)
| Method | Route | Notes |
|---|---|---|
| GET | `/search?query=` | Min 2 chars; admin sees email field |
| GET | `/` | All users, cursor-based pagination |
| PUT | `/profile` | Zod validated (username min3, displayName max50, bio max160, profilePic URL) |
| GET | `/:userId` | Public profile (for UserProfilePanel) |
| POST | `/block/:userId` | Block user |
| DELETE | `/block/:userId` | Unblock user |
| GET | `/blocked` | My blocked users list |

### Messages `/api/messages` (all: protect)
| Method | Route | Notes |
|---|---|---|
| GET | `/conversations` | Unread count uses status enum |
| GET | `/:partnerId` | cursor=timestamp, default take=50, max=100 |
| PUT | `/mark-read/:partnerId` | Sets status=READ |
| DELETE | `/:messageId` | Soft delete (sender only) |

### Admin `/api/admin` (protect + requireAdmin)
| Method | Route | Notes |
|---|---|---|
| GET | `/users` | Search + pagination, returns stats |
| PUT | `/update-status` | { userId, isBanned?, isVerified? } |
| GET | `/reports` | PENDING first, then by createdAt desc |
| PUT | `/reports/:id/resolve` | Sets status=RESOLVED |
| POST | `/warn/:userId` | Send warning message to user |

### Reports `/api/reports` (protect + sensitiveLimiter)
| POST | `/` | { reportedUserId, reason } — captures+reverses last 15 msgs |

### Upload `/api/upload` (protect + sensitiveLimiter + multer)
| POST | `/` | Returns { fileUrl } — Cloudinary secure_url |

---

## Rate Limiting

```
generalLimiter:    150 req / 15 min  → /api/*
sensitiveLimiter:   20 req / 1 hour  → /api/auth/register, /api/auth/login,
                                        /api/reports, /api/upload
```

---

## Socket.io Architecture

**Socket auth:** JWT cookie verified in socket middleware on every connection.

**Room strategy:** `getRoomId(userA, userB)` → sorts UUIDs alphabetically → `${a}_${b}`. Both users join this shared room. Users also join their own personal room (userId).

**Block enforcement:** Before saving/emitting any message, socket checks Block table bidirectionally. If blocked → **silently drop** (no error, no save, no emit).

```typescript
// SOCKET_EVENTS (use this constant everywhere, never hardcode strings)
JOIN_CHAT           // client → server: join rooms
USER_JOINED_CHAT    // server → client: confirmation
SEND_MESSAGE        // { receiverId, content?, fileUrl?, replyToId? }
NEW_MESSAGE         // full message with sender + replyTo details
MESSAGE_CONFIRMED   // full saved message back to sender
MESSAGE_DELIVERED   // { messageId, receiverId } when receiver online
MESSAGE_READ        // { messageIds[], partnerId } batch read receipts
MESSAGE_DELETED     // soft delete notification
START_TYPING        // { targetUserId }
STOP_TYPING         // { targetUserId }
USER_TYPING         // { userId, isTyping: bool } → room broadcast
PRESENCE_UPDATE     // { userId, isOnline, lastSeen? } → broadcast on connect/disconnect
ERROR               // { message }
```

---

## Frontend State

```typescript
// ChatContext (from useChat()):
currentUser: AuthUser | null
authError: any
isLoadingAuth: boolean
activeChat: ChatUser | null
messages: Message[]
setActiveChat(user: ChatUser | null): void
sendMessage(content: string, fileUrl?: string, replyToId?: string): void
isLoadingMessages: boolean
setCurrentUser: Dispatch<SetStateAction<AuthUser | null>>
deleteMessage(messageId: string): void
privacyModeEnabled: boolean          // localStorage: 'knot_privacy'
setPrivacyModeEnabled: Dispatch<...>
blockedUsers: AuthUser[]             // users I blocked
blockedByIDs: string[]               // IDs who blocked me
isBlocked(userId: string): boolean   // true if blocked in EITHER direction
isBlockedByMe(userId: string): boolean

// SocketContext (from useSocket()):
socket: Socket | null
onlineUsers: Map<string, boolean>
typingUsers: Map<string, boolean>
joinChat(userId: string): void
emitStartTyping(receiverId: string): void
emitStopTyping(receiverId: string): void

// AuthUser interface:
{ id, username, displayName?, profilePic?, bio?, email?,
  role?, createdAt?, isOnline?, isVerified?, isBanned? }

// Message interface (with reply support):
{ id, content?, fileUrl?, senderId, receiverId, timestamp, status?,
  sender?: { id, username, displayName?, profilePic?, isVerified? },
  replyTo?: { id, content?, senderId, sender: { username, displayName? } } }

// ChatUser interface (for conversation list):
{ id, username, displayName?, profilePic?, isOnline?,
  lastMessage?, lastMessageTime?, unreadCount?, isVerified? }
```

---

## Security Rules (Never Break)

1. JWT in `HttpOnly + Secure + SameSite=strict` cookie. **Never localStorage.**
2. Admin assigned at registration when `email === ADMIN_EMAIL` env var.
3. Banned users → 403 at login. Cannot access app.
4. All `/api/admin/*` → `protect + requireAdmin` middleware.
5. Blocks enforced bidirectionally in socket (silent drop) AND in API.
6. File uploads → `file-type` library checks actual content (not just extension).
7. All ID params → `z.string().uuid().safeParse()` before DB queries.
8. Use `safeParse` not `parse` in Zod — never throw unhandled Zod errors.

---

## UI / Design Rules (Never Break)

### Colors
```
#0a0a0c  → main bg          rgba(255,255,255,0.05) → borders
#0f0f12  → cards/modals     #2563eb → blue (CTAs, sent msgs)
#151518  → incoming msgs     #6366f1 → indigo (brand, admin)
#888888  → muted text
```

### Rules
- `displayName ?? username` — always prefer displayName
- `isVerified` → show `<BadgeCheck className="w-4 h-4 text-blue-500" />`
- `role === 'ADMIN'` → show admin features
- `isBlocked(userId)` → hide profile pic, hide status dot, disable send
- Icons → **lucide-react only**
- Animations → framer-motion (spring stiffness/damping physics)
- `h-[100dvh]` not `h-screen` for full-height layouts
- Mobile → bottom glassmorphic nav, slide transitions between panels

### Custom CSS Classes
```
.btn-icon, .btn-primary, .chat-input, .chat-item
.glass-sidebar, .glass-header, .border-beam
.status-dot.online, .status-dot.offline, .typing-dots
```

---

## Feature Status

### ✅ Implemented
- Auth (JWT cookies, register/login/logout/getMe)
- Real-time messaging with room-based Socket.io
- Message status: SENT → DELIVERED → READ
- Reply-to messages
- Soft message deletion (sender only)
- Typing indicators
- Online presence tracking (DB + socket broadcast)
- Block system (full: DB + socket + UI in Settings)
- Admin panel (ban, verify, warn, report management)
- User reporting (15-msg context snapshot)
- File uploads via Cloudinary (content-type verified)
- User search (debounced + AbortController)
- Profile editing (username, displayName, bio, profilePic)
- User profile drawer (UserProfilePanel)
- Privacy mode (localStorage, hides online status)
- Blocked users list in Settings (with unblock)
- Emoji picker (lazy-loaded, no SSR)
- Cursor glow on auth pages
- Mobile responsive (bottom nav)
- Cursor-based pagination (messages by timestamp, users by ID)

### 🚧 Not Yet Built
- [ ] Friendship system (schema ready, no UI)
- [ ] Group chats / Channels (Hash icon = placeholder)
- [ ] End-to-End Encryption (model is structurally ready)
- [ ] Push notifications (UI toggle exists, no backend)
- [ ] Message reactions
- [ ] Infinite scroll in ChatWindow (API ready, UI not done)
- [ ] `privacySettings.showTyping` enforcement
- [ ] Banner image upload UI (field in schema)

---

## Environment Variables

### Backend (`/Knot/.env`)
```env
DATABASE_URL=           # Neon PostgreSQL connection string (pooled)
JWT_SECRET=             # Strong random 32+ char string
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=            # This email → ADMIN role on register
NODE_ENV=development    # or production
PORT=5000
CLIENT_URL=http://localhost:3000
TRUST_PROXY=false       # true if behind nginx/cloudflare
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_SECRET=
```

### Frontend (`/Knot/frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## Dev Commands

```bash
# Backend (from /Knot root)
npm run dev           # ts-node src/server.ts → port 5000
npm run build         # tsc → dist/
npm start             # node dist/server.js
npx ts-node test-admin.ts  # Test admin role

# Frontend (from /Knot/frontend)
npm run dev           # Next.js → port 3000

# Prisma
npx prisma generate   # After schema changes
npx prisma db push    # Push to Neon (dev, no migration file)
npx prisma migrate dev --name <name>  # Prod-safe migration
npx prisma studio     # Visual DB browser
```

---

## Key Code Patterns

```typescript
// 1. Always use safeParse (not parse) for Zod in controllers
const result = schema.safeParse(req.body);
if (!result.success) return res.status(400).json({ message: result.error.issues[0].message });

// 2. UUID validation on all ID params
const uuidSchema = z.string().uuid();
if (!uuidSchema.safeParse(req.params.id).success) return res.status(400)...

// 3. Socket events — always use SOCKET_EVENTS constant
import { SOCKET_EVENTS } from '@/utils/socketEvents';
socket.emit(SOCKET_EVENTS.SEND_MESSAGE, data);

// 4. Frontend API calls
import { api } from '@/lib/api';
const res = await api.post('/messages', data);

// 5. displayName priority
const displayName = user.displayName || user.username;

// 6. Block check before rendering interactions
const { isBlocked } = useChat();
if (isBlocked(user.id)) { /* show blocked state, disable send */ }
```

---

## When to Update This File

**Update CLAUDE.md when:**
- New API route added → update API Reference
- Schema model/field changed → update Database Schema
- Feature completed → move from Planned to Implemented
- New env var needed → add to Environment Variables

**Don't update for:** bug fixes, CSS tweaks, refactors with no API/schema changes.

---

## Handoff Prompt

> "Read CLAUDE.md for full project context. This is **Knot** — a premium real-time messaging app.
> Stack: Next.js + Express v5 + Prisma v7 + Socket.io v4 + Neon PostgreSQL + Cloudinary.
> **Current task:** [DESCRIBE TASK HERE].
> **Last completed:** [WHAT WAS JUST DONE].
> Continue directly without asking me to re-explain the project."

---
*From full codebase scan — `/Knot/src` + `/Knot/frontend/src` + `prisma/schema.prisma`*
