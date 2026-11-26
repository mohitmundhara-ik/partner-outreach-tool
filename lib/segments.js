// The outreach ecosystem: which segment each partner belongs to, which audience bands it reaches,
// and the plays to pitch on the call. Worked out from "Company type" and "Audience" in the sheet.
// Add a "Segment" column to the sheet to override the automatic choice for any row.
import { F, stage } from './fields';

export const SEGMENTS = [
  {
    key: 'hiring', name: 'Hiring industry', short: 'Hiring',
    blurb: 'Job portals, talent networks, campus and staffing platforms. Their users are actively trying to get hired, which is exactly when interview prep matters.',
    test: /job|hiring|hire\b|talent|staffing|recruit|campus|freelanc|salary|career/i,
    plays: [
      { title: 'Co-branded "Get interview-ready" masterclass', how: 'A free live session for their job seekers, run by an ex-FAANG IK instructor, promoted in their job-alert email or app push.', ask: 'One promo slot plus co-branding on the registration page.' },
      { title: 'Prep link after a rejection or failed assessment', how: 'Candidates who do not clear a round get a "prepare and reapply" link to free IK resources.', ask: 'A placement in their post-application or rejection flow.' },
      { title: 'Offer and salary negotiation session', how: 'A session for candidates at offer stage on levelling, competing offers and negotiation.', ask: 'Invite their offer-stage users.' },
      { title: 'Interview-prep content for their career pages', how: 'IK instructors write interview guides by role (backend, ML, EM). They get content, IK gets reach.', ask: 'A recurring content slot or blog series.' },
      { title: 'Mock interview day before a hiring drive', how: 'Free mock interviews with FAANG engineers for shortlisted candidates before their hiring events.', ask: 'Access to the drive audience and a joint announcement.' },
    ],
  },
  {
    key: 'communities', name: 'Communities', short: 'Communities',
    blurb: 'Developer communities, meetups, user groups and professional networks. High trust, and the organisers decide what their members see.',
    test: /communit|meetup|user group|open[- ]source|network|club|forum|chapter/i,
    plays: [
      { title: 'Speaker slot at the next meetup', how: 'An IK instructor gives a hands-on talk (system design, coding interviews, ML interviews) at their meetup.', ask: 'A 30 to 45 minute slot and a mention in the event post.' },
      { title: 'Mock interview night', how: 'Run live mock interviews on stage or in breakout rooms with volunteers from the community.', ask: 'Co-host one evening; IK brings the interviewers.' },
      { title: 'Sponsor a meetup', how: 'Cover venue or food in return for a short intro and an opt-in sign-up for a free IK webinar.', ask: 'Sponsor credit and a 10-minute slot.' },
      { title: 'Community-only perk', how: 'Members get early access to IK webinars and a tracked community code.', ask: 'Share the perk in their channel or newsletter.' },
      { title: 'Community ambassador', how: 'The organiser or a core member becomes an IK community ambassador with recognition and perks.', ask: 'One named ambassador per city or chapter.' },
    ],
  },
  {
    key: 'hackathons', name: 'Hackathons and dev platforms', short: 'Hackathons',
    blurb: 'Hackathon, assessment and developer platforms. Builders who are early in their careers or about to switch.',
    test: /hackathon|assessment|developer platform|coding|competitive/i,
    plays: [
      { title: 'Prizes for winners', how: 'Mock interview packs or IK programme scholarships as hackathon prizes.', ask: 'Listed as a prize sponsor.' },
      { title: 'Judges and mentors', how: 'IK instructors judge or mentor teams.', ask: 'Judge or mentor slots and a profile on the event page.' },
      { title: '"From hackathon to offer" workshop', how: 'A pre-event or post-event session on turning projects into interview stories.', ask: 'One workshop slot in the event schedule.' },
      { title: 'Co-branded challenge track', how: 'A system design or DSA challenge track designed by IK.', ask: 'A track in their next event.' },
    ],
  },
  {
    key: 'media', name: 'Newsletters and media', short: 'Media',
    blurb: 'Tech newsletters, publications and media houses. Reach at scale; the editor decides.',
    test: /newsletter|media|publication|blog|podcast|youtube|magazine|news/i,
    plays: [
      { title: 'Sponsored issue or classified', how: 'A short placement pointing readers to a free IK webinar.', ask: 'One sponsored slot to test response.' },
      { title: 'Guest series: interview teardowns', how: 'An IK instructor writes a short series breaking down real interview questions.', ask: 'Two to three guest posts.' },
      { title: 'AMA or podcast with a hiring manager', how: 'A FAANG hiring manager from IK answers reader questions.', ask: 'One episode or AMA thread.' },
      { title: 'Reader giveaway', how: 'Free mock interviews for the first readers who sign up.', ask: 'A giveaway mention.' },
    ],
  },
  {
    key: 'events', name: 'Conferences and events', short: 'Events',
    blurb: 'Tech conferences and event organisers. Concentrated, senior audiences on a fixed date.',
    test: /conference|event|summit|fest|organis|expo/i,
    plays: [
      { title: 'Talk or panel slot', how: 'A talk on how hiring and interviews are changing (AI, system design, levelling).', ask: 'One talk or panel seat.' },
      { title: 'Mock interview booth', how: 'Live 15-minute mock interviews at the venue with instant feedback.', ask: 'Booth space or a corner of the hallway track.' },
      { title: 'Attendee perk', how: 'A free IK webinar pass in the attendee kit or post-event email.', ask: 'Inclusion in the kit or follow-up email.' },
      { title: 'Scholarship and diversity passes', how: 'Co-fund passes for women and early-career engineers.', ask: 'Joint announcement of the passes.' },
    ],
  },
  {
    key: 'mentors', name: 'Mentors and creators', short: 'Mentors',
    blurb: 'Mentor marketplaces and creator platforms. Individuals with loyal followings.',
    test: /mentor|expert|creator|coach|influenc/i,
    plays: [
      { title: 'IK instructors as featured experts', how: 'List IK instructors for interview-prep sessions on their platform.', ask: 'A featured expert collection.' },
      { title: 'Co-hosted sessions with top creators', how: 'Creators on their platform co-host a free IK masterclass.', ask: 'Intros to their top tech creators.' },
      { title: 'Creator referral', how: 'Creators share IK webinars with a tracked link.', ask: 'Permission to run it with their creators.' },
    ],
  },
  {
    key: 'companies', name: 'Tech companies and tools', short: 'Companies',
    blurb: 'Product companies, startups and developer tools with their own user and developer communities.',
    test: /company|tool|startup|saas|product|ai\b/i,
    plays: [
      { title: 'Webinar for their developer users', how: 'Co-host a career session for the developers who use their product.', ask: 'Promotion to their user community.' },
      { title: 'Joint content: AI tools and interviews', how: 'A piece on how AI tools are changing how engineers are interviewed.', ask: 'Co-authored blog or LinkedIn live.' },
      { title: 'Their community events', how: 'An IK instructor speaks at events they run.', ask: 'A slot in their next event.' },
    ],
  },
  { key: 'other', name: 'Other', short: 'Other', blurb: 'Partners that do not fit a segment yet. Add a "Segment" column to the sheet to place them.', test: /$^/, plays: [] },
];

export const BANDS = [
  {
    key: 'students', name: 'Students and freshers', years: '0 to 1 yrs',
    test: /student|fresher|campus|early[- ]career|graduate|intern/i,
    hook: 'Landing a first job at a top product company.',
    plays: ['Placement-season DSA and coding interview bootcamp webinar', 'Resume and project review sessions', 'Campus ambassador programme through the partner'],
  },
  {
    key: 'seekers', name: 'Active job seekers', years: 'any level',
    test: /job[- ]?seek|candidate|job platform|job app/i,
    hook: 'Clearing interviews right now, with offers to compare.',
    plays: ['Free mock interview with a readiness score', 'Layoff and job-switch support sessions', 'Offer negotiation masterclass'],
  },
  {
    key: 'engineers', name: 'Working engineers', years: '2 to 6 yrs',
    test: /\bengineers?\b|developer|sdet|\bqa\b|practitioner|builder|programmer|contributor|tech professional|tech talent|in tech/i,
    hook: 'Switching to a higher tier company and a bigger role.',
    plays: ['"Switch to a top-tier company" masterclass', 'DSA plus system design roadmap session', 'Domain sessions: backend, frontend, ML, data, QA'],
  },
  {
    key: 'senior', name: 'Senior ICs and architects', years: '6 to 12 yrs',
    test: /senior|architect|tech leads?\b|technical leads?\b|\bleads\b|staff|principal|experienced|mid[- ]to[- ]senior|mid and senior|\bics?\b/i,
    hook: 'Senior, staff and principal interviews, where system design decides the level.',
    plays: ['System design deep-dive', 'Staff and principal interview prep', 'ML system design for senior ML engineers'],
  },
  {
    key: 'leaders', name: 'Leaders and founders', years: '12+ yrs',
    test: /leader|leadership|manager|\bcio|\bcto|founder|head|\bvp\b|director|management/i,
    hook: 'EM, director and executive interviews, and upskilling their teams.',
    plays: ['Engineering manager and director interview prep', 'Hiring-manager roundtable', 'Team upskilling conversation'],
  },
];

export const FOCUS = [
  ['AI and ML', /\bai\b|\bml\b|machine learning|genai|llm|voice ai|applied ai/i],
  ['Data', /\bdata\b/i],
  ['Backend and cloud', /backend|cloud|devops|\bsre\b|platform|kubernetes|\bgo\b|java|python/i],
  ['Frontend and web', /frontend|front-end|react|javascript|\bweb\b|full-stack/i],
  ['QA and testing', /\bqa\b|test|sdet/i],
  ['Security', /security/i],
  ['Product and growth', /product|growth/i],
  ['Women in tech', /women/i],
];

const text = (r) => [r[F.companyType], r[F.company]].join(' ');

export function segmentOf(r) {
  const set = String(r[F.segment] || '').trim().toLowerCase();
  if (set) {
    const hit = SEGMENTS.find((s) => s.key === set || s.name.toLowerCase() === set || s.short.toLowerCase() === set || s.name.toLowerCase().startsWith(set));
    if (hit) return hit;
  }
  return SEGMENTS.find((s) => s.test.test(r[F.companyType] || '')) || SEGMENTS.find((s) => s.test.test(text(r))) || SEGMENTS[SEGMENTS.length - 1];
}

export function bandsOf(r) {
  const a = String(r[F.audience] || '');
  const out = BANDS.filter((b) => b.test.test(a));
  if (!out.length && segmentOf(r).key === 'hiring') return [BANDS[1]];
  return out;
}

export function focusOf(r) {
  const a = [r[F.audience], r[F.companyType], r[F.company]].join(' ');
  return FOCUS.filter(([, re]) => re.test(a)).map(([n]) => n);
}

export const isCompetitor = (r) => /COMPETITOR/i.test(r[F.notes] || '') || /sells (courses|programs?)/i.test(r[F.companyType] || '');

/** A short label for the single most useful thing to do with this partner now. */
export function nextAction(r, today, { hasEmail, missing }) {
  const st = stage(r[F.status]);
  if (isCompetitor(r) && st === 'new') return { label: 'Check competitor flag', tone: 'red' };
  if (st === 'new') {
    if (!hasEmail) return { label: r[F.form] ? 'Submit partner form' : 'Find a contact', tone: 'amber' };
    if (missing.length) return { label: 'Add ' + missing[0], tone: 'amber' };
    return { label: r[F.draftedOn] ? 'Send drafted email' : 'Ready to send', tone: 'blue' };
  }
  if (st === 'sent') {
    if (r[F.followUp] && r[F.followUp] <= today) return { label: 'Follow up today', tone: 'amber' };
    return { label: 'Waiting for reply', tone: 'grey' };
  }
  if (st === 'replied') return { label: 'Book the call', tone: 'green' };
  if (st === 'call') return { label: 'Pitch a play', tone: 'green' };
  return { label: 'Closed', tone: 'grey' };
}
