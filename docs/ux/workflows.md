# Workflows and Interaction States

Each workflow lists steps, decisions, and required states. "→" means navigation; "⟳" means loading; "⚠" means error handling.

## W1. Onboarding (first visit)
1. Home → **Create a CV** → `/start`.
2. Pick a profession card (or type it). No account, no cookie wall beyond the legally required notice.
3. System creates a document from the preset: sections, section order, default template, field hints, example lines.
4. → Guided creation step 1.

Returning visitor: Home shows "Continue your CV" card; `/start` shows "You have 2 CVs on this device" link.

## W2. Guided CV creation
Steps are generated from the preset. Common base, then profession extras:

| Step | Fields (required in bold) | Driver | Nurse | Teacher | Tech | Student |
|---|---|---|---|---|---|---|
| 1 About you | **Full name**, job title you want, phone, email, town/city | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 Work | Job title, employer, place, dates (month/year, "I work here now"), what you did | ✓ | ✓ | ✓ | ✓ | optional |
| 3 Education | Qualification, school, year | short | ✓ | ✓ | ✓ | **first** |
| 4 Skills | Chips with suggestions per preset | ✓ | ✓ | ✓ | ✓ | ✓ |
| Extras | — | Licences, vehicles, routes | Registration, certifications, clinical areas | Certifications, subjects | Projects, links | Projects, activities |
| Summary | 2–3 sentence summary (Phase 4: generated from the above) | ✓ | ✓ | ✓ | ✓ | ✓ |

Interaction rules:
- One question group per screen; labels as questions ("Where did you work?").
- Each field shows an example in the placeholder or helper text relevant to the preset.
- "What did you do?" uses simple bullet input: Enter adds a line; each line becomes a bullet.
- Dates: month + year pickers; "I still work here" checkbox; no strict validation of gaps.
- Only the full name is truly required to proceed; everything else is skippable.
- Autosave on every change (debounced 400 ms). Status: "Saving…" → "Saved on this device".

## W3. AI-described CV (Phase 4)
1. `/start` text box: "I want a simple CV for a delivery driver with my experience and contact information."
2. ⟳ "Understanding what you need…" (≤ 5 s typical; skeleton of the document).
3. Result card: "Here's what I set up: a one-page CV for a delivery driver, with sections for licences and work history, in the Clarity design with a dark blue accent." Buttons: **Looks good** · Change something.
4. Guided creation continues with those choices; AI never fills in employers or dates.
⚠ AI unavailable / limit reached → show profession cards with a one-line explanation; no dead end.

## W4. Design selection and AI design interpretation
Non-AI (Phase 3): Design tab → style card or template → colour → fonts → spacing; instant preview.
AI (Phase 4): "Describe a style" → "modern professional, blue, clean and elegant" → system returns a **design spec** (template, palette, font pair, density, heading style) + a plain-language explanation → applied with a single **Undo**. "Show me other options" returns two alternatives as small previews.

## W5. Editing
- Click a preview element → Content tab opens the matching entry and focuses the field.
- Reorder entries and sections with ▲▼ buttons (keyboard accessible) and drag on pointer devices.
- Delete shows an undo toast; nothing destructive needs a confirmation dialog except deleting a whole CV.
- Undo/redo: Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, and studio bar buttons; history kept for the session.
- Leaving with pending save: flush save first; browser `beforeunload` warning only if a save failed.

## W6. AI writing help (Phase 4)
1. Next to a description: **Help me write ▾** → Improve wording · Make shorter · Make it more professional · Write from my notes.
2. ⟳ inline shimmer in the field (not a page spinner).
3. Suggestion shown as a diff-like card beneath the field: **Use this** · Try again · Dismiss.
4. If the AI wants a fact it does not have (e.g., a number), it inserts a highlighted placeholder like `[how many deliveries per day?]`; the CV shows a "needs your input" warning on Download until resolved.

## W7. Export
Download page → checklist → **Download PDF** ⟳ "Preparing your PDF…" (typ. 1–3 s) → browser download.
⚠ PDF service fails → message "We couldn't create the PDF just now" + **Print / Save as PDF** (opens the same document in the browser's print dialog) + Try again.

## W8. Backup and restore (no account)
My CVs → Download backup (JSON of all CVs) / Restore from backup (validates; shows what will be added; never overwrites without consent).

## W9. Accounts (Phase 6)
Sign in (email link or Google) → "Bring your 2 CVs from this device into your account?" → sync. Sign out keeps a local copy only if the user chooses. Delete account → confirmation by typing "delete" → data erased within 24 h.

## W10. Cover letter (Phase 7) and Portfolio (Phase 9)
Specified in their phases; they reuse W5 editing, W6 AI help, and W7 export patterns.

## Universal states

| State | Pattern |
|---|---|
| Empty | Short sentence + one primary action; never a blank panel |
| Loading (< 300 ms) | Nothing (avoid flashing) |
| Loading (> 300 ms) | Skeleton that matches the final layout; for AI, inline shimmer + a sentence of what is happening |
| Success | Brief toast or inline check; celebrate only meaningful milestones (first CV finished, first download) |
| Validation | Inline under the field, in words ("This email looks incomplete"), not colour alone |
| Recoverable error | Inline banner with what happened, what to do, and a retry |
| Offline | Banner "You're offline. Changes are saved on this device." Editing continues; PDF uses Print fallback |
| Destructive action | Undo toast (8 s) instead of confirm dialogs, except account/CV deletion |
