# WikiSemanticImgSearch

**Semantic Image Search for Wikimedia Commons** — search millions of freely-licensed images using natural language, powered by AI vision embeddings and the Wikidata Vector Database.

🔗 **Live:** [wiki-semantic-img-search.vercel.app](https://wiki-semantic-img-search.vercel.app)

## Why This Exists

Searching for images on Wikimedia Commons currently relies on titles, categories, and descriptions. This makes it difficult to find images when metadata is missing, incomplete, or doesn't match your search terms.

Queries like *"people cooking street food in Indian night markets"* or *"foggy mountains at sunrise"* return poor results with keyword matching. This project introduces **semantic search** — type a natural description and the system finds visually relevant images by understanding meaning, not just matching words.

Inspired by the [WISE Search Engine (VGG Oxford)](https://gitlab.com/vgg/wise/wise/) which uses CLIP embeddings for local image collections, WikiSemanticImgSearch brings the same concept to Wikimedia Commons at scale — leveraging the [Wikidata Vector Database](https://wd-vectordb.wmcloud.org/docs) for pre-computed CLIP/SigLIP embeddings across millions of Commons files.

## Features

### Search
- **Natural Language Search** — describe what you're looking for in plain English
- **AI Vision Embeddings** — Wikidata Vector DB with CLIP/OpenCLIP/SigLIP models
- **Multi-Strategy Retrieval** — parallel semantic + keyword + category search paths
- **Universal Query Decomposition** — complex prompts broken into n-gram sub-queries (no hardcoded patterns — works for any topic, any language)
- **Special Search** — find specific Commons files by exact filename (`File:Example.jpg`)
- **Autocomplete** — real-time suggestions while typing (topics + categories)
- **Smart No-Results** — clickable simplified prompt suggestions when results are empty
- **Related Searches** — generated from your query + Wikidata metadata

### Filtering & Organization
- **Category Browsing** — Wiki Loves campaigns (Monuments, Folklore, Birds)
- **Category Search** — browse any Commons category by name
- **Resolution Filtering** — filter by exact dimensions or min width/height
- **Custom Categories** — search within any Commons category

### Authentication
- **Wikimedia OAuth 2.0** — login via official Wikimedia authentication
- **Verified Identity** — username comes directly from Wikimedia (cannot be faked)
- **Search History** — all searches saved per user, viewable in slide-out panel
- **History Management** — re-search or delete individual entries

### Export
- **Excel Export** — select images and export metadata to `.xlsx` files

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- A [Wikimedia OAuth consumer](https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose/oauth2) (for authentication)

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
| `WIKIMEDIA_CLIENT_ID` | Yes | OAuth 2.0 client ID from meta.wikimedia.org |
| `WIKIMEDIA_CLIENT_SECRET` | Yes | OAuth 2.0 client secret |
| `NEXTAUTH_SECRET` | Yes | Random secret for NextAuth session encryption |
| `NEXTAUTH_URL` | Yes | Your deployment URL (e.g. `https://your-app.vercel.app`) |
| `TURSO_DATABASE_URL` | No | Turso database URL (for cloud deployment) |
| `TURSO_AUTH_TOKEN` | No | Turso auth token |

> **OAuth Setup:** Register at [meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration](https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose/oauth2). Select "User identity verification only with access to real name and email address". Set callback URL to `https://your-domain/api/auth/callback/wikimedia`.

> **Database:** Locally uses SQLite file (`wikisearch.db`). For Vercel, set up a free [Turso](https://turso.tech) database.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    User Query                    │
│     "pictures of 19th century Indian temples"    │
└──────────────────┬───────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  Query Decomposition │
        │  N-gram sub-queries  │
        │  (universal, no      │
        │   hardcoded patterns)│
        └──────────┬──────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────▼─────┐ ┌────▼─────┐ ┌────▼──────┐
│ Keyword  │ │ Vector   │ │ Category  │
│ Search   │ │ DB × N   │ │ Fallback  │
│ (Commons │ │ (CLIP /  │ │ (Commons  │
│  API)    │ │  SigLIP) │ │  API)     │
└────┬─────┘ └────┬─────┘ └────┬──────┘
     │             │             │
     └─────────────┼─────────────┘
                   │
     ┌─────────────▼─────────────┐
     │  Merge, Deduplicate, Rank │
     │  → Reciprocal Rank Fusion │
     └─────────────┬─────────────┘
                   │
     ┌─────────────▼─────────────┐
     │        Results UI          │
     │  Tabs | Export | Details   │
     └───────────────────────────┘
```

### How Query Decomposition Works

Unlike pattern-based approaches that hardcode geographic, temporal, or environmental regex lists (which break for any topic not in the list), WikiSemanticImgSearch uses **universal n-gram decomposition**:

```
Input: "wildlife photography animals in prayagraj city of sangam"
Keywords: [wildlife, photography, animals, prayagraj, city, sangam]

Sub-queries generated:
  1. "wildlife photography animals prayagraj"  (first 4 keywords)
  2. "wildlife photography animals"             (3-gram)
  3. "photography animals prayagraj"            (3-gram)
  4. "animals prayagraj city"                   (3-gram)
  5. "wildlife photography"                     (2-gram)
  6. "animals prayagraj"                        (2-gram)
  7. "wildlife sangam"                          (bridge: first↔last)
  8. "photography city"                         (bridge)
```

Each sub-query fires in parallel against both the Vector DB (semantic) and Commons API (keyword). Results merge and deduplicate.

### APIs Used

| API | Purpose | Docs |
|-----|---------|------|
| Wikidata Vector DB | Semantic search via CLIP/SigLIP embeddings + RRF | [Docs](https://wd-vectordb.wmcloud.org/docs) |
| MediaWiki Commons API | Keyword search, category members, image metadata | [Docs](https://www.mediawiki.org/wiki/API:Main_page) |
| Wikidata API | Entity labels and descriptions | [Docs](https://www.wikidata.org/w/api.php) |
| Commons SDC | Structured Data search via `haswbstatement` | [Docs](https://commons.wikimedia.org/wiki/Commons:Structured_data) |
| Wikimedia OAuth 2.0 | User identity verification | [Docs](https://www.mediawiki.org/wiki/Extension:OAuth) |

## Tech Stack

- **Next.js 15** (App Router) — Full-stack React framework
- **NextAuth.js** — Wikimedia OAuth 2.0 authentication
- **Vanilla CSS** — Professional light theme, responsive design
- **Wikidata Vector DB** — AI embeddings (CLIP/OpenCLIP/SigLIP) + Reciprocal Rank Fusion
- **MediaWiki API** — Image search, metadata, category traversal
- **@libsql/client** — SQLite database (local file + Turso cloud)

## Project Structure

```
WikiSemanticImgSearch/
├── app/
│   ├── layout.js              # Root layout + SessionProvider
│   ├── page.js                # Main search page (client component)
│   ├── globals.css            # Design system
│   ├── components/
│   │   ├── AuthModal.js       # "Login with Wikimedia" OAuth modal
│   │   ├── HistoryPanel.js    # Search history slide-out
│   │   └── Providers.js       # NextAuth SessionProvider wrapper
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth OAuth handler
│       ├── search/route.js    # Unified search API
│       ├── search/file/       # Special file search
│       ├── suggest/           # Autocomplete suggestions
│       ├── categories/        # Category search
│       ├── history/           # Search history (GET/DELETE)
│       └── stats/             # User count
├── lib/
│   ├── auth-config.js         # NextAuth + Wikimedia OAuth config
│   ├── config.js              # Categories, resolutions, API endpoints
│   ├── commonsApi.js          # MediaWiki Commons API client
│   ├── vectorDb.js            # Wikidata Vector DB client
│   ├── queryProcessor.js      # Universal n-gram query decomposition
│   └── db.js                  # SQLite database layer
├── docs/
│   └── DEVELOPER.md           # Detailed developer documentation
├── .env.example               # Environment template
└── README.md                  # This file
```

## Comparison with WISE

| Feature | WISE (VGG Oxford) | WikiSemanticImgSearch |
|---------|-------------------|---------------------|
| **Scope** | Local image collections | Wikimedia Commons (100M+ images) |
| **Embeddings** | Self-hosted CLIP/OpenCLIP | Wikidata Vector DB (hosted by Wikimedia) |
| **Query Processing** | Direct CLIP text encoding | N-gram decomposition + multi-strategy search |
| **Authentication** | N/A (local tool) | Wikimedia OAuth 2.0 |
| **Deployment** | Docker / local | Vercel (serverless) |
| **Search Modes** | Text, image upload, combined | Text, category, special file |
| **License** | Apache 2.0 | MIT |

## Acknowledgements

- [Wikidata Embedding Project](https://www.wikidata.org/wiki/Wikidata:Embedding_Project) — Pre-computed CLIP embeddings for Wikidata items
- [WISE Search Engine (VGG Oxford)](https://gitlab.com/vgg/wise/wise/) — Inspiration for multimodal search architecture
- [jio-commons-screensaver-harvester](https://github.com/Aditya0545/jio-commons-screensaver-harvester) — MediaWiki API patterns
- Wikimedia Hackathon 2026 community

## License

MIT
