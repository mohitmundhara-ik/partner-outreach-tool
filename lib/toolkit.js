// The call toolkit for one partner: how to open, what to ask, what to say, what to offer, how to handle
// pushback and how to close. Built from the first-call kit and tuned to the row: segment, audience,
// the initiative in our email, and what they said in their reply.
// Only confirmed IK facts are stated. Anything commercial (rev-share %, budgets, seats) is "confirm first".
import { F, stage, prettyDate } from './fields';

const has = (re, s) => re.test(String(s || ''));

/** What their reply tells us, as simple flags. */
export function signalsOf(row) {
  const t = [row[F.reply], row[F.replyType], row[F.notes], row[F.next]].join(' \n ').toLowerCase();
  return {
    paid: has(/sponsor|paid|pricing|price|package|deck|brochure|tier|budget|\bfee\b|commercial|branding/, t),
    noRevShare: has(/(no|don'?t|do not|not) (do )?(a )?revenue[- ]share|revenue[- ]share is not/, t),
    event: has(/event|conference|summit|\bfest\b|devfest|meetup|hackathon|expo|celebration|edition/, t),
    students: has(/student|college|campus|fresher|universit/, t),
    info: has(/website|link|more (info|details)|share (more|details)|send (us|me) (some|more|the)|deck|brochure|proposal/, t),
    time: has(/monday|tuesday|wednesday|thursday|friday|saturday|next week|tomorrow|\b\d{1,2}\s*(am|pm)\b|slot/, t),
    referral: has(/colleague|reach out to|right person|loop(ing|ed)? in|cc'?d|in touch with|handles partnerships|forward(ed)?/, t),
    later: has(/busy|later|next month|after the|post the|january|february|q1|not right now|not now/, t),
    knowledge: has(/knowledge partner|community partner|speaker|talk|session|workshop/, t),
    interested: has(/interest|sounds (good|great|interesting)|happy to|keen|let'?s (connect|talk|discuss)|can (connect|discuss)|would love/, t),
  };
}

/** First name of the person who replied: from 'Abhijeet Yadav (Role, Org): "..."', else the email greeting. */
export function contactName(row) {
  const r = String(row[F.reply] || '').trim();
  const m = r.match(/^([A-Z][a-z]+)(?:\s+[A-Z][A-Za-z.]*){0,2}\s*[(:,]/);
  if (m && !/^(they|their|the|we|our|thanks|thank|hi|hello)$/i.test(m[1])) return m[1];
  const g = String(row[F.body] || '').match(/^Hi ([^,\n]+),/);
  return g ? g[1].split(' ')[0] : '';
}

const SEG_Q = {
  hiring: ['What do your users look for most around interviews: company questions, salary data, prep guides?', 'Do you run webinars, newsletters or in-app features for job seekers that partners can join?', 'Have you done affiliate or revenue-share deals with learning brands before? What worked?'],
  campus: ['Which colleges and which years are most active with you?', 'When are placement season and your next fest or contest?', 'Do partners add prizes or sessions for finalists and winners?'],
  communities: ['How often do you meet, and how many people usually show up?', 'Which topics bring the biggest turnout?', 'Would an IK instructor as speaker or AMA guest fit your calendar?'],
  hackathons: ['Who takes part: students, freshers or working developers?', 'What does a prize or track partner get, and what do they give?', 'Could finalists get a career-track session after the event?'],
  media: ['What is your reader mix by role and seniority, and your typical open rate?', 'Which sponsored formats do you offer, and what does each include?', 'Do you take expert articles or bylines from practitioners?'],
  events: ['Dates, city, expected attendees and their mix (students, engineers, leaders)?', 'Which partner options exist: knowledge partner, talk or workshop slot, booth, sponsor tiers?', 'What is the deadline to lock the programme and partner list?'],
  mentors: ['What do mentees ask for most, and how do they find mentors on your platform?', 'Would a co-hosted IK masterclass or featured expert collection fit?', 'How do creators on your platform usually promote partner sessions?'],
  companies: ['Do you run a developer community, newsletter or events for your users?', 'Would a joint career webinar for your users fit your plans?', 'Who owns community and partnership decisions on your side?'],
};

const MUST_Q = [
  { q: 'Who is your core audience: students, freshers, working engineers, senior engineers or leaders? Roughly what split?', why: 'Tells you which offer to lead with.' },
  { q: 'How big is the reachable base (members, subscribers, attendees) and how engaged is it?', why: 'Sizes the opportunity before you promise anything.' },
  { q: 'What are you trying to grow in the next 6 to 12 months: engagement, revenue, new programmes, events?', why: 'Lets you pitch against their goal, not ours.' },
  { q: 'Have you partnered with learning or upskilling brands before? What worked and what did not?', why: 'Shows what they expect and what to avoid.' },
  { q: 'How do partnerships usually work for you: revenue share, affiliate, paid sponsorship, knowledge partner, or a mix?', why: 'Decides the commercial model.' },
  { q: 'What would a good first pilot look like for you, and who else needs to say yes?', why: 'Gets you to a concrete next step and the decision maker.' },
];

const OBJECTIONS = [
  { key: 'paid', they: '"We only do paid sponsorships, not revenue share."', you: 'That makes sense. Could we start with one small free pilot, like a masterclass for your audience, so you see the response before we talk about a paid slot? If a paid package is the only route, please send the options and pricing and I\'ll take it to our team. (Never commit budget on the call.)' },
  { key: 'paid', they: '"Could we do a hybrid?"', you: 'Yes, worth exploring: a smaller fixed fee plus a share on enrolments. Let me check what we can do and come back with a proposal.' },
  { key: 'any', they: '"We have our own courses."', you: 'We are not trying to replace them. We focus on one narrow thing, interview prep for top product companies, for engineers who are already working. Our sessions can sit beside your programmes as an add-on.' },
  { key: 'any', they: '"Interview prep is not a focus for our community."', you: 'Understood. Many of our sessions are broader career topics, like system design or growing into senior roles. Would any of those fit?' },
  { key: 'students', they: '"Our audience is mostly students."', you: 'Then let\'s keep it simple and free: a masterclass, prize seats or one-on-one sessions for winners. No pressure on enrolments.' },
  { key: 'any', they: '"What results do your learners get?"', you: 'Say only: 12 years, 27,000+ engineers, MAANG+ instructors. For outcomes or placement data: "Let me send you the latest numbers by email."' },
  { key: 'any', they: '"How will we track it?"', you: 'You get your own tracked link (and a code for offline events). Anyone who signs up or enrols through it is credited to you, and we share a simple monthly report.' },
  { key: 'later', they: '"Send us something and we\'ll get back."', you: 'Happy to. To make it useful, which one offer should I put the proposal around, and who else should see it? Then agree a follow-up date before you hang up.' },
  { key: 'any', they: '"We need exclusivity."', you: 'Don\'t agree on the call: "Let me check that internally and come back to you."' },
];

/** The whole kit for one row. `seg` and `bands` come from lib/segments. */
export function toolkit(row, seg, bands) {
  const st = stage(row[F.status]);
  const s = signalsOf(row);
  const name = contactName(row);
  const company = row[F.company];
  const init = String(row[F.initiative] || '').trim();
  const callOn = row[F.meetingOn] ? (String(row[F.next] || '').match(/^Call (.+)$/)?.[1] || prettyDate(row[F.meetingOn])) : '';
  const band = bands[0];

  // Where things stand and the one goal for the call.
  let goal = 'Leave the call with one pilot, one owner on each side, and a date.';
  if (s.paid || s.noRevShare) goal = 'Get their options, price, deliverables and audience data in writing so the IK team can decide go or no-go. Do not commit budget on the call.';
  else if (s.knowledge && seg.key === 'events') goal = 'Lock a talk, workshop or knowledge-partner slot with a date, and agree how attendees reach IK afterwards (tracked link or code).';
  else if (s.students || seg.key === 'campus') goal = 'Agree one free pilot (session, prizes or one-on-ones) with a date. Keep enrolment expectations low.';
  else if (s.later) goal = 'Keep it light: learn their calendar, agree when to reconnect, and leave one idea they can say yes to later.';
  const where = [
    row[F.reply] && { label: 'What they said', text: row[F.reply] },
    callOn && { label: 'Call', text: callOn },
    row[F.next] && !/^Call /.test(row[F.next]) && { label: 'Next step', text: row[F.next] },
    init && { label: 'Hook in our email', text: init },
    row[F.audience] && { label: 'Audience', text: row[F.audience] },
  ].filter(Boolean);

  // How to open.
  const hi = name ? `Thanks for making time, ${name}.` : 'Thanks for making time today.';
  const why = init ? ` I reached out because of ${init}, and I'd love to hear more about it.` : '';
  const heard = s.paid ? ` I saw your note about your partner options, so I'd like to understand those and also share what we can bring.`
    : s.event ? ' I\'d like to understand the event and where we could add value for your attendees.' : '';
  const open = [
    `${hi} I'm Mohit from Interview Kickstart.${why}${heard}`,
    'For the next 30 minutes I\'d like to understand your audience and plans, share two or three ways we could add value for them, and, if it fits, agree on one small pilot. Does that work? Anything you want to make sure we cover?',
  ];
  const agenda = [
    ['0 to 3 min', 'Open: thanks, agenda, ask what they want from the call.'],
    ['3 to 15 min', 'Discovery: listen more than you talk. Use the questions below.'],
    ['15 to 22 min', 'Pitch: IK in one minute, then two offers picked for their audience.'],
    ['22 to 27 min', s.paid ? 'Commercials: their paid options, our ask for a pilot or hybrid.' : 'Commercials: tracked link and revenue share, or their model.'],
    ['27 to 30 min', 'Close: one pilot, one owner each side, one date.'],
  ];

  // What to ask: the must-asks, then questions for their segment and for what they said.
  const ask = [];
  if (init) ask.push({ q: `What is planned for ${init}, and where do partners usually plug in?`, why: 'Starts from their initiative, which is why we wrote.' });
  if (s.event || seg.key === 'events') ask.push({ q: 'Dates, city, expected footfall and attendee mix?', why: 'Decides whether a talk, booth or post-event offer is worth it.' });
  if (s.paid) ask.push({ q: 'What does each package include, what does it cost, and do partners get registrant or lead data?', why: 'You need this in writing for a go or no-go.' }, { q: 'Is there a lighter option: a single session, newsletter slot or a hybrid with a share on enrolments?', why: 'Opens a smaller first step.' });
  if (s.noRevShare) ask.push({ q: 'Have past partners combined a fixed fee with a share on results?', why: 'Tests if a hybrid is possible.' });
  if (s.referral) ask.push({ q: 'Who else should be in the next conversation, and what do they care about?', why: 'Gets you to the decision maker.' });
  if (s.later) ask.push({ q: 'When is a better time to pick this up, and what is on your calendar until then?', why: 'Gives a real date to follow up.' });
  MUST_Q.forEach((m) => ask.push({ ...m, must: true }));
  (SEG_Q[seg.key] || []).forEach((q) => ask.push({ q, why: `${seg.name} partners` }));

  // What to say: the 90-second pitch, tuned to their audience.
  const say = [
    { beat: 'Their audience\'s problem', text: band ? `${band.name} (${band.years}) care about one thing: ${band.hook.charAt(0).toLowerCase() + band.hook.slice(1)}` : 'Working engineers want better roles at top product companies, but interviews at that level are hard to prepare for alone.' },
    { beat: 'Who we are', text: 'Interview Kickstart has spent 12 years helping engineers prepare for these interviews. 27,000+ engineers have trained with us, taught by MAANG+ engineers and hiring managers.' },
    { beat: 'What we would do for them', text: `Free, high-value sessions for ${company}'s audience: live masterclasses, one-on-one sessions and offline meetups. You pick topics and format; we bring content, speakers and logistics.` },
    { beat: 'Why it works for them', text: s.paid ? 'Your audience gets practical career content, and we can talk about the commercial model that suits you.' : 'Your members get content they ask for, you get fresh programming without extra work, and when someone enrols through your link you earn a share.' },
    { beat: 'Ask', text: '"Which of these would land best with your audience?"' },
  ];

  // What can be done: offers for their segment and audience.
  const offers = (seg.plays || []).slice(0, 4).map((p) => ({ title: p.title, how: p.how, ask: p.ask }));
  const extra = bands.slice(0, 2).map((b) => ({ band: b.name, hook: b.hook, plays: b.plays }));

  // If they say...
  const objections = OBJECTIONS.filter((o) => o.key === 'any' || s[o.key] || (o.key === 'students' && seg.key === 'campus'))
    .sort((a, b) => (a.key !== 'any' ? -1 : 0) - (b.key !== 'any' ? -1 : 0));

  // Close and after the call.
  const pilot = offers[0]?.title || 'one free masterclass for their audience';
  const close = [
    `Recap the one offer you both like (for example: ${pilot.toLowerCase()}) and the model (revenue share, knowledge partner, or their paid option to review).`,
    'Name the owner on their side and confirm their email.',
    'Agree dates: proposal sent by when, pilot on when.',
    s.paid ? 'Ask them to email the package options and pricing so the IK team can review.' : 'Tell them you\'ll send a short recap and a tracked link within 24 hours.',
  ];
  const after = [
    'Send the recap email within 24 hours (one offer, owners, dates).',
    'Update the row: Partnership stage, Next step, and Notes with what you learned.',
    !row[F.link] && 'Create their tracking link in Company details if a pilot is agreed.',
    s.paid && 'Share the package and price with the IK team for a go or no-go.',
  ].filter(Boolean);

  const facts = ['12 years helping engineers', '27,000+ engineers trained', 'MAANG+ engineers and hiring managers as instructors', 'Free masterclasses, one-on-ones and offline meetups for partner audiences, plus a share when people enrol'];
  const dont = ['Quote a revenue-share %, payout, seat count, discount or budget. Say "I\'ll confirm that by email."', 'Name other partners or competitors.', 'Agree to exclusivity on the call.', 'Share placement or outcome numbers you have not confirmed.'];

  return { st, signals: s, name, goal, where, open, agenda, ask, say, offers, extra, objections, close, after, facts, dont };
}

/** The kit as plain text, to paste into notes or a doc. */
export function toolkitText(row, k) {
  const L = [];
  L.push(`Call prep: ${row[F.company]}`, '', `Goal: ${k.goal}`, '');
  k.where.forEach((w) => L.push(`${w.label}: ${w.text}`));
  L.push('', 'How to open', ...k.open.map((x) => '- ' + x), '', 'Agenda', ...k.agenda.map(([t, x]) => `- ${t}: ${x}`));
  L.push('', 'What to ask', ...k.ask.map((a) => `- ${a.must ? '(must) ' : ''}${a.q}`));
  L.push('', 'What to say', ...k.say.map((x) => `- ${x.beat}: ${x.text}`));
  L.push('', 'What we can offer', ...k.offers.map((o) => `- ${o.title}: ${o.how} Ask: ${o.ask}`));
  L.push('', 'If they say', ...k.objections.map((o) => `- ${o.they} -> ${o.you}`));
  L.push('', 'Close', ...k.close.map((x) => '- ' + x), '', 'After the call', ...k.after.map((x) => '- ' + x));
  L.push('', 'Facts you can say', ...k.facts.map((x) => '- ' + x), '', 'Do not', ...k.dont.map((x) => '- ' + x));
  return L.join('\n');
}
