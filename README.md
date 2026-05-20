# Household Expense Manager

A web platform for managing shared household expenses and tasks among roommates.

## 🎓 Academic Project
Master's Thesis Project - 16-week development timeline

## 🛠 Tech Stack

### Frontend
- React 18+ with TypeScript
- shadcn/ui component library
- Tailwind CSS

### Backend
- Node.js with Express
- TypeScript
- MongoDB with Mongoose
- JWT Authentication

## 📁 Project Structure
```
/frontend  - React application
/backend   - Express API server
/docs      - Thesis documentation
```

## 🚀 Getting Started

Node 20+ required. From the repo root:

```bash
corepack enable
pnpm install
```

Common commands:

```bash
pnpm dev:back     # backend dev server (http://localhost:5000)
pnpm dev:front    # frontend dev server (http://localhost:5173)
pnpm test         # backend test suite (Vitest)
pnpm build        # build both packages
pnpm audit        # check for vulnerable dependencies
```

Or run the full stack via Docker:

```bash
docker compose up -d
```

## 🔒 Security

- All passwords hashed with bcrypt
- JWT-based authentication
- Input validation on all endpoints
- Environment variables for secrets