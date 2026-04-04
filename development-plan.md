# ПОДРОБЕН ПЛАН ЗА РАЗРАБОТКА — Backend Authentication, Onboarding & Household System

## Контекст на проекта

Web платформа за управление на общи домакински разходи и задачи. Tech stack: React + TypeScript (frontend), Express.js + TypeScript (backend), MongoDB + Mongoose (database), bcrypt + JWT (auth).

Проектът следва strict development rules:
- Backend: Model → Service → Controller → Routes (винаги в този ред)
- Frontend: Types → API Layer → State & Logic → UI Components
- TypeScript без `any`, proper error handling навсякъде
- Separation of concerns — бизнес логика само в services
- Security first — валидация на всички inputs, никога не trust-ваме client-side data

---

## 1. ТЕКУЩО СЪСТОЯНИЕ НА КОДА

### ✅ Завършено — Backend Auth система (Стъпка 1):

**Файлова структура:**
```
backend/src/
├── config/database.ts              — MongoDB connection с graceful shutdown
├── types/
│   ├── user.types.ts               — IUser, IRegisterInput, ILoginInput, IAuthResponse, IJwtPayload и др.
│   └── household.types.ts          — IHousehold, IHouseholdMember, enums и др.
├── models/
│   ├── user.model.ts               — Разширен с households, preferences, refreshToken, avatarUrl, phoneNumber, isEmailVerified
│   └── household.model.ts          — Household с members, settings, inviteCode, createdBy
├── utils/
│   ├── email.ts                    — Resend integration, sendVerificationEmail, sendPasswordResetEmail
│   ├── token.ts                    — token generation helpers
│   └── error.ts                    — AppError клас + фабрики (BadRequest, Unauthorized, Conflict, NotFound, Forbidden) (преименуван от errors.ts)
├── validators/
│   ├── auth.validator.ts           — express-validator: register, login, refreshToken validation
│   ├── user.validator.ts           — updateProfile, changePassword validation
│   └── household.validator.ts      — createHousehold, joinHousehold validation
├── middleware/
│   ├── auth.ts                     — JWT верификация, AuthRequest interface
│   ├── validate.ts                 — handleValidationErrors middleware
│   └── errorHandler.ts             — Централизиран error handler (скрива stack trace в production)
├── services/
│   ├── auth.service.ts             — register, login, refreshToken (с rotation), logout, getMe, verifyEmail, forgotPassword, resetPassword, resendVerification
│   ├── user.service.ts             — updateProfile, changePassword
│   └── household.service.ts        — createHousehold, joinHousehold, getHouseholdById
├── controllers/
│   ├── auth.controller.ts          — HTTP-specific logic, делегира към service
│   ├── user.controller.ts          — HTTP-specific logic за user management
│   └── household.controller.ts     — HTTP-specific logic за households
├── routes/
│   ├── auth.routes.ts              — RESTful routing с middleware chaining
│   ├── user.routes.ts              — User management routes
│   └── household.routes.ts         — Household routes
└── index.ts                        — Express app с helmet, CORS, rate limiting, всички routes, error handler
```

**Auth endpoints — работещи:**
```
POST   /api/auth/register              — Регистрация (201 + tokens, изпраща verification email)
POST   /api/auth/login                 — Вход (200 + tokens)
POST   /api/auth/refresh               — Refresh token с rotation (200 + new tokens)
POST   /api/auth/logout                — Изход, инвалидира refresh token (200, protected)
GET    /api/auth/me                    — Текущ потребител (200, protected)
POST   /api/auth/verify-email          — Верификация на имейл с токен (30-дневни токени)
POST   /api/auth/forgot-password       — Изпращане на reset email (rate-limited 3/15min)
POST   /api/auth/reset-password        — Нулиране на парола с токен (1-час expiry, форсира re-login)
POST   /api/auth/resend-verification   — Повторно изпращане на верификация (protected)
```

**Security имплементации:**
- JWT access token (15 min) + refresh token (7 days) с rotation
- Refresh token се пази hashed (bcrypt) в DB, select: false
- При подозрителен refresh (невалиден hash) — целият session се инвалидира
- Rate limiting: 20 req / 15 min на auth endpoints
- Password hashing: bcrypt с configurable salt rounds
- Helmet + CORS + централизиран error handler

**Environment variables (.env.example):**
```
PORT, NODE_ENV, FRONTEND_URL, MONGODB_URI,
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, BCRYPT_SALT_ROUNDS,
RESEND_API_KEY, FROM_EMAIL
```

### ✅ Завършено — Backend User Profile Management:

- `PATCH /api/users/profile` — обновяване на firstName, lastName, email (промяна на email задейства повторна верификация)
- `PATCH /api/users/password` — смяна на парола (изисква текуща парола)

**Файлове:** `controllers/user.controller.ts`, `services/user.service.ts`, `routes/user.routes.ts`, `validators/user.validator.ts`

---

### ✅ Завършено — Backend Стъпка 2: Household & Onboarding — ЗАВЪРШЕНА:

**Household model** (`models/household.model.ts`, `types/household.types.ts`):

```typescript
// Основни полета:
name: string;
livingArrangement: LivingArrangement;
totalMembers: number;
uiMode: 'solo' | 'couple' | 'family' | 'roommates' | 'multi_family';  // auto-derived
createdBy: Types.ObjectId;
inviteCode: string;  // UUID, auto-generated, unique index

// Members array (включва creator + placeholders):
members: [{
  userId?: Types.ObjectId;           // optional за placeholders (не са join-нали)
  nickname: string;
  relationship?: Relationship;       // optional за creator
  ageGroup: AgeGroup;
  role: 'owner' | 'admin' | 'member';
  participatesInFinances: boolean;
  participatesInTasks: boolean;
  familyGroup?: string;              // само за multi_family
  email?: string;                    // за email-matched join
  isCreator: boolean;
  joinedAt?: Date;                   // null за placeholders
}];

// Settings:
settings: {
  expenseSplitMethod: ExpenseSplitMethod;
  trackedExpenseTypes: ExpenseType[];
  currency: string;
  taskManagementEnabled: TaskManagementLevel;
  taskDistributionMethod?: TaskDistributionMethod;
};
```

**Имплементирани endpoints:**
```
POST   /api/households         — Създаване на household от onboarding survey данни ✅
POST   /api/households/join    — Присъединяване с invite код (email-matched placeholder) ✅
GET    /api/households/:id     — Информация за household (само за членове) ✅
```

**Ключови решения:**
- Invite системата е вградена — UUID код директно на Household модела, без отделен Invitation модел
- Join изисква email pre-registration от creator (email на placeholder трябва да съвпада с email-а на потребителя)
- UI mode се auto-derive-ва от livingArrangement: `alone`→solo, `couple`→couple, `family`→family, `roommates`/`other`→roommates, `multi_family`→multi_family
- Creator се добавя като owner member (`isCreator: true`) с данните от CreatorProfile

---

### ✅ Завършено — Frontend Auth система + Homepage (Стъпка 4):

**Файлова структура:**
```
frontend/src/
├── types/auth.types.ts             — User, AuthTokens, AuthResponse, LoginInput, RegisterInput, ApiSuccessResponse, ApiErrorResponse
├── lib/
│   ├── utils.ts                    — cn() helper за shadcn/ui
│   └── axios.ts                    — Axios instance с token injection + auto refresh с concurrent queue
├── api/auth.api.ts                 — register, login, logout, getMe
├── schemas/auth.schemas.ts         — Zod валидация (на български): loginSchema, registerSchema
├── contexts/
│   ├── auth.context.ts             — AuthContextValue interface + createContext (отделен от компонента заради Vite Fast Refresh)
│   └── AuthContext.tsx             — AuthProvider компонент (единствен export)
├── hooks/useAuth.ts                — useAuth hook (отделен файл заради Vite Fast Refresh)
├── components/
│   ├── ProtectedRoute.tsx          — ProtectedRoute + GuestRoute (с post-auth routing decision)
│   ├── FormField.tsx               — Reusable label + input + error за react-hook-form
│   └── ui/                         — shadcn/ui: Button, Input, Label, Card, Alert
├── pages/
│   ├── HomePage.tsx                — Landing page с hero, 6 feature cards, CTA
│   ├── LoginPage.tsx               — Login форма с zod + react-hook-form + server error handling
│   ├── RegisterPage.tsx            — Register форма (firstName, lastName, email, password, confirmPassword)
│   ├── GetStartedPage.tsx          — Placeholder (ще съдържа Create/Join household)
│   └── DashboardPage.tsx           — Placeholder (ще се изгради след onboarding)
├── App.tsx                         — BrowserRouter с guest/protected route guards
├── main.tsx                        — Entry point
└── index.css                       — Tailwind + shadcn CSS variables (light + dark)
```

**Routing структура:**
```
/                   — HomePage (public)
/login              — LoginPage (guest only → redirect ако е logged in)
/register           — RegisterPage (guest only → redirect ако е logged in)
/get-started        — GetStartedPage (protected)
/dashboard          — DashboardPage (protected)
*                   — Redirect to /
```

**Post-auth routing decision (имплементирано в GuestRoute):**
```
Authenticated user visits /login or /register:
  → user.households.length > 0 → /dashboard
  → user.households.length === 0 → /get-started
```

**Ключови frontend решения:**
- Axios interceptor с concurrent request queue (множество 401 → един refresh → всички retry)
- Token storage в localStorage чрез tokenStorage helper
- Vite Fast Refresh compatible: context, hook и provider са в 3 отделни файла
- Zod validation на български, огледална на backend правилата
- shadcn/ui с default design tokens (неутрална slate/zinc палитра)
- confirmPassword е frontend-only, не се изпраща към API

### ✅ Завършено — Frontend Onboarding Survey (Стъпка 5):

**Файлова структура:**
```
frontend/src/
├── types/onboarding.types.ts           — Enums (като const arrays), interfaces (CreatorProfile, MemberStructureEntry, OnboardingSurveyData), SelectOption arrays с English labels, conditional logic helpers (getMemberCountConstraints, getAvailableSplitMethods, shouldShowSplitMethod, shouldShowDistributionMethod, getDefaultRelationships, getDefaultAgeGroup, determineUIMode)
├── schemas/onboarding.schemas.ts       — Zod v4 валидация: per-step schemas, factory functions за contextual validation (createStepHouseholdStructureSchema, createStepFinancialPreferencesSchema, createStepTaskPreferencesSchema), full survey schema с cross-step superRefine
├── contexts/
│   ├── onboarding.context.ts           — OnboardingContextValue interface + createContext (Vite Fast Refresh compatible)
│   └── OnboardingContext.tsx           — OnboardingProvider: localStorage persistence, cascading resets при промяна на livingArrangement/totalMembers, payload assembly
├── hooks/useOnboarding.ts              — useOnboarding hook
├── components/onboarding/
│   ├── OnboardingSurvey.tsx            — Wizard container: progress bar + step card shell, routes to active step
│   ├── SurveyProgress.tsx              — Step indicator: numbered circles with connecting lines, completed/active/upcoming states
│   ├── SurveyNavigation.tsx            — Reusable Back/Continue footer for all steps
│   └── steps/
│       ├── StepLivingArrangement.tsx   — Household name, radio card grid, conditional "other" field, +/- member stepper with auto-adjustment
│       ├── StepHouseholdStructure.tsx   — Creator profile card (nickname, age, participation toggles) + dynamic member cards (useFieldArray) with relationship, age, finance/task switches, conditional familyGroup
│       ├── StepFinancialPreferences.tsx — Split method radio cards (filtered per arrangement), expense type checkbox grid, currency pills
│       ├── StepTaskPreferences.tsx      — Task management level + conditional distribution method
│       └── StepReview.tsx              — Read-only summary with Edit buttons per section, creator highlighted, final "Create Household" submit
└── pages/GetStartedPage.tsx            — Three-view state machine: choice → create → join (join is placeholder)
```

**Ключови решения:**

**Creator Profile:**
Създателят на домакинството има собствен профил (`CreatorProfile`) в Step 2 — nickname, ageGroup, participatesInFinances, participatesInTasks, и familyGroup (за multi_family). Отделен е от `memberStructure` масива, тъй като няма relationship поле (не може да имаш relationship към себе си).

**Step 2 никога не се пропуска:**
Дори за `alone` mode, Step 2 винаги се показва — потребителят задава своя nickname и age group. За `alone` се показва само "Your profile" секцията, без допълнителни членове. Всичките 5 стъпки са винаги активни.

**Cross-field validation (defense in depth):**
`livingArrangement` и `totalMembers` са валидирани в синхрон — стъпковият schema (`superRefine`) и UX auto-adjustment работят заедно. Например, при `couple` → totalMembers е заключен на 2, stepper е disabled, а schema отказва стойност ≠ 2.

**Contextual schema factories:**
Step 2, 3, 4 използват factory functions (`createStepHouseholdStructureSchema(arrangement, totalMembers)`) които генерират правилния Zod schema спрямо данните от предишни стъпки. Това позволява различни validation rules per arrangement.

**Cascading resets:**
Когато `livingArrangement` се промени, Step 2/3/4 data се нулира. Когато `totalMembers` се промени, Step 2 data се нулира. Това предотвратява stale data от предишни конфигурации.

**UI text в английски:**
Всички labels и опции са на английски (не български), по решение на потребителя.

**shadcn/ui компоненти използвани:**
Button, Card, Input, Label, Alert, Checkbox, Switch, Sheet + custom RadioCard pattern (button с dot indicator)

**Vite Fast Refresh compatible:**
OnboardingContext следва същия 3-файлов pattern като AuthContext: context.ts → Context.tsx → hook.ts

---

### ✅ Завършено — Submit + Join Flow (Стъпки 5–6):

- `StepReview.tsx` → вече submit-ва към `POST /api/households` и redirect-ва към `/dashboard`
- `GetStartedPage.tsx` → три-view state machine: choice → create (OnboardingSurvey) → join (форма с invite код + nickname)
- Post-auth routing decision напълно имплементирана: `households.length > 0` → `/dashboard`, иначе → `/get-started`

---

### ✅ Завършено — Finance Mode & Household Settings (Backend):

**Нови полета на Household модела:**
- `settings.financeMode`: `'joint' | 'split'`
- `settings.customSplitPercentage`: number (1–99)
- `settings.expenseSplitMethod` (вече включва `equal`, `income_based`, `custom`)
- `members[].monthlyIncome`: number (за income-based split)
- `settlements[]`: subdocument (month, amount, settledByUserId, settledAt)

**Нови endpoints:**
```
PATCH  /api/households/:id/settings              — обновяване на financeMode, splitMethod, customSplitPercentage
PATCH  /api/households/:id/members/me/income     — задаване на monthlyIncome
POST   /api/households/:id/settlements           — записване на settle-up транзакция
```

---

### ✅ Завършено — Expense System (Backend):

**Expense модел** (`models/expense.model.ts`, `types/expense.types.ts`):
- `householdId`, `createdByUserId`, `paidByUserId` (optional — null = unclaimed)
- `recurringExpenseId` (ref към RecurringExpense template)
- `description`, `amount`, `category` (ExpenseType), `date`, `notes`
- `isResolved`, `resolvedAt`, `resolvedByUserId`

**Endpoints:**
```
GET    /api/households/:id/expenses                        — листване по месец (YYYY-MM)
POST   /api/households/:id/expenses                        — добавяне
PATCH  /api/households/:id/expenses/:expenseId             — редактиране
DELETE /api/households/:id/expenses/:expenseId             — изтриване
POST   /api/households/:id/expenses/:expenseId/claim       — claim на некlaimed разход
POST   /api/households/:id/expenses/:expenseId/resolve     — маркиране като уредено
```

---

### ✅ Завършено — Recurring Expenses (Backend):

**RecurringExpense модел** (`models/recurring-expense.model.ts`):
- `householdId`, `createdByUserId`, `description`, `amount`, `category`
- `interval`: `'monthly'`
- `payerMode`: `'fixed'` (auto-claimed на createdBy) | `'open_to_claim'` (started unclaimed)
- `isActive`: boolean (soft delete)
- `startDate`, `lastGeneratedMonth`

**Endpoints:**
```
POST   /api/households/:id/recurring-expenses              — създаване на template
GET    /api/households/:id/recurring-expenses              — листване на активни templates
PATCH  /api/households/:id/recurring-expenses/:recurringId — редактиране
DELETE /api/households/:id/recurring-expenses/:recurringId — деактивиране (soft delete)
```

**Scheduler:**
- `node-cron` — cron job стартира след `connectDatabase()` в `index.ts`
- Всеки ден: генерира expense instances за текущия месец (идемпотентно)

---

### ✅ Завършено — Couple Dashboard (Frontend):

**Файлове:**
- `FrontEnd/src/components/dashboard/couple/CoupleDashboard.tsx` — главен компонент
- `FrontEnd/src/components/dashboard/shared/AddExpenseForm.tsx` — добавяне + редактиране (prop: `onSaved`)
- `FrontEnd/src/components/dashboard/shared/IncomeEntryCard.tsx` — задаване на monthlyIncome
- `FrontEnd/src/api/expense.api.ts` — list, create, update, delete, claim, resolve
- `FrontEnd/src/api/household.api.ts` — updateSettings, recordSettlement, updateMemberIncome
- `FrontEnd/src/api/recurring-expense.api.ts` — create, list, update, deactivate
- `FrontEnd/src/types/recurring-expense.types.ts` — нов файл

**Функционалности на CoupleDashboard:**
- Два таба: **Overview** (stat cards) + **Expenses** (пълен списък)
- `StatsRow` — Total Spent, Balance (само unresolved), Your Payments
- Finance mode toggle: `joint` | `split` (само за admin; persist към backend)
- Split method: `equal` | `income_based` | `custom` (admin only)
- Custom split % slider — persist на `onMouseUp` / `onTouchEnd`
- Month navigation (← →) с shared `currentMonth` state
- Add / Edit / Delete expense
- Claim expense (за unclaimed разходи)
- Resolve expense (маркиране като уредено между двойката)
- "Mark as Settled" → confirm flow → `recordSettlement`
- Recurring expenses panel — листване + деактивиране
- Category filter pills — прилага се **client-side** (не засяга Overview stats)
- Income entry card когато `income_based` е избрано

---

### ✅ Завършено — Environment & Infrastructure:

- Split JWT secrets: `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` (отделни)
- `.env.example` + `docker-compose.yml` обновени с новите env vars
- Email service конфигурация в env examples

---

### ❌ Какво липсва (предстои):
- ~~Household модел и цялата onboarding система (Backend Стъпка 2)~~ ✅ Завършена
- Invitation система (Backend Стъпка 3) — **Опростена**: прост UUID invite код вече е имплементиран на Household модела; отделен Invitation модел (multi-use кодове, expiry, деактивиране) предстои
- ~~Onboarding Survey UI (Frontend Стъпка 5)~~ ✅ Завършена
- ~~Submit логика в StepReview.tsx~~ ✅ Завършена
- ~~Join Flow UI~~ ✅ Завършена
- ~~Post-onboarding routing и dashboard~~ ✅ Завършена
- Solo mode dashboard
- Roommates/Family/Multi-family dashboards
- Task management system
- Budget goals & spending analytics
- AI predictions
- Gamification (roommates)
- Move-out settlement
- Full invitation system (multi-use codes, expiry, deactivation)

---

## 2. USER AUTHENTICATION FLOW

### 2.1. Общ flow

```
Register (email, password, firstName, lastName)
    → Създава User в DB
    → Връща accessToken + refreshToken

Login (email, password)
    → Верифицира credentials
    → Връща accessToken + refreshToken

Authenticated Request
    → Authorization: Bearer <accessToken>
    → JWT middleware верифицира и attach-ва user към req

Token Refresh
    → POST /auth/refresh с refreshToken
    → Връща нов accessToken
```

### 2.2. Разширение на User модела

Текущият User модел трябва да се разшири с:

```typescript
// Нови полета към IUser
phoneNumber?: string;
avatarUrl?: string;
households: Types.ObjectId[];       // ref: 'Household'
activeHousehold?: Types.ObjectId;   // Текущо избраното домакинство
preferences: {
  language: string;                 // default: 'bg'
  currency: string;                 // default: 'BGN'
  notifications: {
    email: boolean;                 // default: true
    push: boolean;                  // default: false
    frequency: 'instant' | 'daily' | 'weekly';  // default: 'daily'
  };
};
isEmailVerified: boolean;           // default: false
refreshToken?: string;              // Hashed refresh token (select: false)
```

### 2.3. Auth endpoints

```
POST   /api/auth/register     — Регистрация
POST   /api/auth/login        — Вход
POST   /api/auth/refresh      — Refresh на access token
POST   /api/auth/logout       — Изход (инвалидира refresh token)
GET    /api/auth/me           — Текущ потребител (protected)
```

### 2.4. JWT стратегия

- **Access Token:** кратък живот (15 минути), съдържа `userId` и `email`
- **Refresh Token:** дълъг живот (7 дни), записва се hashed в User модела
- При logout: refresh token се изтрива от DB
- При refresh: стар refresh token се инвалидира, издава се нов (rotation)

### 2.5. Auth Middleware

```typescript
// authMiddleware — верифицира JWT от Authorization header
// Attach-ва decoded user data към req.user
// Връща 401 при невалиден/expired token

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}
```

### 2.6. Validation (express-validator)

**Register validation:**
- email: isEmail, normalizeEmail
- password: min 8 chars, поне 1 главна, 1 малка, 1 цифра
- firstName: trim, 2-50 chars, not empty
- lastName: trim, 2-50 chars, not empty

**Login validation:**
- email: isEmail, normalizeEmail
- password: not empty

---

## 3. POST-AUTH ROUTING DECISION

След успешен login, frontend-ът определя къде да насочи потребителя:

```
Login Success → Fetch user data (GET /api/auth/me)
    │
    ├─ user.households.length === 0
    │     → Navigate to "/get-started" (Create or Join screen)
    │
    └─ user.households.length > 0
          → Navigate to "/dashboard"
```

### Get Started екран — два пътя:

**Път 1: "Създай домакинство"**
→ Onboarding Survey (5 стъпки) → Household се създава → Dashboard

**Път 2: "Присъедини се към домакинство"**
→ Въведи invite код → Mini-form (nickname, participation) → Dashboard

---

## 4. ONBOARDING SURVEY — ПОДРОБНА СПЕЦИФИКАЦИЯ

Survey-то се попълва САМО при създаване на ново домакинство (не при join).
Данните се submit-ват наведнъж при финализиране (не step-by-step save).
Frontend пази state в React state (или localStorage за persistence при refresh).

### 4.1. Стъпка 1: Тип домакинство (Living Arrangement)

**Поле 1: `householdName`**
- Тип: text input
- Задължително: да
- Валидация: 2–50 символа, trimmed
- Примери: "Апартамент Витоша", "Нашата къща"

**Поле 2: `totalMembers`**
- Тип: number input (stepper +/-)
- Задължително: да
- Валидация: min 1, max 20, integer
- Включва самия потребител

**Поле 3: `livingArrangement`**
- Тип: single select (radio cards)
- Задължително: да
- Валидни стойности:

```typescript
enum LivingArrangement {
  ALONE = 'alone',                    // "Живея сам/сама"
  COUPLE = 'couple',                  // "Живея с партньор/съпруг(а)"
  FAMILY = 'family',                  // "Живея с родители/семейство"
  ROOMMATES = 'roommates',            // "Живея със съквартиранти"
  MULTI_FAMILY = 'multi_family',      // "Няколко семейства заедно"
  OTHER = 'other'                     // "Друго"
}
```

**Условна логика:**
- `alone` → Стъпка 2 показва само "Your profile" (без допълнителни членове)
- `couple` → totalMembers автоматично се заключва на 2
- `other` → показва допълнително text поле `livingArrangementOther` (max 100 символа)

---

### 4.2. Стъпка 2: Структура на домакинството (Household Structure)

**Важна промяна:** Step 2 НИКОГА не се пропуска. Дори за `alone` — потребителят задава своя профил (nickname, age group, participation preferences). За `alone` се показва само "Your profile" секцията без допълнителни членове.

**Поле 1: `creatorProfile` — профил на създателя:**

```typescript
interface CreatorProfile {
  nickname: string;                      // 1-30 символа, задължително
  ageGroup: AgeGroup;                    // Задължително
  participatesInFinances: boolean;       // Default: true
  participatesInTasks: boolean;          // Default: true
  familyGroup?: string;                  // Само за multi_family mode, max 50 символа
}
```

Създателят няма `relationship` поле (не може да има relationship към себе си). Визуално се показва в отделна "Your profile" карта с primary accent.

**Поле 2: `memberStructure` — масив от обекти (другите членове):**

```typescript
interface MemberStructureEntry {
  nickname: string;                    // 1-30 символа, задължително
  relationship: Relationship;          // Задължително
  ageGroup: AgeGroup;                  // Задължително
  participatesInFinances: boolean;     // Default: true
  participatesInTasks: boolean;        // Default: true
  familyGroup?: string;               // Само за multi_family mode, max 50 символа
}
```

**Relationship enum:**

```typescript
enum Relationship {
  PARTNER = 'partner',       // Партньор/Съпруг(а)
  PARENT = 'parent',         // Родител
  CHILD = 'child',           // Дете
  SIBLING = 'sibling',       // Брат/Сестра
  FRIEND = 'friend',         // Приятел
  ROOMMATE = 'roommate',     // Съквартирант
  RELATIVE = 'relative',     // Роднина
  OTHER = 'other'            // Друго
}
```

**AgeGroup enum:**

```typescript
enum AgeGroup {
  CHILD = 'child',           // 0-12
  TEENAGER = 'teenager',     // 13-17
  ADULT = 'adult',           // 18-64
  SENIOR = 'senior'          // 65+
}
```

**Валидации:**
- Брой entries = `totalMembers - 1`
- Ако `ageGroup === 'child'` → `participatesInFinances` автоматично `false`
- `familyGroup` е задължителен САМО при `multi_family`

**Conditional behavior по livingArrangement:**

| livingArrangement | Поведение |
|---|---|
| `alone` | Показва само "Your profile" секция, без допълнителни членове |
| `couple` | "Your profile" + 1 член, relationship default `partner`, ageGroup default `adult` |
| `family` | "Your profile" + N членове, default suggestions: `parent`, `sibling`, `child` |
| `roommates` | "Your profile" + N членове, default relationship: `roommate`, default ageGroup: `adult` |
| `multi_family` | "Your profile" + N членове, пълна форма + задължително `familyGroup` поле навсякъде |
| `other` | "Your profile" + N членове, пълна форма, без defaults |

---

### 4.3. Стъпка 3: Финансови предпочитания (Financial Preferences)

**Поле 1: `expenseSplitMethod`**
- Тип: single select (radio cards с описание)
- Задължително: да

```typescript
enum ExpenseSplitMethod {
  EQUAL = 'equal',                   // "Равномерно между всички"
  INCOME_BASED = 'income_based',     // "Според приходите"
  USAGE_BASED = 'usage_based',       // "Според консумацията"
  SHAPLEY = 'shapley',               // "Математически справедливо (Shapley Value)" — recommended
  CUSTOM = 'custom'                  // "Персонализирано"
}
```

**Conditional visibility:**
- `alone` → секцията за split method се скрива, показва само `trackedExpenseTypes` и `currency`
- `couple` → показва само `equal`, `income_based`, `custom` (без `shapley` и `usage_based`)
- `family` → всички опции, `shapley` не е default
- `roommates` → всички опции, `shapley` е recommended
- `multi_family` → всички опции, `shapley` е recommended

**Поле 2: `trackedExpenseTypes`**
- Тип: multi-select (checkboxes)
- Задължително: минимум 1 избрана
- Валидни стойности:

```typescript
enum ExpenseType {
  RENT = 'rent',                     // Наем
  UTILITIES = 'utilities',           // Комунални (ток, вода, газ)
  INTERNET = 'internet',             // Интернет и ТВ
  GROCERIES = 'groceries',           // Хранителни стоки
  CLEANING = 'cleaning',             // Битова химия
  SUBSCRIPTIONS = 'subscriptions',   // Абонаменти (Netflix и т.н.)
  OTHER = 'other'                    // Други общи разходи
}
```

**Поле 3: `currency`**
- Тип: select dropdown
- Default: `BGN`
- Валидни стойности: `BGN`, `EUR`, `USD`, `GBP`
- Задължително: да

---

### 4.4. Стъпка 4: Задачи и отговорности (Task Preferences)

**Поле 1: `taskManagementEnabled`**
- Тип: single select (radio)
- Задължително: да

```typescript
enum TaskManagementLevel {
  FULL = 'full',             // "Пълно управление на задачите"
  BASIC = 'basic',           // "Само основни задачи"
  DISABLED = 'disabled'      // "Не, само финанси"
}
```

**Поле 2: `taskDistributionMethod`** — показва се САМО ако task management не е `disabled` И arrangement не е `alone`
- Тип: single select (radio cards)
- Задължително: да (когато се показва)

```typescript
enum TaskDistributionMethod {
  ROTATION = 'rotation',       // "Ротация — всеки седмица различен отговорник"
  FIXED = 'fixed',             // "Фиксирано — всеки си има свои задачи"
  AI_OPTIMIZED = 'ai',         // "AI-базирано оптимално разпределение" — recommended
  VOLUNTARY = 'voluntary'      // "Свободно — всеки избира какво ще прави"
}
```

**Conditional visibility:**
- `alone` → `taskDistributionMethod` е скрит (няма разпределение)
- `couple` → показва `rotation`, `fixed`, `voluntary` (без `ai`)
- `disabled` → `taskDistributionMethod` е скрит

---

### 4.5. Стъпка 5: Преглед и потвърждение (Review & Confirm)

Не събира нови данни. Показва резюме:
- Секция "Домакинство" — име, тип, брой членове
- Секция "Членове" — creator profile (highlighted с "(you)" badge) + списък с останалите членове: nickname, relationship, participation flags
- Секция "Финанси" — метод на разделяне, проследявани разходи, валута
- Секция "Задачи" — ниво на управление, метод на разпределение
- "Edit" бутон до всяка секция → `goToStep(n)` — връща на съответната стъпка
- "Create Household" бутон → submit

---

### 4.6. Пълна data structure при submit

```typescript
interface OnboardingSurveyData {
  // Стъпка 1
  householdName: string;
  totalMembers: number;
  livingArrangement: LivingArrangement;
  livingArrangementOther?: string;       // Само при 'other'

  // Стъпка 2
  creatorProfile: CreatorProfile;        // Профил на създателя
  memberStructure: MemberStructureEntry[]; // Празен масив при 'alone'

  // Стъпка 3
  expenseSplitMethod: ExpenseSplitMethod;
  trackedExpenseTypes: ExpenseType[];    // Минимум 1
  currency: string;

  // Стъпка 4
  taskManagementEnabled: TaskManagementLevel;
  taskDistributionMethod?: TaskDistributionMethod;  // undefined при 'disabled' или 'alone'
}

interface CreatorProfile {
  nickname: string;                      // 1-30 символа
  ageGroup: AgeGroup;                    // Задължително
  participatesInFinances: boolean;       // Default: true
  participatesInTasks: boolean;          // Default: true
  familyGroup?: string;                  // Само за multi_family, max 50 символа
}
```

---

## 5. UI MODES — ПЕРСОНАЛИЗАЦИЯ БАЗИРАНА НА SURVEY

### 5.1. Mode determination logic

```typescript
function determineUIMode(arrangement: LivingArrangement, totalMembers: number): UIMode {
  if (arrangement === 'alone' || totalMembers === 1) return 'solo';
  if (arrangement === 'couple' || totalMembers === 2) return 'couple';
  if (arrangement === 'multi_family') return 'multi_family';
  if (arrangement === 'family') return 'family';
  return 'roommates'; // roommates, other
}

type UIMode = 'solo' | 'couple' | 'family' | 'roommates' | 'multi_family';
```

### 5.2. Solo Mode

**Кога:** `alone` или `totalMembers === 1`
**Фокус:** Личен expense tracker и бюджетиране

Налични функционалности:
- Expense tracking (добавяне, категоризиране, бележки)
- Budget goals — месечни лимити по категория с progress bar
- Spending analytics — графики за лични разходи по време и категория
- Bill reminders — напомняния за предстоящи сметки
- AI predictions — прогноза на бъдещи сметки базирана на history
- Personal to-do — минимален task manager без разпределение

Изключени функционалности:
- Split логика (няма с кого)
- Balance matrix
- Members / Invite система
- Gamification
- Settlement

---

### 5.3. Couple Mode

**Кога:** `couple`
**Фокус:** Споделени финанси между двама с опция за joint или split бюджет

Налични функционалности:
- Expense tracking
- Split methods: само `equal`, `income_based`, `custom`
- Прост баланс — 1 число: "+150 лв." = "партньорът ти дължи 150 лв."
- Опростено task management (без gamification)

**Уникални функционалности:**

1. **Finance Mode Toggle:**
```typescript
enum CoupleFinanceMode {
  JOINT = 'joint',    // Всичко е общо, няма баланс — общ бюджет
  SPLIT = 'split'     // Всеки следи какво е платил, има баланс
}
```
В `joint` mode: общ dashboard без "кой дължи на кого"
В `split` mode: баланс между двамата

2. **Shared Goals:**
Споделени цели за спестяване (ваканция, ремонт и т.н.) с progress bar и принос на всеки.

Изключени функционалности:
- Shapley Value (безсмислен за 2-ма)
- Balance matrix (само 1 баланс)
- Gamification
- Settlement optimizer

---

### 5.4. Family Mode

**Кога:** `family`
**Фокус:** Йерархична структура с primary payer и фиксирани вноски

Налични функционалности:
- Expense tracking
- Split methods: `equal`, `income_based`, `custom`, `contribution_based`
- Shapley Value — наличен, но не е default
- Опростен баланс — всеки спрямо primary payer

**Уникални функционалности:**

1. **Primary Payer:**
```typescript
familySettings: {
  primaryPayerId: Types.ObjectId;      // Родителят, който плаща повечето
  contributions: [{
    memberId: Types.ObjectId,
    monthlyAmount: number,             // Фиксирана месечна вноска
    isPercentage: boolean              // Или % от общите разходи
  }]
}
```
Пример: бащата плаща всички сметки, синът допринася 300лв/месец.
Dashboard на бащата: "Очаквани вноски: 300лв от Иван"
Dashboard на Иван: "Месечна вноска: 300лв — платена/неплатена"

2. **Dependent Tracking:**
Членове с `ageGroup: 'child'` или `participatesInFinances: false` се виждат като консуматори в разходите. Храната се купува за 4 души, но плащат само 2-ма. Различно от roommates, където нефинансов участник просто не е в split-а.

3. **Top-down Task Assignment:**
Admin (родител) разпределя задачите. Другите виждат само какво им е възложено. Не могат да claim-нат задачи самостоятелно.

4. **Family Budget Overview:**
Агрегиран изглед на всички разходи на семейството — колко харчим общо, по категории, тенденции.

Изключени функционалности:
- Gamification (неуместно за семеен контекст)
- Move-out settlement
- Voluntary task claiming

---

### 5.5. Roommates Mode

**Кога:** `roommates`, `other`
**Фокус:** Равноправно разпределение с пълна прозрачност и мотивация

Налични функционалности:
- Expense tracking
- Всички split methods, Shapley е recommended default
- AI task distribution — recommended default
- Democratic task management с voluntary claiming

**Уникални функционалности:**

1. **Full Balance Matrix (NxN):**
```
         Иван   Петър   Мария
Иван      —     +50     -30
Петър    -50      —     +80
Мария    +30    -80       —
```

2. **Settlement Optimizer:**
Минимизира броя транзакции за уреждане на всички баланси.
Вместо 6 транзакции между 4 души → 2-3 оптимални плащания.

3. **Gamification:**
```typescript
interface TaskGamification {
  streaks: number;                    // Поредни седмици без пропусната задача
  monthlyPoints: number;              // Точки от завършени задачи
  badges: Badge[];                    // "Cleaning Champion", "Shopping Star"
  leaderboard: LeaderboardEntry[];    // Класация между съквартирантите
}
```

4. **Move-out Settlement:**
Когато съквартирант напуска — финален баланс, уреждане на дългове, премахване от бъдещи splits.

5. **Voluntary Task Claiming:**
Задачите се публикуват и всеки може да claim-не задача. Различно от family top-down.

---

### 5.6. Multi-Family Mode

**Кога:** `multi_family`
**Фокус:** Двунивово разпределение — между семейства и вътре в семейства

Налични функционалности:
- Всичко от Roommates mode (между семействата)
- Всичко от Family mode (вътре в семействата)

**Уникални функционалности:**

1. **Family Grouping:**
Членовете са групирани по `familyGroup`. Всяка група има свой primary payer и вътрешна структура.

2. **Two-Level Split:**
```
Сметка за ток: 200лв

Ниво 1 (между семейства):
  Семейство Иванови (3 души): 120лв
  Семейство Петрови (2 души): 80лв

Ниво 2 (вътре в Семейство Иванови):
  Баща Иванов (primary payer): покрива всичко
  Син Иванов: вноска 40лв
```

3. **Group Balance View:**
Баланс показан на две нива — между семействата и вътре в тях.

4. **Per-Family Dashboards:**
Всяко семейство може да види собствените си разходи и баланси отделно.

---

### 5.7. Feature Matrix (обобщение)

| Feature | Solo | Couple | Family | Roommates | Multi-Family |
|---|---|---|---|---|---|
| Expense tracking | ✅ | ✅ | ✅ | ✅ | ✅ |
| Budget goals | Personal | Shared goals | Family budget | Individual | Per-family |
| Primary payer | — | — | ✅ | — | ✅ per family |
| Fixed contributions | — | — | ✅ | — | ✅ |
| Dependent tracking | — | — | ✅ | — | ✅ |
| Finance mode toggle | — | ✅ joint/split | — | — | — |
| Balance | — | 1 число | vs primary payer | NxN matrix | Group matrix |
| Settlement optimizer | — | — | — | ✅ | ✅ |
| Shapley Value | — | — | Optional | ✅ Default | ✅ |
| AI predictions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Task style | Personal to-do | Shared | Top-down | Democratic + claim | Hybrid |
| Gamification | — | — | — | ✅ | Optional |
| Move-out settlement | — | — | — | ✅ | ✅ |
| Family grouping | — | — | — | — | ✅ |
| Two-level split | — | — | — | — | ✅ |

---

## 6. HOUSEHOLD MODEL

### 6.1. Mongoose Schema

```typescript
interface IHousehold extends Document {
  name: string;
  admin: Types.ObjectId;
  uiMode: 'solo' | 'couple' | 'family' | 'roommates' | 'multi_family';

  members: [{
    userId?: Types.ObjectId;              // null за placeholder (още не е join-нал)
    nickname: string;
    relationship: Relationship;
    ageGroup: AgeGroup;
    participatesInFinances: boolean;
    participatesInTasks: boolean;
    familyGroup?: string;                 // Само за multi_family
    isActive: boolean;
    joinedAt?: Date;                      // null за placeholder
  }];

  onboardingData: {
    livingArrangement: LivingArrangement;
    livingArrangementOther?: string;
    totalExpectedMembers: number;
    expenseSplitMethod: ExpenseSplitMethod;
    trackedExpenseTypes: ExpenseType[];
    taskManagementEnabled: TaskManagementLevel;
    taskDistributionMethod?: TaskDistributionMethod;
  };

  settings: {
    currency: string;
    defaultSplitMethod: ExpenseSplitMethod;
  };

  // Couple-specific
  coupleSettings?: {
    financeMode: 'joint' | 'split';
    sharedGoals: [{
      name: string;
      targetAmount: number;
      currentAmount: number;
      contributions: [{ memberId: Types.ObjectId; amount: number }];
    }];
  };

  // Family-specific
  familySettings?: {
    primaryPayerId: Types.ObjectId;
    contributions: [{
      memberId: Types.ObjectId;
      monthlyAmount: number;
      isPercentage: boolean;
    }];
  };

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 7. INVITATION SYSTEM

### ✅ 7.0. Текущо имплементирано (прост invite)

Простата invite система е вградена директно в Household модела:
- `inviteCode`: UUID, auto-generated при създаване, unique index
- `POST /api/households/join` валидира кода и изисква email на потребителя да съвпада с email на placeholder член
- Понастоящем join е ограничен до email pre-registration — creator трябва предварително да е добавил email-а на новия член

Отделен Invitation модел **не е имплементиран** — предстои в Стъпка 3.

### 7.1. Планиран Invitation Model (Стъпка 3 — предстои)

```typescript
interface IInvitation extends Document {
  householdId: Types.ObjectId;           // ref: 'Household'
  code: string;                          // Уникален, 8 символа (напр. "HM-A3X9K2")
  invitedBy: Types.ObjectId;             // ref: 'User'
  type: 'single_use' | 'multi_use';
  maxUses: number;                       // Default: 1 за single_use
  currentUses: number;                   // Default: 0
  expiresAt: Date;                       // Default: 48-72 часа от създаването
  isActive: boolean;                     // Default: true
  createdAt: Date;
}
```

### 7.2. Планиран Invite Flow (Стъпка 3 — предстои)

**Създаване на покана (от admin):**
```
POST /api/invitations/create
Body: { householdId, type?, maxUses?, expiresInHours? }
→ Генерира уникален код
→ Връща { code, expiresAt }
```

**Присъединяване (планиран разширен flow — open invite link за всеки):**
```
POST /api/households/join
Body: { inviteCode, nickname, participatesInFinances?, participatesInTasks? }
→ Валидира код (активен, не е expired, не е exhausted)
→ Определя кои полета са editable спрямо uiMode на household-а
→ Ако family mode: игнорира client-side participatesInFinances/participatesInTasks, взима от placeholder
→ Ако roommates/couple/multi_family: приема стойностите от потребителя
→ Свързва го с placeholder entry (ако nickname съвпада) или създава нов member
→ Добавя household в user.households
→ Връща household data
```

**Invite Link:**
URL формат: `app.com/join/{code}`
- Нерегистриран потребител → Register → автоматично join
- Регистриран потребител → Login → автоматично join

### 7.3. Join форма и permission logic по UI mode

Когато потребител се присъединява, той НЕ попълва пълното survey — домакинството вече е конфигурирано.
Вместо това вижда кратка join форма, чиито полета са заключени или редактируеми в зависимост от UI mode-а на домакинството.

**Validate endpoint (преди join) връща контекст за формата:**

```typescript
// GET /api/invitations/:code/validate — response
interface InviteValidationResponse {
  householdName: string;
  uiMode: UIMode;
  memberCount: number;

  // Ако има matching placeholder (по nickname или позиция)
  expectedRole?: {
    nickname: string;
    relationship: Relationship;
    participatesInFinances: boolean;
    participatesInTasks: boolean;
  };

  // Кои полета потребителят може да редактира
  editableFields: {
    nickname: boolean;                   // Винаги true
    participatesInFinances: boolean;     // Зависи от mode
    participatesInTasks: boolean;        // Зависи от mode
  };
}
```

**Editability matrix по UI mode:**

| Поле | Family | Roommates | Couple | Multi-Family |
|---|---|---|---|---|
| `nickname` | ✏️ Показва от placeholder, може да редактира | ✏️ Въвежда сам | ✏️ Въвежда сам | ✏️ Въвежда сам |
| `participatesInFinances` | 🔒 Заключено от админ | ✏️ Избира сам | ✏️ Избира сам | ✏️ Избира сам |
| `participatesInTasks` | 🔒 Заключено от админ | ✏️ Избира сам | ✏️ Избира сам | ✏️ Избира сам |
| `familyGroup` | — | — | — | 🔒 Заключено от админ |

**Защо family mode е заключен:**
В семейна среда, родителят (админът) е определил структурата при onboarding — знае, че 12-годишното дете не участва финансово. Няма смисъл детето да override-не тази настройка при join. Административното решение има приоритет.

**Защо roommates/couple са отключени:**
Всички са равноправни възрастни. Всеки сам решава нивото си на участие. Ако нов съквартирант не иска да участва в задачите — негово решение.

**Защо multi_family заключва `familyGroup`:**
Принадлежността към семейство е структурно решение на админа — членът не може сам да реши в кое семейство попада. Но `participatesInFinances` и `participatesInTasks` са лични решения.

**Backend enforcement:**

```typescript
// В HouseholdService.joinHousehold()
function resolveJoinData(
  household: IHousehold,
  userInput: JoinInput,
  placeholder?: MemberEntry
): ResolvedMemberData {

  const isAdminControlled = household.uiMode === 'family';

  return {
    nickname: userInput.nickname,  // Винаги от потребителя

    participatesInFinances: isAdminControlled && placeholder
      ? placeholder.participatesInFinances     // Family: от админа
      : userInput.participatesInFinances,      // Останалите: от потребителя

    participatesInTasks: isAdminControlled && placeholder
      ? placeholder.participatesInTasks        // Family: от админа
      : userInput.participatesInTasks,         // Останалите: от потребителя

    familyGroup: household.uiMode === 'multi_family' && placeholder
      ? placeholder.familyGroup                // Multi-family: от админа
      : undefined,
  };
}
```

**Важно: Админът винаги може да промени настройките после.**
Независимо от mode-а, админът има достъп до member management секция, където може да редактира `participatesInFinances`, `participatesInTasks` и други полета на всеки член. Така ако съквартирант си избере "не участвам в задачи" и останалите не са съгласни — админът може да коригира.

```
PATCH /api/households/:id/members/:memberId
Body: { participatesInFinances?, participatesInTasks?, nickname?, ... }
→ Само admin може да извика
→ Обновява member data
```

---

## 8. API ENDPOINTS (пълен списък)

### Auth ✅
```
POST   /api/auth/register              — Регистрация (+ изпраща verification email)
POST   /api/auth/login                 — Вход
POST   /api/auth/refresh               — Refresh token
POST   /api/auth/logout                — Изход
GET    /api/auth/me                    — Текущ потребител (protected)
POST   /api/auth/verify-email          — Верификация на имейл (NEW ✅)
POST   /api/auth/forgot-password       — Заявка за нулиране на парола (NEW ✅)
POST   /api/auth/reset-password        — Нулиране на парола с токен (NEW ✅)
POST   /api/auth/resend-verification   — Повторно изпращане на верификация (NEW ✅, protected)
```

### User Management ✅
```
PATCH  /api/users/profile              — Обновяване на профил (protected) ✅
PATCH  /api/users/password             — Смяна на парола (protected) ✅
```

### Households ✅ (частично)
```
POST   /api/households                 — Създаване с onboarding data ✅
POST   /api/households/join            — Присъединяване с invite код ✅
GET    /api/households/:id             — Информация за household (само за членове) ✅
PATCH  /api/households/:id             — Редакция на settings (pending)
GET    /api/households/:id/members     — Списък с членове (pending)
PATCH  /api/households/:id/members/:memberId — Редакция на member (admin only) (pending)
DELETE /api/households/:id/members/:memberId — Премахване на член (admin only) (pending)
```

### Invitations (предстои — Стъпка 3)
```
POST   /api/invitations/create         — Създаване на покана
GET    /api/invitations/:code/validate — Валидация на код (публичен)
DELETE /api/invitations/:id            — Деактивиране на покана
```

---

## 9. ИМПЛЕМЕНТАЦИОНЕН РЕД

### ✅ Стъпка 1: Auth система (Backend) — ЗАВЪРШЕНА
1. ~~Fix `index.ts` бъга (двойно `app.listen()`)~~ — не беше наличен в кода
2. ✅ Разширяване на User model с нови полета (households, preferences, refreshToken, phoneNumber, avatarUrl)
3. ✅ Разширяване на User types (IUser, IRegisterInput, ILoginInput, IAuthResponse, IJwtPayload)
4. ✅ AuthService — register, login, refreshToken (с rotation), logout, getMe
5. ✅ Auth validation (express-validator) — register, login, refreshToken validators
6. ✅ JWT middleware (authMiddleware) с AuthRequest interface
7. ✅ Auth controller — HTTP-specific, делегира към service
8. ✅ Auth routes — RESTful с middleware chaining
9. ✅ Error handler middleware (централизиран) + AppError клас с фабрики
10. ✅ Rate limiting на auth endpoints (20 req / 15 min)

### ✅ Стъпка 2: Household & Onboarding (Backend) — ЗАВЪРШЕНА
1. ✅ Enum types файл (household.types.ts — всички enums, interfaces)
2. ✅ Household model (с members, settings, inviteCode UUID, createdBy)
3. ✅ Onboarding validation (household.validator.ts — createHousehold, joinHousehold)
4. ✅ HouseholdService — createHousehold, joinHousehold, getHouseholdById
5. ✅ Household controller
6. ✅ Household routes (POST /, POST /join, GET /:id)
7. ✅ UI mode determination (auto-derived от livingArrangement)
8. ✅ User profile management (user.service.ts, user.controller.ts, user.routes.ts, user.validator.ts)

### Стъпка 3: Invitation система (Backend) — частично
**Имплементирано:** прост UUID invite код на Household модела; `POST /api/households/join` с email matching.

**Предстои (разширен Invitation модел):**
1. Invitation model (single_use/multi_use, maxUses, expiresAt, isActive)
2. Code generation utility (уникални кодове)
3. InvitationService — create, validate, use (с expiry/exhaustion проверки)
4. Разширен join flow (open invite link, без email pre-registration)
5. Invitation controller
6. Invitation routes

### ✅ Стъпка 4: Auth система (Frontend) — ЗАВЪРШЕНА
1. ✅ TypeScript types (matching backend contracts) — auth.types.ts
2. ✅ API layer (axios instance с token injection + auto refresh с concurrent queue, auth API calls)
3. ✅ Auth context (AuthProvider + useAuth hook, разделени за Vite Fast Refresh compatibility)
4. ✅ Protected route wrapper (ProtectedRoute + GuestRoute с post-auth routing decision)
5. ✅ Login page (react-hook-form + zod + server error handling, на български)
6. ✅ Register page (firstName, lastName, email, password, confirmPassword, на български)
7. ✅ Token refresh logic (в axios interceptor с concurrent request queue)
8. ✅ Homepage (landing page с hero, 6 feature cards, CTA, navigation)
9. ✅ Placeholder pages (GetStartedPage, DashboardPage)
10. ✅ shadcn/ui components (Button, Input, Label, Card, Alert) + FormField reusable component

**Забележка за Vite Fast Refresh:**
Auth контекстът е разделен в 3 файла заради Vite изискване файлове да експортват само компоненти:
- `contexts/auth.context.ts` — AuthContextValue interface + createContext (данни)
- `contexts/AuthContext.tsx` — AuthProvider компонент (единствен export)
- `hooks/useAuth.ts` — useAuth hook (единствен export)

### ✅ Стъпка 5: Onboarding Survey (Frontend) — ЗАВЪРШЕНА (UI) / pending (submit)
1. ✅ Survey types и validation schemas — onboarding.types.ts (enums, interfaces, helpers), onboarding.schemas.ts (Zod v4, factory functions)
2. ✅ Multi-step wizard component — OnboardingSurvey.tsx (card shell + progress bar), SurveyProgress.tsx, SurveyNavigation.tsx
3. ✅ Step 1 component — StepLivingArrangement.tsx (radio cards, stepper, cross-field validation, auto-adjustment)
4. ✅ Step 2 component — StepHouseholdStructure.tsx (creator profile + dynamic member cards с useFieldArray, conditional logic)
5. ✅ Step 3 component — StepFinancialPreferences.tsx (split method radio cards, expense checkbox grid, currency pills)
6. ✅ Step 4 component — StepTaskPreferences.tsx (task level + conditional distribution method)
7. ✅ Step 5 component — StepReview.tsx (read-only summary, Edit buttons, final submit)
8. ✅ Survey state management — OnboardingContext.tsx (localStorage persistence, cascading resets, payload assembly)
9. ❌ Submit logic (StepReview.tsx → POST /api/households) — pending

**Забележка за Vite Fast Refresh:**
Onboarding контекстът следва същия 3-файлов pattern като Auth:
- `contexts/onboarding.context.ts` — OnboardingContextValue interface + createContext
- `contexts/OnboardingContext.tsx` — OnboardingProvider компонент
- `hooks/useOnboarding.ts` — useOnboarding hook

**Ключова промяна спрямо първоначалния план:**
Step 2 вече НИКОГА не се пропуска. Дори за `alone`, потребителят задава своя Creator Profile (nickname, ageGroup, participation). Всичките 5 стъпки са винаги активни. `CreatorProfile` е добавен като нов тип, отделен от `MemberStructureEntry` (няма relationship поле).

### Стъпка 6: Join Flow (Frontend) — ЧАСТИЧНО
1. ✅ Get Started page — GetStartedPage.tsx (three-view state machine: choice → create → join)
2. ❌ Join form component (invite code + mini-form) — placeholder pending
3. ❌ Invite link handling (URL parsing, redirect logic)

### Task: Finance Mode Selection in Onboarding
- **Branch**: `5-implement-couple-dashboard-and-algorithms` (добавено като подзадача)
- **Scope**: All non-solo living arrangements (couple, family, roommates, multi_family)
- **Backend**: Add `financeMode: 'joint' | 'split'` to household settings model (`household.model.ts`), types (`household.types.ts`), validator (`household.validator.ts`), and service (`household.service.ts`). `expenseSplitMethod` is now required only when `financeMode === 'split'`.
- **Frontend**: Collect finance mode in Step 3 of the onboarding survey (`StepFinancialPreferences.tsx`); hide split method picker when mode is joint; display in review step (`StepReview.tsx`). Updated types (`onboarding.types.ts`, `household.types.ts`), schema (`onboarding.schemas.ts`), and context (`OnboardingContext.tsx`).
- **Files**: `BackEnd/src/types/household.types.ts`, `BackEnd/src/models/household.model.ts`, `BackEnd/src/validators/household.validator.ts`, `BackEnd/src/services/household.service.ts`, `FrontEnd/src/types/onboarding.types.ts`, `FrontEnd/src/types/household.types.ts`, `FrontEnd/src/schemas/onboarding.schemas.ts`, `FrontEnd/src/contexts/OnboardingContext.tsx`, `FrontEnd/src/components/onboarding/steps/StepFinancialPreferences.tsx`, `FrontEnd/src/components/onboarding/steps/StepReview.tsx`

### Стъпка 7: Post-onboarding routing
1. Routing decision logic (households check)
2. Basic dashboard shell (placeholder, mode-aware)
3. Navigation setup per UI mode
