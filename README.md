# Knot 💬

> **Messaging, refined.**  
> A self-hosted, production-grade real-time messaging app built with Next.js, Express, Prisma, and Socket.io.

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

---

## 📖 Overview

Knot is a full-stack real-time messaging application with a focus on security, clean architecture, and a polished user experience. It features WebSocket-based messaging, WhatsApp-style message status ticks, file sharing via Cloudinary, a complete block system, and a built-in admin panel for user and report management — all running on a self-hosted infrastructure with zero third-party messaging dependencies.

---

## ✨ Features

### Messaging
- **Real-time messaging** via Socket.io WebSockets
- **Message status ticks** — Sent, Delivered, Read with live updates
- **Reply to messages** — inline quote blocks with scroll-to-original
- **Delete for everyone** — soft delete with admin audit trail preserved
- **File attachments** — images, videos, PDFs, and documents via Cloudinary
- **Emoji picker** — lazy-loaded, SSR-safe
- **Typing indicators** — real-time with automatic timeout
- **Chat date separators** — Today, Yesterday, day name, or full date

### Users & Privacy
- **JWT authentication** — HttpOnly, Secure, SameSite=Strict cookies only
- **Block system** — WhatsApp-style, enforced on both HTTP and socket layers
- **Privacy mode** — hides online status and typing indicators from other users
- **Online presence** — live tracking with lastSeen timestamp
- **User profiles** — displayName, bio, profile picture, banner
- **User search** — debounced with AbortController for request cancellation

### Admin Panel
- **User management** — ban, unban, verify users
- **Report management** — review message context snapshots, act on reporter or reported user
- **Warn system** — persistent warning modal shown to user on next app load
- **Admin visibility** — soft-deleted messages remain visible to admin with `[Deleted]` marker
- **Stats overview** — active conversations, banned users, admin count

---

## 🛠️ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js v5 |
| ORM | Prisma v7 |
| Database | PostgreSQL via Neon DB |
| Real-time | Socket.io v4 |
| Auth | JWT + bcryptjs |
| Validation | Zod v4 |
| Logging | Winston |
| File Storage | Multer + Cloudinary |
| Security | Helmet, express-rate-limit, CORS |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion v12 |
| Icons | lucide-react |
| HTTP Client | Axios |
| Real-time | Socket.io-client v4 |

---

## 📁 Project Structure

```
Knot/
├── src/
│   ├── config/
│   │   └── env.ts                  # Environment variable validation
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── message.controller.ts
│   │   ├── user.controller.ts
│   │   ├── admin.controller.ts
│   │   ├── report.controller.ts
│   │   └── upload.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── admin.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validate.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── message.routes.ts
│   │   ├── user.routes.ts
│   │   ├── admin.routes.ts
│   │   ├── report.routes.ts
│   │   ├── upload.routes.ts
│   │   └── health.routes.ts
│   ├── sockets/
│   │   └── chat.socket.ts          # All Socket.io logic
│   ├── utils/
│   │   ├── db.ts                   # Prisma singleton
│   │   ├── logger.ts               # Winston instance
│   │   └── socketEvents.ts         # Socket event name constants
│   └── server.ts
├── prisma/
│   └── schema.prisma
└── frontend/
    └── src/
        ├── app/
        │   ├── (auth)/login/
        │   ├── (auth)/register/
        │   ├── dashboard/
        │   └── layout.tsx
        ├── components/
        │   ├── ChatList.tsx
        │   ├── ChatWindow.tsx
        │   ├── Sidebar.tsx
        │   ├── AdminPanel.tsx
        │   ├── SearchPanel.tsx
        │   ├── SettingsSection.tsx
        │   ├── UserProfilePanel.tsx
        │   └── CursorGlow.tsx
        └── providers/
            ├── ChatProvider.tsx
            └── SocketProvider.tsx
```

---

## 🗃️ Database Schema

```
User        id, email, username, displayName, profilePic, banner,
            isOnline, lastSeen, role (USER/ADMIN), isVerified,
            isBanned, privacySettings (JSON)

Message     id, content, fileUrl, resourceType, fileName, fileSize,
            senderId, receiverId, status (SENT/DELIVERED/READ),
            replyToId (self-relation), isDeleted, timestamp

Report      id, reporterId, reportedUserId, reason,
            contextMessages (JSON snapshot), status (PENDING/RESOLVED)

Block       blockerId, blockedId
Friendship  userId, friendId, status (PENDING/ACCEPTED)
Warning     userId, message, isDismissed, createdAt
```

---

## 🔌 API Reference

**Auth** — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register new user |
| POST | `/login` | Login with email or username |
| POST | `/logout` | Clear session cookie |
| GET | `/me` | Get authenticated user |

**Users** — `/api/users`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/search?query=` | Search users by username |
| GET | `/` | List all users (cursor paginated) |
| PUT | `/profile` | Update own profile |
| GET | `/:userId` | Get public profile |
| POST | `/block/:userId` | Block a user |
| DELETE | `/block/:userId` | Unblock a user |
| GET | `/blocked` | Get blocked users list |

**Messages** — `/api/messages`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/conversations` | List all conversations |
| GET | `/:partnerId` | Get messages (cursor paginated) |
| PUT | `/mark-read/:partnerId` | Mark messages as read |
| DELETE | `/:messageId` | Soft delete a message |

**Admin** — `/api/admin`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | List users with stats |
| PUT | `/update-status` | Ban or verify a user |
| GET | `/reports` | List all reports |
| PUT | `/reports/:id/resolve` | Resolve a report |
| POST | `/warn/:userId` | Issue warning to user |

**Upload** — `/api/upload`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Upload file to Cloudinary (max 10MB) |

---

## 🔁 Socket Events

```
Client → Server
  JOIN_CHAT           Join conversation room
  SEND_MESSAGE        { receiverId, content?, fileUrl?, replyToId? }
  START_TYPING        Notify typing start to receiver
  STOP_TYPING         Notify typing stop to receiver

Server → Client
  NEW_MESSAGE         Deliver incoming message to receiver
  MESSAGE_CONFIRMED   Confirm saved message back to sender
  MESSAGE_DELIVERED   Update message status to DELIVERED
  MESSAGE_READ        Batch update message statuses to READ
  MESSAGE_DELETED     Notify both users of soft delete
  USER_TYPING         Broadcast typing state to conversation partner
  PRESENCE_UPDATE     Broadcast online/offline status change
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon DB free tier works)
- Cloudinary account (free tier works)

### 1. Clone
```bash
git clone https://github.com/yourusername/knot.git
cd knot
```

### 2. Backend
```bash
npm install
cp .env.example .env
```

`.env`
```env
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_SECRET=
```

```bash
npx prisma generate
npx prisma db push
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
```

`.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

```bash
npm run dev
```

Open `http://localhost:3000`. Registering with the email set as `ADMIN_EMAIL` in your backend `.env` automatically assigns the admin role.

---

## 📦 Available Scripts

**Backend**
```bash
npm run dev        # Run with ts-node on port 5000
npm run build      # Compile TypeScript → dist/
npm start          # Run compiled build
```

**Frontend**
```bash
npm run dev        # Next.js dev server on port 3000
npm run build      # Production build
npm start          # Start production server
```

**Database**
```bash
npx prisma generate          # Regenerate Prisma client
npx prisma db push           # Push schema to database
npx prisma migrate dev       # Create and apply migration
npx prisma studio            # Open visual DB browser
```

---

## 🔒 Security

- JWT stored exclusively in `HttpOnly + Secure + SameSite=Strict` cookies
- All controller inputs validated with Zod schemas
- File MIME type verified server-side using magic bytes — not just file extension
- Rate limiting applied on auth, upload, and report routes independently
- Block system enforced on both HTTP controllers and socket event handlers
- Error responses never expose stack traces or internal implementation details
- Admin role assigned via `ADMIN_EMAIL` environment variable — not user-controllable

---

## ⚠️ Known Limitations

- Neon DB free tier has a 0.5GB storage limit
- Cloudinary free tier has a 25GB storage limit
- Privacy mode is client-enforced — server-side enforcement is partial
- File download behavior varies by browser for Cloudinary-hosted files

---

## 🗺️ Roadmap

- [ ] Friendship / Contacts system
- [ ] Group chats
- [ ] Message reactions
- [ ] Push notifications
- [ ] End-to-End Encryption
- [ ] Infinite scroll in chat window
- [ ] PWA support

---

## 👤 Author

**Kanishk Garg**
[GitHub](https://github.com/ALOENT)

---

## 📄 License

This project is for personal and portfolio use.
