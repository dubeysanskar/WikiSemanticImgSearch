# Developer Documentation

## How the Semantic Search Pipeline Works

### 1. Wikidata Vector Database

The [Wikidata Vector DB](https://wd-vectordb.wmcloud.org/docs) is a service that represents Wikidata items as dense vector embeddings. It uses AI models from the embedding family (CLIP, OpenCLIP, SigLIP 2) to encode item labels, descriptions, and aliases into high-dimensional vectors.

**Endpoint**: `GET /item/query/`

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Natural language search text |
| `lang` | string | Language code (default: `"all"`) |
| `K` | int | Number of results (default: 50) |
| `instanceof` | string | Filter by instance-of Q-IDs |
| `rerank` | bool | Apply reranker model (slower, more accurate) |

**How it works internally:**
1. The query text is encoded into a vector using the same embedding model
2. Vector similarity search (dot product) finds the nearest Wikidata items
3. Keyword search runs in parallel on item text
4. Results are fused using **Reciprocal Rank Fusion (RRF)** to combine both signals

**Response format:**
```json
[
  {
    "QID": "Q42",
    "similarity_score": 0.95,
    "rrf_score": 0.043,
    "source": "Vector Search"
  }
]
```

### 2. Structured Data on Commons (SDC)

Wikimedia Commons images can have structured data statements, including **P180 (depicts)** which links an image to what it visually shows as a Wikidata item.

We use the MediaWiki search API with the `haswbstatement` filter:

```
gsrsearch=haswbstatement:P180=Q12345
```

This finds all Commons images that are tagged as depicting the Wikidata item Q12345.

### 3. Category-Based Search

As a fallback/supplement, we also search through Commons categories. This is ported from the [jio-commons-screensaver-harvester](https://github.com/Aditya0545/jio-commons-screensaver-harvester) Python tool:

1. Search for relevant categories matching the query
2. List files within those categories using `generator=categorymembers`
3. Fetch image metadata (url, size, author, license, description)

### 4. Resolution Filtering

Ported from the harvester's pixel-tolerance mode:

- Users can specify target width/height
- Images within ±20 pixels (configurable) are accepted
- Preset resolutions (HD, FHD, QHD, 4K, 6K) available

## API Route: `POST /api/search`

### Request Body

```json
{
  "query": "foggy mountains at sunrise",
  "mode": "combined",
  "category": "Images_from_Wiki_Loves_Folklore",
  "minWidth": 1920,
  "minHeight": 1080,
  "pixelTolerance": 20,
  "maxResults": 40
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | string | `""` | Natural language search text |
| `mode` | string | `"combined"` | `"keyword"`, `"semantic"`, or `"combined"` |
| `category` | string | `""` | Commons category name |
| `minWidth` | number | null | Minimum image width |
| `minHeight` | number | null | Minimum image height |
| `pixelTolerance` | number | 20 | Tolerance for resolution matching |
| `maxResults` | number | 40 | Maximum results per type |

### Response

```json
{
  "keyword": [...],
  "semantic": [...],
  "category": [...],
  "combined": [...],
  "meta": {
    "query": "...",
    "elapsed": "2.34",
    "counts": { "keyword": 15, "semantic": 8, "category": 0, "combined": 20 }
  }
}
```

Each result object:

```json
{
  "pageId": 12345,
  "title": "Western Ghats sunset.jpg",
  "thumbUrl": "https://upload.wikimedia.org/.../400px-...",
  "fullUrl": "https://upload.wikimedia.org/.../...",
  "pageUrl": "https://commons.wikimedia.org/wiki/File:...",
  "width": 5184,
  "height": 3456,
  "author": "Photographer Name",
  "license": "CC BY-SA 4.0",
  "description": "Sunset view from Western Ghats...",
  "source": "semantic",
  "wikidataLabel": "Western Ghats",
  "matchedQid": "Q134556"
}
```

## Preset Categories

Categories are sourced from the [jio-commons-screensaver-harvester config](https://github.com/Aditya0545/jio-commons-screensaver-harvester/blob/main/config.py):

- **Wiki Loves Monuments 2025** — India, Germany, France, Italy, Spain
- **Wiki Loves Folklore** — 2019–2025, winning images
- **Wiki Loves Birds** — India, 2021–2024, winning images

Users can also enter any custom Commons category name.

## MediaWiki API Usage

All API requests include:

- `User-Agent` header with project name and MediaWiki username (from `.env.local`)
- `origin=*` parameter for CORS compliance
- `format=json` for JSON responses

We follow MediaWiki's [API:Etiquette](https://www.mediawiki.org/wiki/API:Etiquette):
- Identify ourselves via User-Agent
- Use `formatversion=2` where possible
- Avoid excessive request rates

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Copy `.env.example` to `.env.local` and set your MediaWiki username
4. Run `npm install && npm run dev`
5. Make your changes and test
6. Submit a pull request

### Areas for Contribution

- **Multilingual support** — use SigLIP 2 models for cross-language queries
- **Image embeddings** — compute CLIP embeddings for Commons images directly
- **Hybrid ranking** — improve the fusion of keyword and semantic scores
- **UI improvements** — accessibility, keyboard navigation, advanced filters
- **Performance** — caching, pagination, lazy loading
