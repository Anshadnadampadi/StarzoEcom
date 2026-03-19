# 📱 Starzomobiles Design System

Professional style guide for **Starzomobiles**, a modern mobile-first e-commerce experience. Optimized for accessibility, performance, and a "Modern Mobile Tech" aesthetic.

---

## 🎨 Global Color Palettes

We use a two-tiered theme system. The **User Theme** is vibrant and consumer-focused, while the **Admin Theme** is professional and utility-focused.

### 👤 User Theme (Blue & White)
*Vibrant, trustworthy, and clean.*

```css
:root {
  /* Colors */
  --primary: #0062FF;       /* Sapphire Blue */
  --primary-hover: #0052D9;
  --primary-soft: #EEF4FF;
  
  --secondary: #38BDF8;      /* Sky Blue Accent */
  
  --background: #FFFFFF;     /* Base */
  --surface: #F8FAFC;        /* Secondary Sections */
  --outline: #E2E8F0;        /* Borders/Dividers */
  
  --text-main: #0F172A;      /* Slate 900 */
  --text-muted: #64748B;     /* Slate 500 */
  --text-on-primary: #FFFFFF;
}
```

### ⚙️ Admin Theme (Green & White)
*Professional, efficient, and growth-oriented.*

```css
:root {
  /* Colors */
  --primary: #10B981;       /* Emerald Green */
  --primary-hover: #059669;
  --primary-soft: #ECFDF5;
  
  --secondary: #84CC16;      /* Lime Accent */
  
  --background: #FFFFFF;
  --surface: #F0FDF4;        /* Minty Surface */
  --outline: #D1FAE5;
  
  --text-main: #064E3B;      /* Deep Forest */
  --text-muted: #374151;     /* Gray 700 */
  --text-on-primary: #FFFFFF;
}
```

---

## 🔡 Typography System

A high-performance typography stack optimized for mobile legibility.

### Font Families
- **Headings**: `Outfit`, sans-serif
  - *Character*: Geometric, modern, friendly but professional.
- **Body**: `Plus Jakarta Sans`, sans-serif
  - *Character*: Clean, high-legibility at small sizes, versatile.

### Type Scale (Mobile First)
| Level | Size (rem) | Size (px) | Weight | Line Height |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | 2.0rem | 32px | 700 | 1.2 |
| **H2** | 1.5rem | 24px | 600 | 1.3 |
| **H3** | 1.25rem | 20px | 600 | 1.4 |
| **Body** | 1.0rem | 16px | 400 | 1.5 |
| **Small** | 0.875rem | 14px | 400 | 1.5 |
| **Label** | 0.75rem | 12px | 500 | 1.5 |

---

## 🧱 Component Primitives

### Buttons
Buttons feature a default border-radius of `12px` (Modern Round) and a subtle scale-down transition on active state.
- **Primary**: Solid background using `--primary`.
- **Secondary**: `--primary-soft` background with `--primary` text.
- **Outline**: 1.5px border with `--outline`.

### Cards
- **Radius**: `16px`
- **Shadow**: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`
- **Border**: Optional 1px `--outline` for light surfaces.

---

## ✨ Motion & Micro-interactions

1. **Page Transitions**: Subtle fade-in with 20px vertical slide (cubic-bezier 0.4, 0, 0.2, 1).
2. **Interactive Elements**: All hoverable items should scale by `1.02` for immediate feedback.
3. **Skeleton Loading**: Use a pulse animation with `--surface` base.

---

> [!TIP]
> **Performance First**: Only load the necessary font weights (400, 500, 600, 700) to keep mobile load times low.
