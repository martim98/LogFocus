# Pomofocus.io — Full Functionality Analysis

> A detailed breakdown of every feature, UI section, and behavior of the Pomofocus web app.
> Source: https://pomofocus.io | Created by Yuya Uzu | © 2019–2026

---

## 1. What Is Pomofocus?

Pomofocus is a browser-based and desktop Pomodoro timer designed to help users maintain focus and track productivity. It implements the **Pomodoro Technique**, a time management method where work is divided into focused intervals (traditionally 25 minutes) called "pomodoros," separated by short breaks.

**Supported platforms:**
- Desktop browsers (Chrome, Firefox, Safari, etc.)
- Mobile browsers
- Desktop apps: macOS (v1.2.0), Windows (v1.2.0), Linux (v1.1.0)

---

## 2. Header & Navigation

- **Logo + App name** displayed top-left
- **Tagline:** "An online Pomodoro Timer to boost your productivity"
- Navigation links to core sections of the page
- Footer links: HOME | PRIVACY | TERMS | COMMERCE | CONTACT | SIMPLE PAGE
- Social media links: Facebook, Twitter
- **Stripe Climate** badge (indicating a portion of revenue supports carbon removal)

---

## 3. Timer — Core Functionality

The timer is the central UI element and the heart of the app.

### 3.1 Timer Modes

There are three distinct timer modes, selectable via tabs:

| Mode | Default Duration | Purpose |
|---|---|---|
| **Pomodoro** | 25 minutes | Focused work session |
| **Short Break** | 5 minutes | Rest between pomodoros |
| **Long Break** | 15 minutes | Extended rest after a full cycle (typically every 4 pomodoros) |

### 3.2 Timer Controls

- **Start button** — begins the countdown
- **Pause button** — pauses the active timer mid-session
- **Reset / Skip** — resets or skips to the next phase
- The timer automatically transitions between Pomodoro and Break modes based on the configured cycle

### 3.3 Timer Display

- Large digital countdown displayed prominently (MM:SS format)
- Background color changes between modes (e.g., red for focus, teal/green for breaks) to give a clear visual signal of the current state
- Browser tab title updates with the remaining time so the user can track time without switching windows

---

## 4. Task Management

### 4.1 Adding Tasks

- Users can add tasks via an **"Add Task"** input field
- Each task has:
  - **Task name/description** — free-text label
  - **Pomodoro estimate** — number of pomodoros (25-min blocks) expected to complete the task
  - **Actual pomodoros tracked** — auto-incremented as sessions complete

### 4.2 Task List

- All added tasks are listed beneath the timer
- Users can **select the active task** — the timer runs "on behalf of" that task, incrementing its tracked count
- Tasks display:
  - Task name
  - Estimated pomodoros vs. completed pomodoros (e.g., `2 / 4`)
- Tasks can be **reordered**, **edited**, and **deleted**

### 4.3 Task Templates

- Users can save task sets as **templates** for repetitive workflows
- **Free plan:** up to 3 saved templates
- **Premium plan:** unlimited templates

### 4.4 Estimated Finish Time

- Pomofocus automatically calculates and displays an **estimated finish time** for all tasks based on remaining pomodoros and the current time

---

## 5. Settings & Customization

Accessible via a settings icon/button, users can configure:

### 5.1 Timer Durations

- **Focus (Pomodoro) duration** — customizable (default: 25 min)
- **Short Break duration** — customizable (default: 5 min)
- **Long Break duration** — customizable (default: 15 min)
- **Long break interval** — after how many pomodoros a long break triggers (default: 4)

### 5.2 Sound Settings

- **Alarm sounds** — plays when a timer phase ends; multiple sound options available
- **Background sounds** — ambient audio that plays during focus sessions (e.g., white noise, rain, café sounds)
- Volume controls for each sound type

### 5.3 Visual / UI Settings

- **Color themes** — background color changes per timer mode (Pomodoro / Short Break / Long Break), each assignable a different color
- **Font options** — style preference for the timer display

### 5.4 Behavior Settings

- **Auto-start Breaks** — automatically starts the break timer when a pomodoro ends
- **Auto-start Pomodoros** — automatically starts the next focus session when a break ends
- **Long break interval** — configurable cycle length

### 5.5 Notification Settings

- **Browser notifications** — desktop alerts when a timer phase ends
- **Sound alerts** — audio cues at the end of each interval

---

## 6. Reports & Analytics

Pomofocus tracks focus time over time and visualizes it in report dashboards.

### 6.1 Free Tier Reports

| Report | What It Shows |
|---|---|
| **Daily** | Total focus hours/pomodoros for today |
| **Weekly** | Day-by-day breakdown for the current week |
| **Monthly** | Day-by-day breakdown across the current month |

### 6.2 Premium Reports

- **Yearly report** — overview of focus hours across all 12 months
- **CSV export** — download raw focus data for external analysis (e.g., in Excel or Google Sheets)

### 6.3 Project-Based Tracking (Premium)

- Tasks can be grouped under **projects**
- Reports can be filtered/segmented by project
- Enables understanding where time is spent across different areas of work

---

## 7. Account & Authentication

- Users can create an account or log in to sync data across devices
- Login enables cloud storage of tasks, templates, settings, and report history
- **Todoist integration** (Premium) — connect a Todoist account to import tasks directly into Pomofocus

---

## 8. Premium Plan

Pomofocus offers a free tier and a **Premium subscription**. Below is a full comparison:

| Feature | Free | Premium |
|---|---|---|
| Pomodoro timer (all modes) | Yes | Yes |
| Task management | Yes | Yes |
| Estimated finish time | Yes | Yes |
| Basic reports (daily/weekly/monthly) | Yes | Yes |
| Saved templates | Up to 3 | Unlimited |
| Project tracking | No | Yes |
| Yearly reports | No | Yes |
| CSV export | No | Yes |
| Todoist integration | No | Yes |
| Webhook integration (Zapier, IFTTT) | No | Yes |
| Ad-free experience | No | Yes |

### 8.1 Webhook Integration (Premium)

- Connects Pomofocus events (timer start, timer end, task complete) to external automation tools
- Compatible with **Zapier** and **IFTTT**
- Enables custom workflows, e.g., logging sessions to a spreadsheet automatically

---

## 9. Desktop Apps

Downloadable native desktop apps provide:
- Offline access (no browser required)
- Potential OS-level notifications
- Available for:
  - **macOS** — v1.2.0
  - **Windows** — v1.2.0 *(note: app is unsigned, may trigger OS security warnings)*
  - **Linux** — v1.1.0

---

## 10. How the Pomodoro Technique Works (In-App Guide)

Pomofocus explains the methodology directly on the page in a 6-step workflow:

1. **Add your tasks** — list what you need to accomplish
2. **Estimate pomodoros** — assign how many 25-minute blocks each task requires
3. **Select a task** — pick the task you'll work on
4. **Start the timer** — focus until the alarm sounds
5. **Take a break** — rest for the short or long break interval
6. **Repeat** — iterate through pomodoros until all tasks are done

---

## 11. "Simple Page" Mode

- A **simplified version** of the app is available via the "SIMPLE PAGE" footer link
- Likely a stripped-down interface with just the timer (no tasks, reports, or settings panels) — useful for minimal distraction

---

## 12. Privacy, Legal & Contact

- **Privacy Policy** — describes data collection and usage
- **Terms of Service** — usage terms
- **Commerce** — payment/subscription information
- **Contact** — support or general contact page

---

## Summary

Pomofocus is a polished, full-featured Pomodoro productivity tool. Its core value loop is:

> **Add tasks → estimate effort → run timed focus sessions → track real vs. estimated time → review reports**

It covers everything from a simple countdown timer for casual users to a project-level time tracker with external integrations for power users. The premium tier unlocks the data layer (projects, CSV, yearly trends) and workflow automation (webhooks, Todoist).
