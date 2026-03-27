

## Redesign Hero Section (Reference: Mental Health Landing Page)

The reference image shows a **two-column layout** with:
- Left side: Large bold headline with accent-colored words, subtitle text, and a single CTA button
- Right side: An illustration with organic blob shapes and decorative elements
- Warm, soft background with organic blob shapes

Since we can't embed the exact illustration from the reference, we'll recreate the layout and feel using CSS blob shapes, icons, and the existing mental health images.

---

## Plan

### 1. Restructure Hero to Two-Column Layout
Change the current centered single-column hero into a `grid grid-cols-1 lg:grid-cols-2` layout:
- **Left column**: Title, subtitle, CTA buttons -- all left-aligned
- **Right column**: A decorative composition using one of the existing mental health images (`mental-health-1.jpg`) overlaid with floating icons (Heart, Brain, etc.) and CSS blob shapes

### 2. Add Decorative Blob Backgrounds
Add SVG blob shapes as absolute-positioned background elements behind the hero section to mimic the organic, warm feel from the reference. Use soft purple/pink/beige tones via CSS.

### 3. Style the Headline
- Make "Mental Wellness" the accent-colored words (already done with `text-primary`)
- Left-align the text instead of center
- Keep the large bold font sizing

### 4. Add Floating Decorative Icons
Place small animated floating icons (Heart, Brain, MessageCircle, Shield) around the right-side image using `framer-motion` for gentle floating animations, similar to the gear/heart icons in the reference.

### 5. Simplify CTA Area
Keep the two buttons but left-align them to match the reference layout.

---

### Files Modified
- `src/pages/Index.tsx` -- restructure hero section to two-column layout with decorative elements
- `src/index.css` -- add blob shape utility classes

