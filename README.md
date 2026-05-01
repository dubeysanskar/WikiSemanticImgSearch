# WikiSemanticImgSearch

**Semantic Image Search for Wikimedia Commons** — search millions of freely-licensed images using natural language, powered by AI vision embeddings and the Wikidata Vector Database.

## Why This Exists

Searching for images on Wikimedia Commons currently relies on titles, categories, and descriptions. This makes it difficult to find images when metadata is missing, incomplete, or doesn't match the exact words you search for.

Queries like *"people cooking street food in Indian night markets"* or *"foggy mountains at sunrise"* don't return good results with keyword matching. This project introduces **semantic search** — type a natural description and the system finds visually relevant images by understanding meaning, not just matching words.

## Features

- **Natural Language Search** — describe what you're looking for in plain English
- **AI Vision Embeddings** — uses Wikidata Vector DB with CLIP/OpenCLIP/SigLIP models for semantic understanding
- **Structured Data Matching** — maps semantic concepts to Commons images via P180 (depicts) statements
- **Category Browsing** — target specific Wiki Loves campaigns (Monuments, Folklore, Birds)
- **Resolution Filtering** — filter by exact dimensions or minimum width/height with pixel tolerance
- **Custom Categories** — search within any Commons category

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
git clone https://github.com/dubeysanskar/WikiSemanticImgSearch.git
cd WikiSemanticImgSearch
cp .env.example .env.local
# Edit .env.local with your MediaWiki username
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MEDIAWIKI_USERNAME` | Yes | Your MediaWiki username (for User-Agent compliance) |
| `API_TIMEOUT` | No | API request timeout in ms (default: 30000) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    User Query                     │
│          "foggy mountains at sunrise"             │
└──────────────────┬──────────────────┬────────────┘
                   │                  │
     ┌─────────────▼──────┐  ┌───────▼────────────┐
     │  Wikidata Vector DB │  │  Commons Keyword   │
     │  (AI Embeddings)    │  │  Search API        │
     │  → Q-Items + Scores │  │  → Direct Matches  │
     └─────────┬───────────┘  └───────┬────────────┘
               │                      │
     ┌─────────▼───────────┐          │
     │  Commons SDC Search │          │
     │  haswbstatement:    │          │
     │  P180=Q12345        │          │
     └─────────┬───────────┘          │
               │                      │
     ┌─────────▼──────────────────────▼────────────┐
     │         Merge, Deduplicate, Rank             │
     │         (Semantic → Keyword → Category)      │
     └──────────────────┬──────────────────────────┘
                        │
     ┌──────────────────▼──────────────────────────┐
     │              Results UI                       │
     │    Tabs: Combined | Semantic | Keyword        │
     └─────────────────────────────────────────────┘
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

## Project Structure

```
WikiSemanticImgSearch/
├── app/
│   ├── layout.js           # Root layout + SEO metadata
│   ├── page.js             # Main search page (client component)
│   ├── globals.css          # Light theme design system
│   └── api/
│       └── search/route.js  # Unified search API (keyword + semantic + category)
├── lib/
│   ├── config.js            # Categories, resolutions, API endpoints
│   ├── commonsApi.js        # MediaWiki Commons API client (JS port)
│   └── vectorDb.js          # Wikidata Vector DB client
├── docs/
│   └── DEVELOPER.md         # Detailed developer documentation
├── .env.example             # Environment template
└── README.md                # This file
```

## Acknowledgements

- [Wikidata Embedding Project](https://www.wikidata.org/wiki/Wikidata:Embedding_Project)
- [WISE Search Engine (VGG Oxford)](https://gitlab.com/vgg/wise/wise/)
- [jio-commons-screensaver-harvester](https://github.com/Aditya0545/jio-commons-screensaver-harvester) — MediaWiki API patterns
- Wikimedia Hackathon 2026 community

## License

MIT
