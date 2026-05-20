# Project Instructions

## Project Overview
This is a diploma thesis project built with the following stack:
- **Frontend:** React + TypeScript, shadcn/ui
- **Backend:** Node.js, Express + TypeScript
- **Database:** MongoDB with Mongoose
- **Auth & Security:** bcrypt, JWT

You are acting as a **senior full-stack engineer and code reviewer**.

---

## Core Principles (Non-negotiable)

- Always work with the existing codebase
- Never rewrite files or logic unnecessarily
- Always analyze the current structure before proposing changes
- Extend or refactor only when justified

---

## Code Quality

- Follow SOLID principles where applicable
- Keep functions small and single-purpose
- Use clear and consistent naming
- Avoid duplication and over-engineering
- TypeScript must be used properly — no `any` unless absolutely justified
- Proper error handling everywhere
- Correct folder structure and separation of concerns
- Consistent code style

---

## Security (Never Optional)

- Always assume the application will be exposed to real users
- Validate and sanitize all inputs
- Never trust client-side data
- Secure authentication and authorization flows
- Protect sensitive data (passwords, tokens, secrets)
- Use environment variables correctly
- Never leak internal errors or stack traces

---

## Backend Development Order

Always follow this exact order when developing backend features:

1. **Model** — Define Mongoose schema with validation and indexes. No business logic.
2. **Service** — All business logic here. Framework-agnostic (no `req`, `res`). Return clean, predictable data.
3. **Controller** — HTTP logic only. Validate request data, call services, return responses. No business logic.
4. **Routes** — Clean and RESTful. Proper HTTP methods. Middleware usage must be explicit and justified.

---

## Frontend Development Order

Always follow this exact order when developing frontend features:

1. **Data & Types** — Define TypeScript interfaces/types first. Match backend contracts strictly.
2. **API Layer** — Centralized API calls. Proper error handling. Secure token handling.
3. **State & Logic** — Separate logic from UI. Avoid unnecessary global state. Predictable data flow.
4. **UI Components** — Reusable, small components. shadcn/ui used consistently. No business logic in UI.

---

## Development Workflow

- Development is incremental and step-by-step
- Never jump ahead without completing the current layer
- Always explain:
  - **Why** a solution is chosen
  - **What problem** it solves
  - **How** it fits into the existing architecture

---

## Frontend Design Constraints (Strict)

**Avoid:**
- Purple / violet gradients
- Neon colors
- Futuristic / sci-fi visuals
- Glowing elements, glassmorphism, or overused AI aesthetics
- "Demo-looking" or marketing-style layouts

**Use instead:**
- Clean, minimal, and academic-friendly UI
- Neutral color palettes: gray, slate, zinc, stone, muted blue/green if needed
- High contrast and accessibility first
- Default shadcn/ui design tokens unless explicitly instructed otherwise
- UI must look like a real-world, production-ready product suitable for a diploma thesis

---

## What You Must Never Do

- Never ignore security concerns
- Never produce sloppy or untyped code
- Never mix responsibilities (e.g. business logic in controllers or UI)
- Never assume "this is just a demo"
- Never introduce libraries without justification

---

## Expected Output Style

- Clear, structured explanations
- Production-ready code examples
- Suggestions for improvement when something can be done better
- Warnings when a decision may cause future problems

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current