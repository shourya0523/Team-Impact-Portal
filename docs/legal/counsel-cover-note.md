# Cover note for Team Impact's counsel

**From:** Team Impact app delivery team (ACM) · **Re:** Terms of Use, Privacy Policy and Acceptable Use Policy, version `2026-11-draft.1` (TI-107) · **Needed by:** before the November 2026 App Store submission, for the December Tufts pilot

## What we're asking

1. Review the three attached drafts: [Terms of Use](terms.md), [Privacy Policy](privacy.md) and [Acceptable Use Policy](acceptable-use.md). They are written by the product team in plain language, are **not legal advice**, and contain `[placeholders]` for things only Team Impact or you can supply.
2. Answer the five open questions below (PRD §11). Each one ships in the pilot with the behaviour shown and has a fallback ready, so a "no" is a small change, not a redesign.
3. Tell us what must change before users can accept these documents. We will issue the approved text as version `2026-11`.

## How the documents work in the product

- Users accept all three together at sign-up. The app records which version each user accepted, and when, in an append-only consent record. Any change to the text creates a new version.
- Teens (13–17) also confirm at sign-up that a parent or guardian agreed, and that confirmation is recorded with the version.
- Children under 13 never have accounts. A parent runs a child's profile, which only the team and family can see.
- No health or diagnosis information is collected. The only trace is private membership of a medical community.

## The five questions (PRD §11)

| #   | Question for counsel                                                     | Pilot ships with                                                                                                                                                           | Fallback if counsel says no                                                                 | Where in the drafts                              |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | May recruiters filter athletes by identity through official communities? | Live from day one, behind one feature flag; athletes opt in separately per community and can withdraw anytime; every search logged with recruiter, company and time        | Turn the flag off; search keeps every neutral filter                                        | Privacy §3; Terms §8; Acceptable Use, Recruiters |
| 2   | May teens 13–17 use the app without a verified parent link?              | Terms confirm a parent or guardian agreed; the confirmation and terms version are recorded                                                                                 | Parent enters an email and confirms with one tap; the teen can't post or comment until then | Terms §3; Privacy §4                             |
| 3   | May posts that show or tag a child leave the child's team?               | Not decided; the drafts tell users to post or tag a child only in the child's team community                                                                               | Posts tagging a child stay inside the team                                                  | Terms §6; Acceptable Use, Protect children       |
| 4   | May families and athletes contact each other directly?                   | Athletes choose which contact details (phone, email, LinkedIn) families on their team see; no in-app messaging                                                             | Not yet defined                                                                             | Terms §7; Privacy §2; Acceptable Use, Contacts   |
| 5   | May anyone create medical communities, with private membership?          | Any adult except recruiters creates and joins; membership never on a profile, in search or a recruiter filter; moderated; no child tags outside the team; teens can't join | Hide the medical kind everywhere with one switch                                            | Terms §10; Privacy §5                            |

Also needing Team Impact's confirmation (not a counsel question): that Team Impact is comfortable with direct athlete–family contact outside the app.

## Other points we'd like you to check

- **Minors framework.** Which laws apply to teen accounts (COPPA for under-13 profiles run by parents, state minors' privacy laws, app store age ratings), and whether a "parent agreed" checkbox is enough (question 2).
- **Processors.** DigitalOcean (hosting, database, cache, file storage, backups), OpenAI (moderation of every post, comment and event; resume text only when Team Impact enables it, with contact details removed), Expo with Apple/Google (push), and a transactional email provider still to be chosen. Whether data processing agreements are in place, and OpenAI's data-use terms.
- **Retention.** Deleted accounts are hidden at once and erased after 30 days, including from backups once their retention window passes; the backup window needs a number. The activity log keeps 365 days. How long to keep consent records after an account is deleted.
- **Recruiter access.** Anyone with a verified email at a staff-onboarded partner company gets access (an accepted risk in the PRD); the drafts add use restrictions and logging.
- **Placeholders.** Legal entity name and address, contact emails, governing law, disclaimers and limitation of liability (Terms §14–15), data location.
- **Hosting.** Where the final text will be published (App Store Connect needs a privacy policy URL).

## Contacts

Product: ACM project lead (Shourya Yadav). Questions about how a feature behaves can go to the delivery team through Team Impact.
