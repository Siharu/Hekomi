<div align="center">

<img src="https://raw.githubusercontent.com/Siharu/Hekomi/main/assets/hekomi-dual-mark.svg" alt="Hekomi" width="112" />

# Hekomi

### A little corner for anime, manga, and the hours that disappear into them.

**Find something good. Keep your place. Come back whenever.**

[Open Hekomi](https://hekomi.vercel.app) · [Report a bug](https://github.com/Siharu/Hekomi/issues) · [See what's being built](https://github.com/Siharu/Hekomi)

![Node](https://img.shields.io/badge/Node.js-20%2B-7cba82?style=flat-square&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-see%20LICENSE-9b8acb?style=flat-square)
![Status](https://img.shields.io/badge/status-a%20work%20in%20progress-d9a6d2?style=flat-square)

</div>

---

Hekomi started with a simple idea: keeping up with the things you watch and read shouldn't feel like managing a spreadsheet.

It's an anime and manga space with a MAL-connected anime list, a manga library, discovery tools, a chapter reading room, and a few little details that make it feel like *Hekomi*.

It's still growing. Some corners are more polished than others, and that's part of the journey. This is a personal project, built in the open, one improvement at a time.

## ✦ Take a look around

| | What's inside |
|:--|:--|
| **Anime** | Find anime, explore the catalog, and keep your watching list close. |
| **MAL Client** | Connect your own MyAnimeList account. Update status, score, and watched episodes without juggling tabs. |
| **Manga** | Search MangaDex and supported manga sources, save series to your library, and keep track of what you're reading. |
| **Reading room** | Open supported chapters in Hekomi when the source provides readable pages. If it doesn't, Hekomi points you back to the source instead of pretending it worked. |
| **Discover** | Browse covers, genres, summaries, scores, trending picks, and title pages. |
| **Anime calendar** | Keep an eye on the broadcast schedule and what's airing. |
| **Hekomi-chan** | A tiny pixel companion who hangs around the site. She's still learning a few tricks. |
| **Themes** | Midnight, Late Night, Dawn, and a device-aware option. Pick the mood. |

The library is meant to stay comfortable on a phone, too: poster-first lists, compact actions, and less interface getting in the way of the actual covers.

## ✦ The vibe

Hekomi has its own little visual language: deep night colours, soft mint and violet accents, a little editorial typography, and a pixel companion who occasionally has things to say.

The goal isn't to cram every feature onto one screen. It's to make the next thing you want to do easy to find, then give it room to breathe.

## ✦ Try it

**The easiest way:** [hekomi.vercel.app](https://hekomi.vercel.app)

Want to run your own copy? You'll need [Node.js 20 or newer](https://nodejs.org/).

```bash
git clone https://github.com/Siharu/Hekomi.git
cd Hekomi
npm install
npm start
```

Then visit **http://localhost:4173**.

### Connecting MyAnimeList

MAL sign-in uses OAuth. Create an app in [MyAnimeList API Configuration](https://myanimelist.net/apiconfig), then add these environment variables to your server:

- `MAL_CLIENT_ID`
- `MAL_CLIENT_SECRET`
- `FOLIO_SESSION_SECRET`

For local development, set the app's redirect URL to:

```text
http://localhost:4173/api/mal/auth/callback
```

For a deployed copy, use your own domain with `/api/mal/auth/callback` and enter that exact URL in your MAL app settings.

**A small but important secret-keeping rule:** the MAL client secret and session secret belong on the server. Don't put them in browser code, commit them, or share them in screenshots. Each person signs in with their own MAL account; nobody should need to hand over their password or paste an access token into Hekomi.

## ✦ A note about manga sources

Manga sources are a mixed bag. Some work beautifully; some change their pages, go offline, or simply don't provide the chapter images Hekomi needs.

Hekomi currently has:

- **MangaDex** for title discovery, search, chapter metadata, and supported chapter pages.
- **Optional source adapters** powered by the MIT-licensed `mangascrape@1.5.0` package, currently exposing Bato (`fto.to`), MangaBuddy, and Mangakakalot for structured search and series/chapter details.
- **A general page inspector** for looking at accessible public pages and their metadata.

A source link is still a source link. When a chapter can't be read inside Hekomi, the app should say so and let you open the original page.

Please use sources you're allowed to access and respect the people who make and translate the work. Hekomi does not bypass paywalls, DRM, sign-in requirements, or anti-bot challenges. Provider availability and page formats can change without warning.

MangaDex-powered features should follow [MangaDex's current API rules](https://api.mangadex.org/docs/) and acceptable-use policies. Credit MangaDex and translation groups where applicable.

## ✦ Your data, your device

- Your local anime and manga lists are stored in your browser on that device.
- MAL account access is handled through server-side OAuth and an encrypted, HttpOnly session cookie.
- Searching the web or opening a provider page makes requests to those services. Hekomi can't make those requests invisible to the provider or your network.
- Don't feed private URLs, passwords, or account-only pages into the page inspector.

Local storage is not a cloud backup. If you clear your browser data or switch devices, locally saved entries may not follow you.

## ✦ Under the hood

A few notes for the curious:

- **Node.js** server with native ES modules.
- **AniList** provides public catalog data and metadata.
- **MyAnimeList OAuth** connects a user's own MAL account.
- **MangaDex API** powers its supported manga discovery and reading features.
- **mangascrape** provides optional source adapters.
- **React 19** is included as part of the ongoing front-end work; the existing app structure is still being evolved rather than replaced wholesale.
- **Playwright** and Node's test runner are used for browser and unit tests.

Useful commands:

```bash
npm start          # Run Hekomi locally
npm run test:unit  # Run unit tests
npm run test:e2e   # Run browser tests
```

## ✦ A little housekeeping

Hekomi's catalog pages use AniList metadata and artwork supplied by their respective rights holders. The server also generates its sitemap and robots file. Set `HEKOMI_PUBLIC_URL` if you're hosting your own copy at a different canonical domain.

The generic page inspector checks `robots.txt` where applicable. Dedicated source adapters and chapter-reading routes have their own URL validation, redirect limits, throttling, response-size limits, and caching. These safeguards are not a licence to reuse a site's content; always check the source's terms.

## ✦ Help make the corner nicer

Found something broken? Have an idea that would make the app feel better? [Open an issue](https://github.com/Siharu/Hekomi/issues).

If you're contributing code, please keep changes focused and avoid breaking the existing app structure or unrelated features. Run the relevant tests before opening a pull request, and explain what you changed and how you checked it.

And if you're just looking around: welcome. Grab a series, find a chapter, and make yourself at home.

<div align="center">

**Less scrolling. More feeling.**

*— Hekomi*

</div>
