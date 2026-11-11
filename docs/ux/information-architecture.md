# Information Architecture, Navigation and Page Specs

## Site map

```
/                         Home (what it is, examples, "Create my CV")
/start                    Start: "What kind of work do you do?" (profession or free text)
/cv                       My CVs (this device; later: account)
/cv/[id]/guided           Guided creation (step-by-step)
/cv/[id]                  Studio editor: Content · Design (+ live preview)
/cv/[id]/download         Final check & download
/templates                Template gallery (try with sample or your CV)
/help                     Help, FAQ, privacy in plain words
/privacy  /terms          Legal
── Phase 6+ ──
/sign-in   /account
── Phase 7+ ──
/letters  /letters/[id]
── Phase 9+ ──
/portfolio  /p/[slug] (public)
```

Rule: a user never needs more than **two clicks from Home to start writing**, and never more than **one click from the editor to download**.

## Navigation model

### Global (marketing and list pages)
Top bar: logo (→ Home) · "My CVs" · "Designs" (route `/templates`) · "Help" · primary button **Create a CV**. On phones: logo, primary button, and a menu button opening the same links in a sheet.

### Focused (guided flow and editor)
Global navigation is replaced by a slim **studio bar**: back to My CVs · CV name (click to rename) · save status ("Saved on this device") · Undo · Redo · **Download**. Reducing chrome keeps attention on the document.

### Editor layout by breakpoint
| Width | Layout |
|---|---|
| ≥ 1024 px | Left panel (Content / Design tabs, 420–480 px) + right live preview (scaled A4 pages) |
| 640–1023 px | Single panel; floating "Preview" button opens preview full-screen |
| < 640 px | Bottom tab bar: **Edit · Design · Preview**; Download in studio bar |

## Page specifications

### Home `/`
- **Purpose:** explain in five seconds; get people started.
- **Content:** headline ("A professional CV, in your own words"), sub-line, primary CTA, secondary "See templates"; a real rendered CV example per persona (driver, teacher, engineer) in a gentle carousel; three-step explainer (Tell us · We design · You download); trust strip (free PDF, no invented facts, your data stays on your device); FAQ teaser; footer.
- **States:** returning user with saved CV sees "Continue your CV — <name>, edited 2 days ago" above the fold.

### Start `/start`
- **Purpose:** pick a starting point in one tap.
- **Content:** question "What kind of work do you do?"; 8 profession cards with icon and one-line example (Driving & delivery, Teaching, Healthcare & nursing, Retail & hospitality, Trades & construction, Office & admin, Technology & engineering, Management & executive) + "Student or first job" + "Something else (type it)". Below: link "I already have a CV" (Phase 5: import; until then: "start and copy your details in").
- **Phase 4:** a single text box above the cards: "Or describe what you need" with an example placeholder.
- **Result:** creates a CV with the preset's sections and template, then routes to guided creation.

### My CVs `/cv`
- **Purpose:** find, continue, duplicate, delete.
- **Content:** cards with thumbnail (first page render), name, template, last edited; actions Continue · Duplicate · Download · Delete (undo toast for 8 s). Banner: "Your CVs are saved in this browser. Download a backup to keep them safe." (with Download backup / Restore).
- **Empty:** illustration-free friendly message + Create a CV.

### Guided creation `/cv/[id]/guided`
- **Purpose:** collect content with zero blank-page anxiety.
- **Structure:** progress indicator (Step 2 of 6, with names); one topic per step; examples under each field; "Skip for now"; Back / Continue. Steps vary by preset (see `workflows.md`).
- **Side panel (desktop):** live preview that fills in as they type. Mobile: "Peek at your CV" button.
- **Exit:** "Finish" → editor with a short celebratory success message and "Download" highlighted.

### Studio editor `/cv/[id]`
- **Content tab:** collapsible cards per section in document order. Each entry is a compact row (title, organisation, dates) that expands to fields. Section menu: Rename · Hide from CV · Move up/down · Remove. "Add section" offers only sections relevant to the preset first, others under "More".
- **Design tab:** Style cards → Template → Colour → Fonts → Spacing → Page size. Every option previews instantly on the real document.
- **Preview:** true pages (A4/Letter), page numbers, zoom (fit/100%); clicking text focuses its field.
- **AI (Phase 4):** small "Help me write" buttons next to summary and descriptions; "Describe a style" box at the top of the Design tab.

### Download `/cv/[id]/download`
- **Purpose:** last check and export.
- **Content:** full preview; checklist ("Phone number added ✓", "Dates look consistent ✓", "2 pages") with links to fix; buttons **Download PDF**, Print, Download backup (JSON). Name the file `Firstname-Lastname-CV.pdf`.

### Templates `/templates`
- Grid of templates rendered with sample content per profession (switchable); "Use with my CV" if one exists, else "Start with this design".

### Help `/help`
- Plain-language FAQ: Is it free? Where is my data? What is "ATS"? How does the AI help? Can I use it on my phone? Contact.

## Content hierarchy rules
- One primary action per screen (filled button). Secondary actions are outlined or text buttons.
- Headlines say what the user achieves, not what the system is ("Add your work history", not "Experience section").
