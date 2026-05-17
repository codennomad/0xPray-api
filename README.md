# 0xPray API

> Backend for the 0xPray encrypted prayer vault.

REST API that handles authentication and cloud-sync for the [0xPray](https://github.com/codennomad/0xPray) PWA. The server **never** sees your prayers — only the AES-256-GCM ciphertext produced by the client is stored.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Fastify 5 |
| Language | TypeScript 5 |
| Database | PostgreSQL (via `postgres` driver) |
| Auth | JWT (`@fastify/jwt`) + session table |
| Validation | Zod |
| Password hashing | bcryptjs |

---

## API Endpoints

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Get JWT token |
| `POST` | `/auth/logout` | Invalidate session |

### Vault

All vault routes require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/vault` | Fetch encrypted vault blob |
| `PUT` | `/vault` | Upload encrypted vault blob |
| `DELETE` | `/vault` | Permanently delete vault |

### Share

| Method | Path | Description |
|---|---|---|
| `POST` | `/share` | Create a shareable prayer link |
| `GET` | `/share/:id` | Read a shared prayer (no auth required) |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server health check |

---

## Security Model

The API is a **dumb storage layer**. It stores whatever ciphertext the client sends — it has no key, no PIN, and no way to read the vault content.

- Passwords hashed with bcryptjs
- JWT tokens validated per-request against a `sessions` table
- Sessions expire server-side — logout actually invalidates the token
- Vault accepts only opaque blobs (`encrypted_data`, `salt`, `client_version`)

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env
```

Edit `.env`:

```env
PORT=3001
HOST=127.0.0.1
DATABASE_URL=postgresql://user:password@localhost:5432/oxpray_db
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=7d
```

### Database

Create the database and run the schema:

```sql
CREATE USER oxpray_user WITH PASSWORD 'yourpassword';
CREATE DATABASE oxpray_db OWNER oxpray_user;
```

The tables (`users`, `sessions`, `vaults`, `shares`) are created automatically on first start.

### Run

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build
npm start
```

The server starts on `http://127.0.0.1:3001` by default.

---

## Project Structure

```
src/
├── index.ts          # Fastify app setup, plugin registration
├── env.ts            # Typed env config (Zod)
├── db.ts             # PostgreSQL connection pool
├── types.d.ts        # Fastify type augmentations
└── routes/
    ├── auth.ts       # /auth/* — register, login, logout
    ├── vault.ts      # /vault — encrypted blob sync (GET, PUT, DELETE)
    └── share.ts      # /share — shareable prayer links
```

---

## License

MIT
