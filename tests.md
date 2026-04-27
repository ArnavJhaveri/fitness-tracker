# Fitness Tracker — Test Suite
Last updated: April 2026. Run after every push to GitHub.

---

## 1. AUTOMATED SYNTAX CHECKS

Run before every deploy:
```bash
# Extract JS and check syntax
python3 -c "
import re, subprocess
with open('index.html') as f: c = f.read()
m = re.search(r'<script>(.*)</script>', c, re.DOTALL)
with open('/tmp/chk.js','w') as f2: f2.write(m.group(1))
r = subprocess.run(['node','--check','/tmp/chk.js'], capture_output=True, text=True)
print('Syntax:', '✓' if r.returncode==0 else r.stderr[:200])
js = m.group(1)
print('Backticks even:', js.count('\`') % 2 == 0)
print('Brace balance:', js.count('{') - js.count('}'))
"
```

Expected: `Syntax: ✓`, backticks even, brace balance = 0.

---

## 2. SECURITY TESTS

### 2.1 No raw API keys in fetch URLs
- USDA key referenced as `${USDA_API_KEY}` constant, not hardcoded inline ✓
- Open Food Facts URL via `${OFF_API_URL}` constant ✓
- SCRIPT_URL (Google Apps Script) is hardcoded but acceptable for a personal app — move to env var when multi-user

### 2.2 XSS prevention
**Test:** Enter `<script>alert(1)</script>` as an exercise name, food name, or notes field.
**Expected:** Text is escaped via `escapeHtml()` and displayed literally — no alert fires.

**Test:** Enter `"><img src=x onerror=alert(1)>` as a food search query.
**Expected:** URL-encoded via `encodeURIComponent`, no injection.

### 2.3 Rate limiting
**Test:** Click "Search" in food search 20 times in 60 seconds.
**Expected:** After 15 requests, shows "Rate limit: please wait before searching again."

**Test:** Scan 12 barcodes rapidly.
**Expected:** After 10, shows rate limit message.

**Test:** Submit 12 NL food descriptions rapidly.
**Expected:** After 10, shows rate limit message.

### 2.4 Barcode input validation
**Test:** Enter barcode `abc123` (non-numeric).
**Expected:** Shows "Invalid barcode — must be 8–14 digits."

**Test:** Enter barcode `123` (too short).
**Expected:** Rejected.

**Test:** Enter valid EAN-13 `5000169105145`.
**Expected:** API call made, product looked up.

### 2.5 Password security
- Password stored as SHA-256 hash only — never plaintext ✓
- Hash not transmitted over network ✓
- Hash not logged to console ✓

---

## 3. DATA INTEGRITY TESTS

### 3.1 Multi-activity model
**Test:** Add Run + Weights A for Tuesday. Reload page.
**Expected:** Both activities persist. Day card shows "Run" badge (primary). Card shows burns for both.

**Test:** Remove the Run activity.
**Expected:** Card immediately updates to show Weights A as primary badge.

**Test:** Remove all activities.
**Expected:** Card reverts to planned activity for that day (e.g. "Weights B").

### 3.2 Calorie deficit calculation
With maintenance = 2250:
- Day 1: ate 1800 kcal, burned 320 (Run) → net 1480, deficit = 2250-1480 = +770
- Day 2: ate 2500 kcal, no activity → net 2500, deficit = 2250-2500 = -250
**Expected banner:** shows +520 total weekly deficit.

### 3.3 Sync (cross-device)
**Test:** Log food on laptop, wait for "✓ Synced" indicator. Open on phone within 30 seconds.
**Expected:** Food entries appear on phone after pull-from-Sheets.

**Test:** Edit on both devices simultaneously. Check which version wins.
**Expected:** Device with more recent `_lastSaved` timestamp wins (last-write-wins).

### 3.4 Corrupted localStorage recovery
**Test:** Open DevTools → Application → localStorage → set `fitnessTracker` to `{invalid json`.
**Expected:** App loads with empty state, does not crash. Shows start date prompt.

### 3.5 Copy last week
**Test:** Log activities in week 1. Navigate to week 2. Press ⟳ Copy last week.
**Expected:** Same activities appear in week 2. Food entries NOT copied. Workout log sets/weights copied. Week notes prefixed with "[Copied from Wk 1]".

---

## 4. FEATURE UNIT TESTS

### 4.1 Weight sparkline
**Test:** Log weights for 3+ weeks.
**Expected:** Sparkline renders with line, area fill, goal dotted line, rate label (e.g. "↓ 2.3 lbs over 3 wks · ~0.77 lbs/wk").

**Test:** Only 1 weight logged.
**Expected:** Canvas hidden, shows "Log more weekly weights to see trend."

### 4.2 3-segment calorie bar
**Test:** Log 1200 kcal eaten, have a 300 kcal burn logged.
**Expected (with 1800 target):** Amber segment = 1200/1800 = 67%, green segment = 300/1800 = 17%, grey remaining. Label shows "300 kcal left".

**Test:** Eat over target (e.g. 2100 kcal with 1800 target).
**Expected:** Bar overflows, label turns red showing "300 kcal over".

### 4.3 PR detection
**Test:** Log Bench Press 80kg × 8 in week 1. Log Bench Press 85kg × 8 in week 2.
**Expected:** 🏆 "New personal records!" banner appears in week 2 workout panel.

**Test:** Log same weight as previous best.
**Expected:** No PR banner.

### 4.4 Adaptive water target
**Test:** On a day with Run logged, check water section.
**Expected:** Target shows 3.0L (base 2.5L + 0.5L boost). Note says "+0.5L workout boost".

**Test:** On a Rest day.
**Expected:** Target shows 2.5L (base only).

### 4.5 Exercise drag-to-reorder
**Test:** Add Bench Press then Squat in workout log. Drag Squat above Bench Press.
**Expected:** Order changes immediately. Persists after page reload.

### 4.6 Last weight prefill
**Test:** Log Bench Press 80kg × 8 in week 1. In week 2, open workout log and type "Bench Press".
**Expected:** Sets auto-fill with 80kg, 8 reps. Hint shows "Last session Wk1: 80.0kg × 8 reps".

### 4.7 Exercise demo videos
**Test:** Add "Squat" exercise. Tap ▶ Demo.
**Expected:** Modal opens with YouTube embed for squat tutorial.

**Test:** Add "My custom exercise". Tap ▶ Demo.
**Expected:** Falls back to YouTube search for "My custom exercise exercise form tutorial".

### 4.8 Barcode scanner
**Test (Android Chrome):** Tap 📷. Point at product barcode.
**Expected:** Scanner detects barcode, closes, shows serving picker with product name and macros.

**Test (other browsers):** Tap 📷.
**Expected:** Prompt appears for manual barcode entry.

**Test:** Enter barcode for a product (e.g. Kellogg's Corn Flakes = 5000169105145).
**Expected:** Shows product name, serving size 30g, correct macros from Open Food Facts.

### 4.9 Natural language food entry
**Test:** Click ✏ Describe meal. Type "200g chicken breast and 150g rice".
**Expected:** Parses to 2 items, shows total kcal and macros, "Add all to Lunch" button works.

**Test:** Type "2 eggs".
**Expected:** Parses count=2 with ~per-egg weight from USDA, shows estimated macros.

**Test:** Type `<script>alert(1)</script>`.
**Expected:** Sent as URL-encoded query to USDA, returns "not found" or safe response. No alert fires.

### 4.10 Food search suggestions
**Test:** Log "Chicken breast" from search. Next time, start typing "chi" in food search.
**Expected:** "Chicken breast" appears in dropdown. Tap to add instantly.

**Test:** Type slowly — show suggestions on each keystroke.
**Expected:** Suggestions update as you type (oninput).

### 4.11 Macro donut chart
**Test:** Log 30g protein, 50g carbs, 20g fat.
**Expected:** Donut shows blue (protein), amber (carbs), purple (fat) segments. Centre shows kcal from macros: 30×4 + 50×4 + 20×9 = 500 kcal.

### 4.12 Plan compliance chart
**Test:** Week 1: complete 5/7 planned sessions. Week 2: complete 3/7.
**Expected:** History tab shows horizontal bars for each week. Wk1: 71%, Wk2: 43%.

### 4.13 Wellbeing trends chart
**Test:** Log RPE 7, mood 4/5, sleep 7.5h on multiple days across 2+ weeks.
**Expected:** History tab shows 3 lines (purple=RPE, amber=mood, blue=sleep) with dots at each data point, week labels on x-axis.

### 4.14 Notifications
**Test:** Enable notifications in Settings. Set clock to 1pm.
**Expected (if < 40% protein logged):** "Protein reminder" notification fires.

**Test:** Disable notifications.
**Expected:** No notifications fire.

---

## 5. UI/UX TESTS

### 5.1 Mobile layout (≤640px)
- [ ] Tab bar scrolls horizontally, no wrapping
- [ ] Day cards show 4 columns on tablet, 2 on phone (≤480px)
- [ ] Progress banner stats readable without horizontal scroll
- [ ] Workout log inputs usable with phone keyboard
- [ ] Calorie macro inputs don't overflow
- [ ] No horizontal scrolling on main app body
- [ ] PWA install banner appears on Android/iOS (mobile only — not on desktop)

### 5.2 Day card accuracy
After logging: the day card must immediately reflect (without page refresh):
- [ ] Activity badge updates when activity added/removed/reordered
- [ ] Burned kcal shown even with no food logged
- [ ] "X kcal eaten · net Y" shown when food is logged
- [ ] Card reverts to planned activity when all activities cleared

### 5.3 Progress banner live updates
Changing any of these must update the banner immediately:
- [ ] Adding food updates "Week deficit"
- [ ] Adding activity updates "Week deficit" and "Workout streak"
- [ ] Logging weight updates "This week" and sparkline

### 5.4 Calorie bar real-time
- [ ] 3-segment bar updates as food is added/removed
- [ ] "X kcal left" label updates correctly
- [ ] Bar turns red when over target

### 5.5 Export/share
- [ ] Export CSV generates downloadable file with correct columns
- [ ] Export week PDF opens print dialog with formatted layout
- [ ] Export backup creates JSON with all data
- [ ] Import backup restores all data correctly
- [ ] Share progress generates canvas card (dark theme, weight chart visible)
- [ ] WhatsApp message contains workout counts, kcal avg, protein avg, deficit, streak

### 5.6 Calendar
- [ ] Future logged activities show dashed border + 60% opacity
- [ ] Past unlogged workout days show as Skipped (pink)
- [ ] Past unlogged Rest days show as Rest (grey) — NOT Skipped
- [ ] Today has accent-coloured border
- [ ] Multi-activity days show primary type + "+" indicator

### 5.7 Keyboard navigation
- [ ] Food search: Enter key triggers search
- [ ] NL food entry: Enter key triggers parse
- [ ] Exercise name: Enter/blur triggers weight prefill lookup
- [ ] Barcode manual entry: Enter submits

---

## 6. REGRESSION TESTS (run after every major change)

These were previously broken and fixed — ensure they stay fixed:

- [ ] Removing last activity reverts day card to planned activity
- [ ] Clear workout button clears `dd.activities` array AND `dd.activity`
- [ ] `renderProgress()` called after food log, activity log, and water log
- [ ] `calcWeeklyDeficit` uses per-activity burn (not just `dd.activity`)
- [ ] `pushToSheets` is `async function` (not plain `function`)
- [ ] `pullFromSheets` is `async function`
- [ ] `no-cors` mode used for Google Apps Script POST
- [ ] Corrupted localStorage → app recovers gracefully
- [ ] `saveWeek` saves weekNotes from `weekNotesInput` element
- [ ] `importData` resets file input after import
- [ ] `renderShareCard` draws canvas correctly (not blank)
- [ ] PDF export includes full HTML body (not truncated)
- [ ] No `const act` undeclared reference errors in console
- [ ] Week comparison table shows mobile cards on ≤640px
- [ ] Tab switching scrolls active tab into view
- [ ] `addMealTemplate` on Home tab uses `activeMeal` silently (no popup)
- [ ] `addMealTemplateWithPicker` on Meals tab shows 4-button meal selector

---

## 7. APPS SCRIPT BACKEND TESTS

### 7.1 Read
```
GET https://[SCRIPT_URL]?action=read
Expected: { ok: true, data: { fitnessTracker: { ... } } }
```

### 7.2 Write
```
POST https://[SCRIPT_URL]
Body (text/plain): {"action":"write","data":{"fitnessTracker":{...}}}
Expected: { ok: true, written: ["fitnessTracker"] }
```

### 7.3 CORS
```
Response headers must include: Access-Control-Allow-Origin: *
```

### 7.4 Last-write-wins
**Test:** Manually set `_lastSaved` to a past timestamp in Sheets. Open app on phone.
**Expected:** Phone data (newer) wins — pushes local to Sheets. Does NOT get overwritten by stale Sheets data.


---

## 8. MULTI-PLAN SYSTEM TESTS

### 8.1 Migration (existing users)
**Test:** Open app with existing data (has `_startDate` and `_settings` but no `_plans`).
**Expected:** `migrateToPlanSystem()` runs automatically. `allData._plans = [{ id:'plan_1', name:'Plan 1', startDate: existingStartDate, settings: existingSettings }]`. `allData._activePlanId = 'plan_1'`. All existing food/activity/week data is completely untouched.

**Verify in console:**
```javascript
JSON.parse(localStorage.getItem('fitnessTracker'))._plans.length // → 1
JSON.parse(localStorage.getItem('fitnessTracker'))._activePlanId // → 'plan_1'
JSON.parse(localStorage.getItem('fitnessTracker'))['1'].weight   // → 168 (unchanged)
```

### 8.2 Creating a second plan
**Test:** Go to Settings → My plans → "+ Start a new plan". Fill in:
- Name: "Maintenance 2026"
- Start date: day after Plan 1 ends
- Total weeks: 52, Phase 1 weeks: 52 (maintenance = no phases)
- Goal 1: current weight (maintenance)
- Daily calorie target: 2250
**Expected:** New plan appears in the plan list with "● ACTIVE" badge. Week number resets to week 1 (of the new plan). Progress banner shows new goals. All historical food/activity data from Plan 1 is still visible on the calendar and in the History tab.

### 8.3 Switching between plans
**Test:** With 2 plans, tap "Set active" on Plan 1.
**Expected:**
- Plan 1 shows "● ACTIVE", Plan 2 does not
- Week number in banner changes to reflect Plan 1's week count
- Progress banner goals change to Plan 1's start weight and goal 1
- The calendar and history are unchanged (all data still there)
- `getSetting('totalWeeks')` returns Plan 1's value, not Plan 2's

### 8.4 Data isolation verification
**Test:** Create Plan 2. Log food and activity in Plan 2's week 1. Switch back to Plan 1.
**Expected:** Plan 1's data is unchanged. Plan 2's logged data is visible on the calendar on the correct dates. Switching plans never deletes or moves any data.

### 8.5 getStartDate() is stable
**Test:** Create Plan 2 with a start date 6 months later.
**Expected:** `getStartDate()` still returns Plan 1's start date (used as global calendar anchor). `getWeekStartDate(1)` still returns Plan 1's week 1 start. All week-to-calendar mappings are unchanged.

### 8.6 Plan-relative week numbering
**Test:** With Plan 1 starting Apr 22, create Plan 2 starting Nov 1 (week 29 globally).
**Expected:**
- Navigating to Plan 2's "week 1" = global week 29 = calendar week of Nov 1
- The week banner shows "Week 1 of 52 · Plan 2 — Maintenance 2026"
- `getActivePlanRelativeWeek(29)` returns 1
- `getActivePlanRelativeWeek(30)` returns 2
- `getPhase(29)` returns Phase 2 (or whatever Plan 2's phase structure is)

### 8.7 Settings apply to active plan only
**Test:** With Plan 1 active, change daily calorie target to 1800 in Settings. Switch to Plan 2.
**Expected:** Plan 2's daily calorie target is whatever was set for Plan 2, not 1800. Switch back to Plan 1 — target shows 1800 again. Plans have independent settings.

### 8.8 Progress banner reflects active plan
**Test:** Plan 1 goal = 154 lbs. Plan 2 goal = 168 lbs (maintenance). Switch between plans.
**Expected:** Progress banner "Goal 1" and progress bar change accordingly. The weight sparkline spans all logged weights regardless of active plan.

### 8.9 Validation — overlapping plan dates
**Test:** Create Plan 2 with a start date BEFORE Plan 1 ends.
**Expected:** User sees a warning dialog explaining the overlap. They can still proceed (it's allowed) or cancel. The app does not crash.

### 8.10 Export/Import preserves all plans
**Test:** Export backup JSON. Import it on another device (or after clearing localStorage).
**Expected:** Both plans are restored, including `allData._plans` and `allData._activePlanId`. Week data is all intact.

### 8.11 Post-plan logging still works
**Test:** Navigate past Plan 1's end date (week 28+). Log food, activity, weight.
**Expected:** Data logs normally. Week label shows "post-plan" if Plan 2 hasn't started yet, or Plan 2's week 1 if it has. No errors.

### 8.12 Calendar shows all plans' data
**Test:** With Plan 1 data in Apr–Oct, Plan 2 data in Nov+.
**Expected:** Calendar renders all weeks correctly. Plan 1's logged activities show in Apr–Oct. Plan 2's logged activities show in Nov+. No gaps or missing data.

---

## 9. REGRESSION TESTS — POST MULTI-PLAN (run after every plan system change)

- [ ] `getStartDate()` returns Plan 1's startDate (never Plan 2's)
- [ ] `getWeekStartDate(1)` returns the correct Monday of Plan 1's first week
- [ ] `getCurrentWeekFromDate()` computes global week from Plan 1's anchor — not remapped by Plan 2
- [ ] `getSetting('totalWeeks')` returns active plan's totalWeeks
- [ ] `getSetting('goal1')` returns active plan's goal1
- [ ] Logging food on any day persists correctly regardless of active plan
- [ ] The history tab shows ALL weeks from ALL plans (no plan filtering)
- [ ] `calcWeeklyDeficit()` uses active plan's calorie target
- [ ] `renderProgress()` shows active plan's weight goal and progress %
- [ ] `getPhase(currentWeek)` returns correct phase relative to active plan's start
- [ ] `migrateToPlanSystem()` is idempotent (calling it twice doesn't create duplicate plans)
- [ ] Importing old backup (no `_plans`) auto-migrates cleanly
- [ ] All 53 required functions still present and callable


---

## 10. DEEP AUDIT REGRESSION TESTS (2026-04-27)

These tests were added after a comprehensive deep-dive audit. Each corresponds to a specific bug found or fixed.

### 10.1 renderCalendar migration guard
**Test:** Open the Calendar tab before any other tab has triggered `loadAndRender`.
**Expected:** Calendar renders correctly without throwing `TypeError: Cannot read properties of undefined (reading 'find')` on `allPlans`. `migrateToPlanSystem()` is called at the top of `renderCalendar()` ensuring `_plans` always exists.

### 10.2 updatePlanSettingLive does NOT mutate plan object
**Test:** Open Settings → My Plans → change the "Total weeks" input on a plan tab. Do NOT click Save. Navigate away and back.
**Expected:** The plan's `totalWeeks` in `allData._plans` is still the original value. Only the summary display text updates. No state divergence between in-memory plan and localStorage.
**Console verify:** `JSON.parse(localStorage.getItem('fitnessTracker'))._plans[0].settings.totalWeeks` should still match what was last saved, not what's in the input.

### 10.3 pushToSheets data safety guard
**Test:** Simulate a failed pull by setting `allData = {}` in console, then trigger `autoPersist()`.
**Expected:** `pushToSheets()` is blocked and logs `'pushToSheets: allData appears empty — push blocked to prevent data loss'`. The Google Sheet is not overwritten.
**Console verify:** `_sheetsWriteBlocked` should be `true` in this scenario, and `autoPersist` should not push.

### 10.4 autoPersist checks _plans for real data
**Test:** After creating Plan 2, set `allData._startDate = null` in console. Trigger `autoPersist()`.
**Expected:** Push still proceeds because `allData._plans[0].startDate` exists (the multi-plan guard catches it even without legacy `_startDate`).

### 10.5 goal1ProgressLabel dynamic update
**Test:** Use the app with no active plan (delete `allData._plans` in console and refresh).
**Expected:** The "Goal 1 progress" label in the banner changes to "No plan active". The progress bar shows "Set up a plan in Settings to track goals".

**Test:** Set an active plan. Log weight below Goal 1.
**Expected:** Banner label returns to "Goal 1 progress". Progress bar shows the correct % to Goal 2.

### 10.6 confirmCustomEntry writes to activeMeal
**Test:** Set `activeMeal = 'dinner'` in console. Click "+ add manually to Lunch" on the Lunch section.
**Expected:** `addCustomEntryToMeal('lunch')` temporarily sets `activeMeal = 'lunch'`, then calls `addCustomEntry()` which shows the custom entry form. On confirm, `confirmCustomEntry()` reads `activeMeal` (now 'lunch') and writes there. Food appears in Lunch, not Dinner.

### 10.7 render() cascade — no explicit migrateToPlanSystem needed
**Test:** Hard reload the app. Immediately interact with any element that calls `render()` (e.g. change week).
**Expected:** No errors thrown. `getSetting()` → `getActivePlan()` → `migrateToPlanSystem()` cascade ensures `_plans` is initialised before any plan data is read, without `render()` needing to call `migrateToPlanSystem()` directly.

### 10.8 renderCalendar plan boundary labels
**Test:** With Plan 1 (Apr 22 – Nov 4), navigate to the Calendar tab.
**Expected:** A labelled divider appears at the top of the calendar reading `PLAN 1 ● ACTIVE — Starts 22 Apr 2026`. After week 28, a divider reads `POST-PLAN LOGGING — All data recorded as usual`. If Plan 2 exists, it gets its own divider at the correct week.

### 10.9 Calendar extends 26 weeks past today regardless of plan end
**Test:** Set plan totalWeeks to 4 (very short plan). Open Calendar tab.
**Expected:** Calendar shows at least today's week + 26 weeks of future rows, not just 4 weeks. `getCalendarWeeks()` returns `max(52, maxDataWeek, todayWeek + 26)`.

### 10.10 pushToSheets never called with empty allData
**Test:** Open app in fresh incognito window (no localStorage). Do not log in or set up a plan. Wait 2 seconds.
**Expected:** `pushToSheets()` is never called. `_sheetsWriteBlocked` remains `true`. No POST request made to the Apps Script URL. Console shows no sync activity.

### 10.11 plan-relative week labels in calendar
**Test:** With Plan 1 starting Apr 22, navigate to Calendar tab. Check the week label for the first week of April 22.
**Expected:** Label shows `Ph1 Wk1` with the date below. Week 16 (first week of Phase 2) shows `Ph2 Wk1`. Week 29 (post-plan) shows `Wk 29` with no phase prefix.

### 10.12 No-plan mode banner behaviour
**Test:** Delete `allData._plans` and `allData._startDate` from localStorage (simulate fresh install with no setup).
**Expected:**
- Start weight tile shows `—` with subtitle "No active plan"
- Goal 1 progress label shows "No plan active"
- Progress bar shows "Set up a plan in Settings to track goals"
- Phase tile shows `—` with "No active plan"
- Weekly deficit shows `—` if no maintenance set, or calculates normally if maintenance was set
- The app does not crash and remains fully usable for food/activity logging

