# IK Partner Outreach

A small web app on top of your outreach Google Sheet:

- **Today**: drafted / sent / replies today against a daily goal, follow-ups due, who to do next, last 14 days.
- **Partners**: search and filter, change status inline, open a partner to edit details and the email.
- **Save as Gmail draft**: puts the email in your Gmail Drafts with **Interview Kickstart** and **30-minute** in bold. It never sends. You send from Gmail.
- **Update from Gmail**: marks rows Sent or Replied by checking your mailbox.
- **Add partner**: builds the email from the fixed master text (only company, initiative and name change).

Your Google Sheet stays the database. Columns are found by their header names (Company, Company type, Status,
To email, CC email, Subject, Email body, ...), so you can reorder or add columns. The Status options come from the
sheet's own dropdown. The app adds a few tracking columns at the far right of the Emails tab if missing
(Drafted on, Follow-up due, Replied on, Call booked on, Last updated) and never moves your existing columns.

No partner data lives in this repo: without the backend configured, the app shows four made-up demo rows.

## Setup (about 5 minutes)

### 1. Google Sheet backend
1. Open your outreach Google Sheet (with the `Emails` and `Master email` tabs).
2. Extensions > Apps Script. Paste everything from `apps-script/Code.gs`.
3. Change `TOKEN` at the top to a long random secret. Save.
4. Choose the `authorize` function in the toolbar and click Run. Approve access
   (Advanced > Go to project > Allow; it is your own script).
5. Deploy > New deployment > type **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy.
6. Copy the Web app URL (ends in `/exec`).

"Anyone" only means the URL can be called; every request must carry your secret token, and Vercel keeps it server-side.

### 2. Vercel environment variables
Project > Settings > Environment Variables:

| Name | Value |
| --- | --- |
| `APPS_SCRIPT_URL` | the `/exec` URL from step 1.6 |
| `APPS_SCRIPT_TOKEN` | the same secret as `TOKEN` |
| `APP_PASSWORD` | the password you'll use to open the app |

Then redeploy. Without `APPS_SCRIPT_URL` the app runs in demo mode with your 50 partners and saves nothing.

### Changing the backend later
After editing `Code.gs`, use Deploy > Manage deployments > Edit > Version: New version, so the URL stays the same.

## Local development
```
npm install
cp .env.example .env.local   # fill in values, or leave empty for demo mode
npm run dev
```

## Partner Hub features

- **Command center**: today's sends against a daily goal, reply rate, funnel, 14-day activity, ecosystem coverage, audience reach and a "Do next" list.
- **Ecosystem**: partners grouped into segments (hiring industry first, then communities, hackathons and dev platforms, newsletters and media, conferences and events, mentors and creators, tech companies). Each segment hub lists its partners, who they reach, and a playbook of ideas to pitch on the call. The segment comes from "Company type"; add a **Segment** column to the sheet to override it for any row.
- **Audience map**: segment × career band (students and freshers, active job seekers, working engineers, senior ICs and architects, leaders and founders), worked out from the "Audience" column, with offers that work for each band.
- **Pipeline**: board by stage. **All partners**: searchable table with inline status.
- **Send now**: sends one partner's email from your Gmail after a confirm step. If a Gmail draft with the same subject and recipient exists, that draft is sent. The row becomes Sent, Sent on is today and the follow-up is set for 5 days later. Rows that are not "Not sent" are never re-sent.
- **Sync**: checks Gmail for sent emails and replies, updates the sheet, and reloads everything.

After changing `apps-script/Code.gs`, paste it into Apps Script, Save, then Deploy > Manage deployments > Edit > New version > Deploy (the URL stays the same).
