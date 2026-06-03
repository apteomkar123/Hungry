# Pantry: Onboarding Experience Specification

## 🎨 Design Language & System
- **Theme:** "Liquid Glass" (Apple-inspired depth).
- **Primary Color:** `#6BAEE0` (The Pantry Blue).
- **Secondary Color:** `rgba(255, 255, 255, 0.4)` (Frosted Glass).
- **Typography:** 
  - Branding: `Yellowtail` (Cursive, free-flowing).
  - UI/Body: Modern Sans-Serif (SF Pro or Inter).
- **Surfaces:** `backdrop-blur-3xl`, `border-white/50`, `rounded-[3rem]`.
- **Animations:** Framer Motion `spring` transitions, liquid-fill loading states.

---

## 🧭 The Onboarding Flow

### Screen 1: The Brand Identity
**Visual:** A centered, floating glass orb containing a liquid-blue "H" in Yellowtail font. Background is a soft white-to-blue gradient.
**Header:** "Welcome, Chef!" (Yellowtail, #6BAEE0).
**Body:** "Your kitchen just got a whole lot smarter. Let's turn those ingredients into masterpieces."
**CTA:** [Start Your Journey] (Large rounded-pill button).

### Screen 2: Smart Stocking (Scan & Go)
**Visual:** An interactive animation of a scanning line passing over a grocery receipt and a barcode.
**Header:** "Zero Typing Required."
**Body:** "Snap a photo of your receipt or scan a barcode. Our AI automatically categorizes your pantry and tracks expiry dates."
**Feature Highlight:** Mini-card showing "Eggs added · Expires in 12 days".

### Screen 3: AI Culinary Logic
**Visual:** A recipe card sliding in with a "95% Match" badge based on current pantry items.
**Header:** "Culinary Magic."
**Body:** "Tell us what you have, and we'll tell you what's for dinner. Dietary restrictions and nutrition goals included."
**Interactive:** A toggle showing [Meat] ↔️ [Vegetarian] conversion.

### Screen 4: Collaborative Households
**Visual:** Three overlapping glassy profile circles representing a "Home."
**Header:** "One Kitchen, One List."
**Body:** "Share your pantry and shopping list with roommates or family in real-time. No more double-buying the milk."
**CTA:** [Join a Household] or [Create My Own].

### Screen 5: Hands-Free Cooking
**Visual:** A microphone icon pulsing gently with a "Liquid Glass" ripple effect.
**Header:** "Look, No Hands."
**Body:** "Step-by-step voice guidance for when your hands are covered in flour. Just say 'Pantry, next step'."

---

## 🛠 Technical Implementation Details

### 1. The Onboarding Container (React)
```jsx
const OnboardingWrapper = ({ children }) => (
  <div className="h-screen w-full bg-gradient-to-b from-white to-blue-50 flex items-center justify-center p-6 font-sans">
    <div className="w-full max-w-md aspect-[9/19] bg-white/30 backdrop-blur-3xl border border-white/60 rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden relative">
      {children}
    </div>
  </div>
);
```

### 2. Interaction Logic
- **Navigation:** Horizontal swipe gesture (standard mobile pattern).
- **Progress:** 5 dots at the bottom. The active dot is a #6BAEE0 pill shape; others are small glass circles.
- **Skip:** A subtle "Skip" button in the top-right corner (`text-slate-400/80`) to jump straight to Auth.

### 3. Data Collection (Final Step)
Before entering the main app, trigger the **Preferences Sheet**:
1. **Name:** "What should we call you, Chef?"
2. **Restrictions:** Chips for [Vegetarian, Vegan, Halal, Kosher, Gluten-Free].
3. **Goals:** [Increase Protein, Lower Carbs, Eco-Friendly/Zero Waste].

---

## 🏗️ Claude Code Instructions
*When feeding this into Claude Code, use the following directive:*

> "Implement the onboarding layout described in `OnboardingLayout.md`. Use Tailwind CSS for the 'Liquid Glass' effects and Framer Motion for the screen transitions. Ensure the final screen writes to the `public.profiles` table in Supabase to save the user's preferred name and dietary restrictions."

---

## ✅ Implementation Checklist
- [ ] `framer-motion` installed for fluid animations.
- [ ] `Yellowtail` font imported in `index.css`.
- [ ] `onboarding_completed` flag added to `localStorage` or `profiles` table.
- [ ] Haptic feedback integrated on screen swipes.
```

<!--
[PROMPT_SUGGESTION]Create a React component for the Onboarding Screen 1 using Tailwind CSS and Lucide icons.[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]Write a Framer Motion animation script for the progress dots and sliding transitions between onboarding screens.[/PROMPT_SUGGESTION]
