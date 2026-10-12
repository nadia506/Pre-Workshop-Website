/* Day Reconstruction — study configuration.
   Everything you are likely to change lives in this file. app.js reads these as globals. */
/* Where submissions go. Paste the Google Apps Script web app URL (ends in /exec) from apps-script/Code.gs.
   Leave empty to fall back to downloading a .json file on submit. */
const SHEET_ENDPOINT='https://script.google.com/macros/s/AKfycbybIWtNTYQRnmZF2s2tzu3K2_PGyQYsX9LhhFm5A2L0utAE7cJNIaE8iUbiOln5p45e/exec';
/* Optional shared secret. Set the same value in TOKEN inside apps-script/Code.gs. */
const SHEET_TOKEN='';
/* Questions: edit these to change what participants are asked. */
/* Tags: every block gets exactly one. Participants can rename, add and delete them on the page. */
const DEFAULT_TAGS=['Deep work','Meeting','Exercise','Social'];
/* Colour hue (0–360) for each tag, in the same order; extra hues are used for tags participants add. */
const HUES=[225,280,150,30,330,190,60,0,100,260,20,120];

/* Background survey: answered once per participant, before their first day. Keep it to about five minutes.
   type: 'text' (default) or 'scale' (with min, max, lo, hi). */
const BACKGROUND=[
  {key:'tasks',label:'What kinds of tasks usually require sustained attention from you?'},
  {key:'environment',label:'Where do you usually do this kind of work? Are you usually alone or around other people?'},
  {key:'devices',label:'Which devices and apps do you use for this work, and what is each one for?'},
  {key:'strategies',label:'What do you currently do to stay with a task, or to return to it after your attention shifts?'},
  {key:'distractions',label:'What most often pulls you away from a task?'},
  /* Also in the protocol, off by default:
  {key:'sessions',label:'How do you decide when to start and stop a focused work session?'},
  {key:'access',label:'Is there anything we can do to make the workshop easier or more comfortable for you to take part in?'},
  */
];

/* Day ratings: asked after the timeline, required to submit a day. */
const DAY_SCALES=[
  {key:'wellbeing',short:'Well-being',label:'How did you feel today, overall?',lo:'Very bad',hi:'Very good',min:0,max:10},
  {key:'productivity',short:'Productivity',label:'How productive was today?',lo:'Not at all',hi:'Extremely',min:0,max:10},
  {key:'focus',short:'Focus',label:'How focused were you today?',lo:'Not at all',hi:'Completely',min:0,max:10},
];
/* Reflection: optional questions shown in a "Looking back" panel after the ratings. Empty = panel hidden.
   e.g. {key:'drift',label:'When did your day drift from what you meant to be doing?'} */
const REFLECTION=[];
