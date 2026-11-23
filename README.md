# Instagram No Reels

Personal **iOS** Expo app that loads Instagram’s mobile website in a full-screen WebView and **hides Reels UI** (tab / icons / obvious affordances) via injected CSS/JS.

This is a thin WebView wrapper for **personal sideload / TestFlight** use — not a store-oriented Instagram client.

## Locked behavior

| Topic | Choice |
|--------|--------|
| Framework | Expo (managed), TypeScript |
| Platform | iOS only |
| Distribution | Sideload / TestFlight |
| Reels | **Hide UI only** — do **not** hard-block `/reels` URLs |
| External links | Stay inside the WebView |

## Features

- Full-screen `react-native-webview` → `https://www.instagram.com/`
- Cookie persistence (`sharedCookiesEnabled` / `thirdPartyCookiesEnabled`) so login can survive relaunches when iOS allows it
- Reels hide script in [`src/hideReels.ts`](src/hideReels.ts) (selectors may break when Instagram redesigns)
- Safe-area layout, back / forward / reload toolbar, loading indicator, retry on error
- Mobile Safari user-agent to improve login / layout compatibility

## Prerequisites

- Node 20+ and npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npx expo` is enough)
- For device builds: Apple Developer account + [EAS CLI](https://docs.expo.dev/build/setup/) (`npm i -g eas-cli`)

## Run with Expo

```bash
npm install
npx expo start
```

Then open on a physical iPhone with **Expo Go**, or press `i` for a simulator (macOS + Xcode).

> Login and cookie persistence are more reliable on a **development / preview build** than in Expo Go. Prefer EAS `preview` for day-to-day use.

## Build for TestFlight / sideload (EAS)

1. Log in and link the project (once):

   ```bash
   npm i -g eas-cli
   eas login
   eas init   # writes a real projectId into app.json — replace the placeholder
   ```

2. **Internal / ad-hoc style install** (sideload via Expo’s install page or Apple’s ad-hoc provisioning):

   ```bash
   eas build --platform ios --profile preview
   ```

3. **TestFlight** (App Store Connect + production profile, then submit):

   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios --profile production
   ```

   Update `eas.json` → `submit.production.ios.ascAppId` with your App Store Connect app id.

Bundle id defaults to `com.personal.instagramnoreels` in `app.json` — change it if you already own that id.

## Personal use / Terms of Service

Wrapping Instagram in a third-party client may violate Meta’s terms. This project is intended for **personal, non-distributed** use (sideload / TestFlight). Do not market it as an Instagram alternative. Login challenges, 2FA loops, and UI changes are controlled by Instagram — expect occasional re-login and selector updates.

## Project layout

```
App.tsx                 # SafeArea + root
src/InstagramWebView.tsx
src/hideReels.ts        # ← update selectors here when Instagram redesigns
app.json                # iOS-only Expo config
eas.json                # EAS build / submit profiles
```

## Caveats

- **Login:** WebView sessions can trigger “suspicious login” or challenge pages. Use a real device; re-login after OS / Instagram changes is normal.
- **Cookies:** iOS may clear WebKit data; there is no guarantee of infinite session lifetime.
- **Reels selectors:** Best-effort. If the Reels tab reappears, edit `src/hideReels.ts` only. Deep links / typed `/reels` URLs are intentionally **not** blocked.
