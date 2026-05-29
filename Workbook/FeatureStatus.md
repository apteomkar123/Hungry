# Hungry — Feature Status

A living document tracking what's shipped, what works, and what's blocked until the iOS app is ready.

---

## ✅ Ready & Available (Web App)

### Auth
- Email / password sign in and sign up
- Forgot password (email reset link)
- Sign in with Google (OAuth via Supabase — requires Google provider enabled in Supabase dashboard)
- Onboarding flow — 5-screen liquid-glass intro + preferences sheet (name, dietary restrictions, nutrition goal), written to Supabase on completion

### Pantry
- Add items manually
- Scan a grocery receipt via photo upload (AI parsing)
- Barcode lookup (Open Food Facts API)
- Edit item details inline
- Remove items
- Expiry date tracking
- Assign items to a personal or household pantry
- Quantity controls per item

### Recipes
- Recipe explorer powered by MealDB + Spoonacular + static recipes, sorted by pantry match %
- Search by name, ingredient, or filter keyword
- Filter by meal type, diet, and cuisine
- AI recipe generator — pick pantry items, generates a custom recipe
- Recipe detail modal with full ingredient list and steps
- Pantry match indicator per ingredient (green/amber dot)
- Add individual missing ingredients to shopping list
- Add ALL missing ingredients to shopping list in one tap
- Save recipe to My Saved Recipes
- Share recipe to a specific household
- Deep link sharing (unique URL per recipe)
- Convert recipe: Make Vegetarian / Make Vegan / Add Meat (local + AI)
- Proteinize — AI suggests a protein addition
- Ingredient substitution (AI-powered swap)
- Multiplier (1×, 2×, 4× servings)
- Estimated nutrition per serving
- Cooking Mode — full-screen step-by-step view
- Mark as Cooked (updates pantry)

### Shopping List
- Add items manually
- Items auto-grouped by aisle (Produce, Dairy, Meat, Bakery, etc.)
- Check off items
- Delete items
- Rename items inline (double-tap or pencil icon)
- Move items between personal list and household lists
- Personal Shopper mode — distraction-free shopping view

### Chef History
- Automatically logged when a recipe is marked as Cooked
- Add personal notes per entry
- Add photos per entry
- Delete individual photos
- Toggle public / private visibility
- Re-open the original recipe from history

### Analytics
- Nutrition overview — protein / carbs / fat breakdown with distribution bars
- AI Nutrition Coach — pick a macro goal, get ingredient and recipe suggestions
- Eco Score — tracks expiring/expired items and waste risk
- Spending tracker — pantry value, shopping list spend, budget vs. actual
- Set personal budget limit
- Set household budget limit
- Smart Meal Prep — AI generates a weekly batch-cooking plan grouped by shared ingredients
- Save / restore meal plans (persisted to localStorage + Supabase backup)

### Household
- Create a household with a generated invite code
- Join a household via invite code
- Switch between multiple households
- Set a household budget limit
- View household members (with Add Friend button for non-friends)
- Shared shopping list (household-scoped, real-time via Supabase)
- Shared saved recipes (household-scoped)

### Friends
- Friend codes (8-character code based on user ID)
- Add friends by code
- Search for friends by display name
- Send friend requests
- Accept / decline incoming friend requests
- View friends' public chef history feed
- Household members show an Add Friend button if not already connected

### Settings
- Update display name
- Set dietary restrictions
- Set nutrition goal
- Set age, weight, height
- Set personal budget limit
- Create / join / manage households
- Sign out

### Infrastructure
- Progressive Web App (PWA) — installable on home screen, offline support via service worker
- IndexedDB sync queue for offline mutations (pantry, shopping list)
- Supabase real-time backend
- Netlify serverless functions (AI recipe generation, receipt scanning)
- MealDB recipe cache (24h localStorage TTL)

---

## 🚧 Blocked — Requires iOS App

These features are intentionally deferred until a native iOS app exists. The reason is noted for each.

| Feature | Reason blocked |
|---|---|
| **Sign in with Apple** | Apple mandates that any app offering third-party OAuth (e.g. Google) must also offer Sign in with Apple — but only inside a native iOS app submitted to the App Store. The OAuth flow works on web but Apple will not approve an App Store listing without it being a native SIWA button using `ASAuthorizationAppleIDButton`. Requires an Apple Developer account ($99/yr), an App ID with the Sign in with Apple capability, and Supabase Apple provider configuration. |
| **Haptic feedback** | The Web Vibration API is disabled on iOS Safari. True haptic feedback (UIImpactFeedbackGenerator) requires native Swift/RN code. |
| **Push notifications** | iOS blocks web push in installed PWAs on older versions; even on iOS 16.4+ with web push support, APNs delivery is unreliable without a native app. Full reliability requires a native app + APNs certificate configured in the backend. |
| **Voice guidance ("Hungry, next step")** | The Web Speech API's `SpeechRecognition` is unsupported in iOS WKWebView and unreliable in iOS Safari PWA. Continuous listening in the background is impossible on web. Requires native `SFSpeechRecognizer` + `AVAudioEngine`. |
| **Barcode scanning via camera (reliable)** | `html5-qrcode` works in some browsers but camera access in iOS PWA home screen mode is broken on many iOS versions. A native `AVCaptureSession` / `Vision` framework scanner is far more reliable. |
| **Widgets (Home Screen / Lock Screen)** | Requires native iOS WidgetKit extension — not possible on web. Could show expiring pantry items, today's recipe suggestion, or shopping list count. |
| **Siri Shortcuts** | Requires native SiriKit integration. Could support "Hey Siri, what can I cook tonight?" or "Add milk to Hungry". |
| **Face ID / Touch ID biometric sign-in** | Requires native WebAuthn with platform authenticator or native LocalAuthentication framework. Web passkeys are partially supported but not reliable across iOS versions. |
| **App Clips** | Native iOS feature — allows instant access to a subset of the app (e.g. scanning a receipt) without a full install. |
| **Background pantry sync** | iOS kills PWA background processes aggressively. Reliable background sync (e.g. expiry reminders) requires a native app with background fetch capability. |
| **NFC tag scanning** | Not accessible from iOS Safari / PWA. Could be used for smart fridge tags or pantry bin labels in a native app. |

---

*Last updated: 2026-05-29*
