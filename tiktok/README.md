# War Room weekly TikTok

A 22–25 second vertical (1080×1920) recap for TikTok, Reels and Shorts, built with Remotion
from the week's recap data that `render.mjs` publishes to the `media` branch
(`recaps/<platform>-<leagueId>/week-<n>/recap.json` + `img/`).

- Preview: `npm run dev` (Remotion Studio)
- Render a published week straight from its URL:
  `npx remotion render WeeklyTikTok out/week.mp4 --props='{"source":"https://raw.githubusercontent.com/Scheer1776/war-room-recaps/media/recaps/espn-478389994/week-7","nameOverrides":{},"appUrl":"war-room-self-one.vercel.app","recap":null}'`
- `nameOverrides` swaps team names that shouldn't go on a public brand account.
- Layout keeps clear of TikTok's own UI (`SAFE` in src/theme.tsx).

Remotion is free for individuals and companies of up to 3 people (remotion.pro/license).
