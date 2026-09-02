# Claude Build Prompt — Vice City Community

You are a principal product designer and senior full-stack engineer. Build a production-quality, original gaming community platform prototype named **Vice City Community**. Do not copy Discord, Reddit, TikTok, Rockstar, GTA artwork, logos, copyrighted characters, maps, or UI. Create an original game-native social network inspired by the strengths of live chat, permanent forums, short-form media discovery, creator communities, and RPG progression.

## Product thesis
Users do not create a generic account; they create a **character**. The platform should feel like entering a living gaming city. Every meaningful action should strengthen at least one of these: identity, relationships, reputation, collections, knowledge, crew status, or creative reach.

## Core loop
Enter city → see meaningful live activity → join a district → chat/post/upload → receive reactions or replies → earn Street Rep and XP → progress character/crew → return because the city changed and relationships matter.

## Naming system
- Servers = Cities
- Channels = Districts
- Voice channels = Safehouses
- Profiles = Citizen Records
- Roles = Classes
- Threads = Cases
- Events/challenges = Jobs
- Reputation = Street Rep
- Saved content = Vault
- Groups/clans = Crews
- News and live trend intelligence = ViceWire
- Premium = Penthouse

## Required screens
1. City Home dashboard
2. Live District chat
3. Discover feed with clips, news, fails, guides and map discoveries
4. Citizen Record profile
5. Character creation/onboarding
6. Crew hub
7. ViceWire news/trends page
8. Jobs/events page
9. Searchable permanent Case/thread page
10. Moderation/admin surface

## City Home requirements
- Live population
- Friends online
- New replies and crew invites
- Active Districts
- Trending clips
- Breaking news
- Daily Job
- Current Street Rep, XP and level
- Recommended conversations
- Clear “Enter the City” CTA

## Character system
Character creation must include:
- Character name
- Class: Racer, Explorer, Creator, Grinder, Collector, Crew Leader, Photographer, Chaos Agent
- Home District
- Interests
- Profile card appearance

Citizen Record includes:
- Character name and handle
- Class
- Level and XP
- Street Rep
- Crew
- Home District
- Achievements
- Clip views
- Helpful answers
- Followers/friends
- Garage, collections and properties
- Current status and online state

Progress must reward quality, not spam. Design anti-abuse rules such as diminishing returns, trust weighting, originality checks, moderation penalties and contribution quality scoring.

## Live District requirements
- Real-time text chat
- Replies and Cases/threads
- Reactions
- Polls
- Pinned messages
- Mentions
- Typing indicators
- Online state
- Media uploads
- Voice Safehouse entry
- Promote valuable messages into permanent searchable Case pages
- Allow clips posted in chat to enter Discover automatically
- Allow location posts to attach to a future interactive map

## Discover requirements
- For You
- Following
- Clips
- Fails
- News
- Guides
- Map discoveries
- Live creators
- Personalized recommendations with explicit user controls
- Infinite feed, but include natural stopping points and session controls; avoid manipulative dark patterns

## Revenue model
Keep core communication free. Monetize:
- Penthouse membership
- Animated profile banners
- Profile themes
- Apartment/garage cosmetics
- Crew upgrades
- Premium emoji/reactions
- Larger HD uploads
- Creator subscriptions and tips
- Sponsored Jobs and competitions
- Tasteful public-feed ads
- Marketplace transaction fees later

Never make moderation, basic posting, core chat, or basic voice paywalled. Avoid pay-to-win mechanics.

## Visual direction
- Dark ink-violet base, not pure black
- Neon pink, cyan, purple and sunset amber accents
- Clean, premium, modern, game-native
- Strong typography, cinematic but highly usable
- Desktop: city rail + district rail + main content + contextual right rail
- Mobile: bottom navigation with City, Discover, Create, Crews, Profile
- Avoid generic Discord clone visuals
- Use original icons/shapes and placeholder art only
- Accessibility: AA contrast, keyboard navigation, reduced motion support, semantic HTML

## Technology
Use:
- Next.js 15+ with TypeScript
- Tailwind CSS
- Supabase Auth, Postgres, Realtime and Storage
- Zod validation
- TanStack Query
- Server actions or route handlers
- Modular monolith architecture
- Clean domain modules: auth, characters, cities, districts, messages, cases, media, crews, jobs, reputation, notifications, moderation

Provide:
- Database schema and migrations
- Row-level security strategy
- Seed data
- Component architecture
- Responsive pages
- Realtime chat prototype
- Mock voice-room state, not live WebRTC yet
- Moderation model
- Notification model
- Recommendation placeholders
- README with local setup and deployment instructions
- `.env.example`

## Data model minimum
users, characters, cities, districts, memberships, messages, message_reactions, cases, case_posts, media, follows, friendships, crews, crew_members, jobs, job_entries, reputation_events, achievements, character_achievements, notifications, reports, moderation_actions, saved_items.

## Critical product rules
1. The website and community are the same world.
2. Searchable public knowledge must not disappear inside chat.
3. Every important object has a public shareable URL where appropriate.
4. Progress rewards useful participation and originality.
5. The experience must be valuable without compulsive dark patterns.
6. Build the GTA-focused first world, but make the system reusable for future game worlds.
7. Do not use copyrighted GTA logos, characters, screenshots, maps, or Rockstar trade dress.

## Output order
1. Product architecture summary
2. File tree
3. Database schema
4. Full implementation files
5. Setup instructions
6. Known limitations
7. Recommended next three sprints

Build a polished functional MVP, not merely a wireframe.
