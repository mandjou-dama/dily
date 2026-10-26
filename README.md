# 🛍️ Dily

A modern mobile application built with **React Native (Expo)** that allows users to seamlessly discover, sell, and chat about products.  
The app provides an intuitive and smooth experience for **buyers** and **sellers** to connect, featuring a clean interface backed by its own **Fastify + PostgreSQL** API.

---

## 📱 Screenshots

![Screenshot_1](./assets/demo/demo_2.png)

---

## ✨ Features

### 👤 User Authentication

- [ ] Login with WhatsApp for a fast and frictionless experience
- [ ] OTP Verification Code support
- [ ] Seamless Profile setup

### 🏠 Discover (Buyers)

- [ ] Browse and search for products seamlessly
- [ ] Smooth and performant lists powered by FlashList

### 💵 Sell (Sellers)

- [ ] Create product listings
- [ ] Attach product images and descriptions

### 💬 Chat

- [ ] Integrated messaging system to contact sellers directly
- [ ] Real-time communication

### ⚙️ Profile

- [ ] Manage your personal information
- [ ] View and handle your listings

---

## 🛠️ Tech Stack

- **Mobile Framework:** React Native (Expo SDK 54, TypeScript)
- **Experimental:** React Compiler (React 19 beta)
- **Backend:** Fastify API (`apps/api`): PostgreSQL with Prisma, Redis, sign-in codes sent on WhatsApp, images resized with sharp
- **State & Data Fetching:** TanStack Query (React Query)
- **Navigation:** React Navigation v7
- **UI & Animations:** React Native Reanimated, Expo Blur / Glass Effect, Shopify React Native Skia
- **Storage:** Expo Secure Store (session)
- **Other Tools:** FlashList (for high-performance lists), Lucide React Native (icons), Keyboard Controller

---

## 📐 Architecture

- Built as a well-structured React Native project using the Expo managed workflow.
- **Modular Directory Structure:** `src/components`, `src/screens`, `src/navigation`, `src/hooks`, `src/services`, `src/theme`, `src/lib`.
- pnpm monorepo: `apps/mobile` (Expo app), `apps/api` (API), `packages/shared` (zod schemas shared by both).

---

## 🚀 Getting Started

### Prerequisites

- Node.js 24 and pnpm 10
- Docker (local PostgreSQL and Redis)
- Xcode or Android Studio (development build)

### Installation

```bash
# Clone the repository
git clone https://github.com/mandjou-dama/dily.git
cd dily

# Install dependencies using pnpm
pnpm install

# Local config: copy, then set the two secrets
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env.development.local

# PostgreSQL and Redis, then the schema and sample data
pnpm db:up
pnpm db:migrate
pnpm db:seed

# The API (http://localhost:3001), sign-in codes in its logs
pnpm dev:api

# The app, in another terminal
pnpm ios
# or
pnpm android
```

Test sign-in: 70 00 00 00, code 123456 (`TEST_PHONES` in `.env`).
Run the API tests with `pnpm test` (Docker services up).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Mandjou Dama**

- GitHub: [@mandjoudama](https://github.com/mandjou-dama)
- LinkedIn: [Mandjou Dama](https://www.linkedin.com/in/mandjoudama/)
- Twitter (X): [@mandjoudama](https://x.com/mandjou_code)
