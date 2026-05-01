# WikiSemanticImgSearch

**Semantic Image Search for Wikimedia Commons** — search millions of freely-licensed images using natural language, powered by AI vision embeddings and the Wikidata Vector Database.

## Why This Exists

Searching for images on Wikimedia Commons currently relies on titles, categories, and descriptions. This makes it difficult to find images when metadata is missing, incomplete, or doesn't match the exact words you search for.

Queries like *"people cooking street food in Indian night markets"* or *"foggy mountains at sunrise"* don't return good results with keyword matching. This project introduces **semantic search** — type a natural description and the system finds visually relevant images by understanding meaning, not just matching words.

## Features

### Search
- **Natural Language Search** — describe what you're looking for in plain English
- **AI Vision Embeddings** — uses Wikidata Vector DB with CLIP/OpenCLIP/SigLIP models for semantic understanding
- **Special Search** — find a specific Commons file by exact filename (`File:Filename.jpg`)
- **NLP Query Decomposition** — long, complex prompts are broken into focused sub-concepts and searched in parallel
- **Smart No-Results** — when no results are found, get clickable simplified prompt suggestions
- **Autocomplete** — real-time suggestions while typing (topics + categories)
- **Related Searches** — clickable related prompts after search results

### Filtering & Organization
- **Category Browsing** — target specific Wiki Loves campaigns (Monuments, Folklore, Birds)
- **Category Search** — search and browse any Commons category by name
- **Resolution Filtering** — filter by exact dimensions or minimum width/height with pixel tolerance
- **Custom Categories** — search within any Commons category

### Authentication & History
- **OTP Login** — secure email-based OTP authentication via NodeMailer
- **JWT Sessions** — 24-hour token-based sessions
- **Search History** — all searches saved per user, viewable in a slide-out panel
- **History Management** — click to re-search, × to delete individual entries
- **User Stats** — "Happy users" counter in header

### Export
- **Excel Export** — select images and export metadata to `.xlsx` files

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
git clone https://github.com/dubeysanskar/WikiSemanticImgSearch.git
cd WikiSemanticImgSearch
cp .env.example .env.local
# Edit .env.local with your credentials (see Environment Variables below)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MEDIAWIKI_USERNAME` | Yes | Your MediaWiki username (for User-Agent compliance) |
| `JWT_SECRET` | Yes | Secret key for JWT token signing |
| `SMTP_HOST` | Yes | SMTP server host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | Yes | SMTP port (e.g. `587`) |
| `SMTP_USER` | Yes | SMTP email address |
| `SMTP_PASS` | Yes | SMTP password or App Password |
| `SMTP_FROM` | No | From address for OTP emails |
| `TURSO_DATABASE_URL` | No | Turso database URL (for Vercel deployment) |
| `TURSO_AUTH_TOKEN` | No | Turso auth token |

> **Gmail users:** Use an [App Password](https://myaccount.google.com/apppasswords) instead of your regular password.

> **Database:** Locally uses SQLite file (`wikisearch.db`). For Vercel, set up a free [Turso](https://turso.tech) database.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    User Query                    │
│     "pictures of 19th century Indian temples"    │
└──────────────────┬───────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  NLP Decomposition  │
        │  → Sub-concepts     │
        └──────────┬──────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────▼─────┐ ┌────▼─────┐ ┌────▼──────┐
│ Keyword  │ │ Vector   │ │ Category  │
│ Search   │ │ DB × N   │ │ Fallback  │
│ (API)    │ │ (Parallel│ │ (API)     │
└────┬─────┘ └────┬─────┘ └────┬──────┘
     │             │             │
     └─────────────┼─────────────┘
                   │
     ┌─────────────▼─────────────┐
     │  Merge, Deduplicate, Rank │
     │  → Save to History (JWT)  │
     └─────────────┬─────────────┘
                   │
     ┌─────────────▼─────────────┐
     │        Results UI          │
     │  Tabs | Export | Details   │
     └───────────────────────────┘
```

### APIs Used

| API | Purpose | Documentation |
|-----|---------|---------------|
| Wikidata Vector DB | Semantic item search via embeddings + RRF | [Docs](https://wd-vectordb.wmcloud.org/docs) |
| MediaWiki Commons API | Keyword search, category members, image info | [Docs](https://www.mediawiki.org/wiki/API:Main_page) |
| Wikidata API | Entity labels and descriptions | [Docs](https://www.wikidata.org/w/api.php) |
| Commons SDC | Structured Data search via `haswbstatement` | [Docs](https://commons.wikimedia.org/wiki/Commons:Structured_data) |

## Tech Stack

- **Next.js** (App Router) — Full-stack React framework
- **Vanilla CSS** — Professional light theme, responsive
- **Wikidata Vector DB** — AI embeddings (CLIP/OpenCLIP/SigLIP) + Reciprocal Rank Fusion
- **MediaWiki API** — Image search, metadata, category traversal
- **@libsql/client** — SQLite database (local file + Turso cloud)
- **jsonwebtoken** — JWT authentication
- **nodemailer** — OTP email delivery

## Project Structure

```
WikiSemanticImgSearch/
├── app/
│   ├── layout.js              # Root layout + SEO metadata
│   ├── page.js                # Main search page (client component)
│   ├── globals.css            # Design system
│   ├── components/
│   │   ├── AuthModal.js       # Login modal (OTP flow)
│   │   └── HistoryPanel.js    # Search history slide-out
│   └── api/
│       ├── search/route.js    # Unified search API
│       ├── search/file/route.js # Special file search
│       ├── suggest/route.js   # Autocomplete suggestions
│       ├── categories/route.js # Category search
│       ├── history/route.js   # Search history (GET/DELETE)
│       ├── stats/route.js     # User count
│       └── auth/
│           ├── register/route.js # Send OTP
│           ├── verify/route.js   # Verify OTP → JWT
│           └── me/route.js       # Current user
├── lib/
│   ├── config.js              # Categories, resolutions, API endpoints
│   ├── commonsApi.js          # MediaWiki Commons API client
│   ├── vectorDb.js            # Wikidata Vector DB client
│   ├── queryProcessor.js      # NLP query decomposition engine
│   ├── db.js                  # SQLite database layer
│   └── auth.js                # JWT + OTP + Email utilities
├── docs/
│   └── DEVELOPER.md           # Detailed developer documentation
├── .env.example               # Environment template
└── README.md                  # This file
```

## Acknowledgements

- [Wikidata Embedding Project](https://www.wikidata.org/wiki/Wikidata:Embedding_Project)
- [WISE Search Engine (VGG Oxford)](https://gitlab.com/vgg/wise/wise/)
- [jio-commons-screensaver-harvester](https://github.com/Aditya0545/jio-commons-screensaver-harvester) — MediaWiki API patterns
- Wikimedia Hackathon 2026 community

## License

MIT
