# Starzo Mobiles Admin Design System

This document outlines the refined, premium design system for the **Starzo Mobiles** Admin Panel. The system is built on a sophisticated dark theme with teal accents, emphasizing clarity, modern typography, and balanced spacing.

## 🎨 Color Palette (Color Hunt #222831)

| Name | Hex | Usage |
| :--- | :--- | :--- |
| **Deep Background** | `#222831` | Main page background, sidebar base. |
| **Surface Carbon** | `#393E46` | Cards, inputs, modal backgrounds. |
| **Primary Teal** | `#00ADB5` | Accents, primary buttons, active states. |
| **Premium Light** | `#EEEEEE` | Primary headings and text. |
| **Muted Slate** | `rgba(238, 238, 238, 0.6)` | Secondary labels and supporting text. |

## Typography

- **Headings**: `Plus Jakarta Sans`, sans-serif (Weights: 600, 700)
- **Body**: `Inter`, sans-serif (Weights: 400, 500)
- **Monospace**: `JetBrains Mono` (for IDs and numeric data)

## 📐 Layout & Spacing

- **Standard Grid**: 8px base unit.
- **Card Padding**: `24px` (Desktop), `16px` (Mobile).
- **Section Margin**: `32px`.
- **Border Radius**: `14px` for cards/inputs, `10px` for buttons.

---

## 💻 CSS Variables & Core Styles

Copy and paste the following into your `admin-style.css` or include in your main stylesheet.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap');

:root {
  /* Colors */
  --bg-dark: #222831;
  --bg-surface: #393E46;
  --primary: #00ADB5;
  --primary-glow: rgba(0, 173, 181, 0.15);
  --text-main: #EEEEEE;
  --text-dim: rgba(238, 238, 238, 0.7);
  --text-muted: rgba(238, 238, 238, 0.4);
  --border: rgba(0, 173, 181, 0.2);
  --border-light: rgba(238, 238, 238, 0.1);
  
  /* Status Colors */
  --success: #00ADB5; /* Using primary as success for brand consistency */
  --warning: #F0A060;
  --danger: #E05A5A;
  
  /* Sizing */
  --sidebar-w: 260px;
  --header-h: 72px;
  --radius-lg: 14px;
  --radius-md: 10px;
  --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: var(--bg-dark);
  color: var(--text-main);
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

h1, h2, h3, h4, .font-heading {
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: -0.02em;
}

/* ======================== COMPONENTS ======================== */

/* Premium Glass Card */
.admin-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: var(--transition);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.admin-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
}

/* Sidebar Interaction */
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  color: var(--text-dim);
  text-decoration: none;
  font-weight: 500;
  transition: var(--transition);
  margin-bottom: 4px;
}

.sidebar-link:hover, .sidebar-link.active {
  background: var(--primary-glow);
  color: var(--primary);
}

/* Input Fields */
.admin-input {
  background: var(--bg-dark);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-main);
  padding: 12px 16px;
  font-size: 0.95rem;
  transition: var(--transition);
  width: 100%;
}

.admin-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-glow);
}

/* Buttons */
.btn-premium {
  background: var(--primary);
  color: var(--bg-dark);
  font-weight: 700;
  padding: 10px 24px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition);
}

.btn-premium:hover {
  filter: brightness(1.1);
  box-shadow: 0 4px 15px var(--primary-glow);
  transform: translateY(-1px);
}

/* Data Table */
.premium-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;
}

.premium-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 16px 8px;
  text-align: left;
}

.premium-table tr td {
  background: var(--bg-surface);
  padding: 16px;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
}

.premium-table tr td:first-child {
  border-left: 1px solid var(--border-light);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

.premium-table tr td:last-child {
  border-right: 1px solid var(--border-light);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}
```

## 🛠️ Implementation Notes

1.  **Header Font**: Ensure `Plus Jakarta Sans` is used for high-impact typography (e.g., Dashboards, Product Titles).
2.  **Interactive Elements**: All hover states use the `cubic-bezier` transition for a slick, responsive feel.
3.  **Visual Hierarchy**: Use `var(--text-dim)` for secondary info to create depth.
