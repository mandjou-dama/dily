# 🛍️ Dily

A modern mobile application built with **React Native (Expo)** that allows users to seamlessly discover, sell, and chat about products.  
The app provides an intuitive and smooth experience for **buyers** and **sellers** to connect, featuring a clean interface with real-time updates powered by **Supabase**.

---

## 📱 Screenshots

*Add some previews of the app in action here:*

<!--
![Discover](./screenshots/discover.png)
![Sell](./screenshots/sell.png)
![Chat](./screenshots/chat.png)
-->

---

## ✨ Features

### 👤 User Authentication
- [x] Login with WhatsApp for a fast and frictionless experience
- [x] OTP Verification Code support
- [x] Seamless Profile setup

### 🏠 Discover (Buyers)
- [x] Browse and search for products seamlessly
- [x] Smooth and performant lists powered by FlashList

### 💵 Sell (Sellers)
- [x] Create product listings
- [x] Attach product images and descriptions

### 💬 Chat
- [x] Integrated messaging system to contact sellers directly
- [x] Real-time communication

### ⚙️ Profile
- [x] Manage your personal information
- [x] View and handle your listings

---

## 🛠️ Tech Stack

- **Mobile Framework:** React Native (Expo SDK 54, TypeScript)
- **Experimental:** React Compiler (React 19 beta)
- **Backend & Auth:** Supabase (Postgres + Auth)
- **State & Data Fetching:** TanStack Query (React Query)
- **Navigation:** React Navigation v7
- **UI & Animations:** React Native Reanimated, Expo Blur / Glass Effect, Shopify React Native Skia
- **Storage:** React Native MMKV, Expo Secure Store
- **Other Tools:** FlashList (for high-performance lists), Lucide React Native (icons), Keyboard Controller

---

## 📐 Architecture

- Built as a well-structured React Native project using the Expo managed workflow.
- **Modular Directory Structure:** `src/components`, `src/screens`, `src/navigation`, `src/hooks`, `src/services`, `src/theme`, `src/lib`.
- Integrated with a modern backend-as-a-service (Supabase) for authentication and data management.

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- Expo CLI
- Supabase account/project (for backend services)

### Installation

```bash
# Clone the repository
git clone https://github.com/mandjou-dama/dily.git
cd dily

# Install dependencies using pnpm
pnpm install

# Start the development server
pnpm start
# or 
npx expo start --dev-client

# Run on specific platforms
npm run ios
# or
npm run android
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Mandjou Dama**

- GitHub: [@mandjoudama](https://github.com/mandjou-dama)
- LinkedIn: [Mandjou Dama](https://www.linkedin.com/in/mandjoudama/)
- Twitter (X): [@mandjoudama](https://x.com/mandjou_code)
