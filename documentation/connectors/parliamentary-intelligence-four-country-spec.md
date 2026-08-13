# Octivate Parliamentary Intelligence

## Four-Country Source Inventory and Connector Specifications

**Version:** 1.0  
**Date:** 11 August 2026  
**Markets:** Trinidad and Tobago, Jamaica, Guyana, Barbados  
**Primary audience:** Octivate engineering team / Cursor coding agent  
**Status:** Build-ready specification, subject to selector confirmation during connector discovery

---

## 1. How to use this document in Cursor

Place this file in the Octivate repository, preferably at:

```text
docs/connectors/parliamentary-intelligence-four-country-spec.md
```

Then give Cursor this instruction:

```text
Read docs/connectors/parliamentary-intelligence-four-country-spec.md in full.
Inspect the existing Octivate repository and identify the current source, capture,
evidence, job-runner and database abstractions. Produce an implementation plan that
maps this specification to the existing codebase. Do not create four unrelated
scrapers or new microservices. Implement the shared parliamentary connector contract,
normalized schema and Trinidad and Tobago adapter first, behind a feature flag.
Use fixtures before live integration tests. Preserve original official URLs, files,
content hashes, page numbers and transcript status. Ask before changing the database
schema if an equivalent model already exists. After presenting the mapped plan,
implement Phase 1 only and run the relevant tests.
```

This document is deliberately more prescriptive than the product PRD. It tells engineering:

- which official collections to connect;
- what role each collection plays;
- how each national site differs;
- what every adapter must return;
- how documents, sittings and contributions should be normalized;
- what must be tested before a connector is considered usable.

It does **not** authorize a full historical crawl. Begin with controlled samples and recent records.

---

## 2. Build objective

Create one citation-preserving parliamentary data source for four countries without erasing the differences in their official records.

The implementation path is:

```text
official country collections
  -> country adapters
  -> captured source files/pages
  -> normalized sittings and documents
  -> agenda items and contributions
  -> parliamentary signals
  -> Octivate evidence retrieval and briefs
```

The system must distinguish an official final Hansard from provisional debate text, minutes, official captions and an Octivate-generated transcript. A parliamentary statement is evidence that a statement was made; it is not, by itself, proof that the promised policy or action occurred.

---

## 3. Scope and priorities

### MVP scope

1. Discover recent sittings.
2. Associate each sitting with available Hansard/debate, order paper, minutes and official video.
3. Capture original documents and stable metadata.
4. Extract text while retaining page or timestamp citations.
5. Segment text into agenda items and speaker contributions where source quality permits.
6. Normalize records into one shared model.
7. Expose records to the existing evidence pipeline.
8. Generate only provenance-linked parliamentary signals.

### Priority levels

| Priority | Meaning |
|---|---|
| P0 | Required for the country MVP |
| P1 | Add immediately after the basic sitting/Hansard path works |
| P2 | Useful enrichment; not required to prove the first vertical slice |
| P3 | Historical or specialist source; defer until core quality is established |

### Explicit non-goals for the first implementation

- Full historical ingestion across all four countries
- Treating video-derived transcripts as official Hansard
- Automated legal verification of parliamentary claims
- Replacing gazette, legislation or regulator connectors
- Generating alerts before retrieval and citation quality pass evaluation
- Building separate deployed microservices for each country

---

## 4. Source inventory: Trinidad and Tobago

### 4.1 Official source map

| ID | Collection | Exact official URL | Content and role | Access pattern | Priority |
|---|---|---|---|---|---|
| TT-01 | House sittings | https://www.ttparliament.org/house/sittings-in-the-house/ | Canonical House sitting discovery. Recent sitting cards link order papers, supplemental papers, Hansard and YouTube. | Paginated HTML listing -> sitting detail pages | P0 |
| TT-02 | Senate sittings | https://www.ttparliament.org/senate/sittings-in-the-senate/ | Canonical Senate sitting discovery with the same associated-document pattern. | Paginated HTML listing -> sitting detail pages | P0 |
| TT-03 | Hansard archive | https://www.ttparliament.org/publications/hansard-for-sittings-of-the-parliament/ | Cross-chamber Hansard archive and historical discovery. | Paginated/filterable HTML listing -> publication detail -> PDF/file | P0 |
| TT-04 | Bills | https://www.ttparliament.org/publications/bills/ | Bill text and metadata; supports bill mention resolution and progression. | Paginated/filterable HTML listing -> publication detail -> file | P1 |
| TT-05 | Acts of Parliament | https://www.ttparliament.org/publications/acts-of-parliament/ | Enacted law confirmation; supports later verification of legislative progression. | Paginated/filterable HTML listing -> publication detail -> file | P1 |
| TT-06 | Committee reports | https://www.ttparliament.org/publications/committee-reports/ | Oversight findings, inquiries, recommendations and evidence. | Search/filter listing -> report detail/file | P1 |
| TT-07 | Papers Laid | https://papers.ttparliament.org/ | Reports and documents formally laid, including administrative, annual and Auditor General material. | Separate searchable document site | P1 |
| TT-08 | Publications hub | https://www.ttparliament.org/publications/ | Discovery fallback for active publication collections. | HTML hub | P2 |
| TT-09 | Parliament Channel | https://www.ttparliament.org/parliament-channel/ | Broadcast context and route to official recordings. | HTML page/video links | P2 |
| TT-10 | Main Parliament page | https://www.ttparliament.org/ | Current and upcoming House/Senate sitting discovery fallback. | HTML homepage | P2 |

### 4.2 Connector behavior

Use the **sitting pages** as the primary current-record spine. A sitting detail page may already contain:

- chamber;
- sitting number;
- Parliament and session;
- date and time;
- order paper and supplements;
- Hansard;
- official YouTube recording;
- agenda headings;
- speakers and short summaries.

The Hansard archive is the historical and completeness fallback, not the only discovery route.

#### Discovery rules

1. Crawl `TT-01` and `TT-02` independently.
2. Follow pagination until the configured date boundary or item limit is reached.
3. Create a sitting candidate from every sitting card/detail page.
4. Resolve document links from the sitting page before searching the Hansard archive.
5. Query `TT-03` to fill missing Hansard links and to locate historical records.
6. Do not infer chamber solely from filename prefixes; use page metadata and document text.
7. Capture supplemental order papers as separate documents related to the same sitting.

#### Expected filename clues

These are useful hints, not authoritative identifiers:

```text
hhYYYYMMDD  -> House Hansard
hsYYYYMMDD  -> Senate Hansard
ohYYYYMMDD  -> House order paper
osYYYYMMDD  -> Senate order paper
```

Patterns can change. Store the observed filename but derive identity from normalized metadata.

#### Extraction rules

- Prefer embedded sitting-page structure for agenda headings and speaker labels when available.
- Extract Hansard PDFs page by page.
- Preserve printed page number and PDF page index separately.
- Route scanned pages to OCR.
- Match speakers against the official member list only after retaining the verbatim source label.
- If the sitting-page summary and Hansard differ, treat the Hansard as the stronger transcript source and preserve both records.

#### T&T fixture set

Use at least:

- one recent House sitting with order paper, supplemental paper, Hansard and YouTube;
- one recent Senate sitting;
- one sitting with multiple supplemental order papers;
- one older text PDF;
- one older poor-quality or scanned record;
- one publication that appears in both the sitting route and Hansard archive.

### 4.3 T&T adapter acceptance criteria

- Discovers House and Senate independently.
- Associates available order papers, supplements, Hansard and video with one sitting.
- Does not create duplicate sittings when the same Hansard appears through two routes.
- Preserves original file URLs and sitting detail URL.
- Correctly parses date, chamber, sitting number, session and Parliament for at least 95% of the recent evaluation sample.
- Emits a warning, not fabricated metadata, when a historical field is missing.

---

## 5. Source inventory: Guyana

### 5.1 Official source map

| ID | Collection | Exact official URL | Content and role | Access pattern | Priority |
|---|---|---|---|---|---|
| GY-01 | National Assembly sittings | https://parliament.gov.gy/chamber-business/sittings/ | Sitting identity, date, description and related records/video where available. | Deep paginated HTML listing -> sitting detail | P0 |
| GY-02 | Hansard | https://parliament.gov.gy/chamber-business/hansard/ | Official reports of proceedings; deep historical archive. | Deep paginated HTML listing -> Hansard detail -> file | P0 |
| GY-03 | Notice Papers / Questions | https://parliament.gov.gy/chamber-business/notice-papers/ | Parliamentary questions and notices. | Paginated HTML listing -> detail/file | P0 |
| GY-04 | Order Papers | https://parliament.gov.gy/publications/order-papers/ | Business scheduled for sittings; useful for reconstructing agenda. | Paginated HTML listing -> detail/file | P0 |
| GY-05 | Bill Status | https://parliament.gov.gy/chamber-business/bill-status/ | Bill text plus structured progression fields such as publication, passage and assent dates. | Deep paginated HTML listing -> bill detail/file | P1 |
| GY-06 | Resolutions | https://parliament.gov.gy/chamber-business/resolutions/ | Assembly resolutions. | HTML listing -> detail/file | P1 |
| GY-07 | Minutes | https://parliament.gov.gy/publications/minutes/ | Attendance, decisions and divisions for sittings. | HTML listing -> detail/file; confirm current route during discovery | P1 |
| GY-08 | Documents Laid | https://parliament.gov.gy/publications/documents-laid/ | Officially tabled reports, regulations and policy documents. | Paginated HTML listing -> detail/file | P1 |
| GY-09 | Parliamentary Reports | https://parliament.gov.gy/publications/parliamentary-reports/ | Reports formally presented to the Assembly. | Paginated HTML listing -> detail/file | P2 |
| GY-10 | Acts of Parliament | https://parliament.gov.gy/publications/acts-of-parliament/ | Enacted legislation and legislative confirmation. | HTML listing -> detail/file; confirm current route during discovery | P2 |
| GY-11 | Current Parliamentarians | https://parliament.gov.gy/about-parliament/current-parliamentarians/ | Speaker/entity resolution reference. | HTML profiles/list | P2 |
| GY-12 | Video recordings | https://livestream.com/parliamentofguyana | Official-linked recordings; supplementary evidence and transcript fallback. | External video platform | P2 |

### 5.2 Connector behavior

Guyana's archive is extensive but metadata and titles are less consistent. Treat the site as multiple related paginated collections rather than assuming every document is attached cleanly to a sitting.

#### Discovery rules

1. Crawl `GY-01`, `GY-02`, `GY-03` and `GY-04` as separate streams.
2. Retain the site's pagination cursor/path exactly; do not construct page offsets without first observing the active pattern.
3. Normalize obvious whitespace, casing and spelling differences only into separate normalized fields.
4. Preserve original titles unchanged.
5. Link records using a weighted match over sitting number, Parliament number, date and title.
6. Never link on title similarity alone.
7. Allow `related_sitting_id = null` when the source does not provide enough evidence.
8. Route suspected scans through OCR and attach a quality score.

#### Record-linking score

Recommended initial deterministic scoring:

```text
exact sitting date       +0.40
exact sitting number     +0.30
exact Parliament number  +0.20
compatible title tokens  +0.10
```

Auto-link only at `>= 0.80`. Queue `0.60-0.79` for review. Keep lower matches unlinked.

#### Bill status handling

Guyana's Bill Status collection exposes unusually useful progression metadata. Store these separately:

```text
date_published
date_passed
date_assented
source_status_label
normalized_status
```

Do not overwrite the source label when mapping it into a controlled status vocabulary.

#### Guyana fixture set

- one recent sitting with related Hansard;
- one sitting with missing related-record links;
- one Hansard with inconsistent spelling/title;
- one older scanned Hansard;
- one notice paper containing multiple questions;
- one bill with publication, passage and assent dates;
- one duplicate-looking record that must remain separate or be safely deduplicated.

### 5.3 Guyana adapter acceptance criteria

- Traverses observed pagination without skipping or looping pages.
- Preserves inconsistent source titles while producing normalized fields.
- Deduplicates by canonical URL/content hash and not fuzzy title alone.
- Links documents to sittings only when the match threshold is met.
- Sends poor-quality documents through OCR and records OCR provenance.
- Correctly extracts bill progression fields for at least 95% of the sampled recent bills where the fields are published.

---

## 6. Source inventory: Barbados

### 6.1 Official source map

| ID | Collection | Exact official URL | Content and role | Access pattern | Priority |
|---|---|---|---|---|---|
| BB-01 | Archived Debates | https://www.barbadosparliament.com/debates | House/Senate debate search by chamber, date range and keyword. Debate files may be subject to correction. | Server-side search form/results -> document | P0, subject to access review |
| BB-02 | Order Papers | https://www.barbadosparliament.com/order_papers/search | Searchable order-paper collection. | Search endpoint -> results/files | P0 |
| BB-03 | Bills | https://www.barbadosparliament.com/bills/search | Searchable bills and related resolutions. | Search endpoint -> detail/files | P0 |
| BB-04 | House sitting documents/minutes | https://www.barbadosparliament.com/document/listall/1 | House-related sitting documents and minutes. | Paginated type listing -> file | P0 |
| BB-05 | Senate sitting documents/minutes | https://www.barbadosparliament.com/document/listall/2 | Senate-related sitting documents and minutes. | Paginated type listing -> file | P0 |
| BB-06 | Sittings | https://www.barbadosparliament.com/sittings | Sitting discovery and attachments. Confirm active route/filters during discovery. | HTML listing/search -> sitting/attachments | P0 |
| BB-07 | Notices of Questions | https://www.barbadosparliament.com/sittings/sittingattachments/notices-of-questions | Question notices attached to sittings. | Attachment-category listing -> file | P1 |
| BB-08 | Statements by Ministers | https://www.barbadosparliament.com/sittings/sittingattachments/statements-by-ministers | Official ministerial statements. | Attachment-category listing -> file | P1 |
| BB-09 | Reports | https://www.barbadosparliament.com/document/listall/24 | Parliamentary/fiscal reports. | Paginated document-type listing -> file | P1 |
| BB-10 | Document types | https://www.barbadosparliament.com/document/show | Index of document-type collections and route-discovery fallback. | HTML hub | P1 |
| BB-11 | Estimates | https://www.barbadosparliament.com/document/listall/3 | Estimates and fiscal records. | Paginated type listing -> file | P2 |
| BB-12 | Parliament TV | https://www.barbadosparliament.com/parliament_tv | Official live-TV page with embedded/current stream and links to archived video. | Embedded Vimeo/external video | P2 |
| BB-13 | Official YouTube | https://www.youtube.com/channel/UCnAo0XVbxFF2UCpkIkAS-6A/videos | Official Parliament-linked recording channel. | External video platform | P2 |
| BB-14 | Official Gazettes | https://governmentprintery.gov.bb/gazette/ | External verification source for later legal/regulatory vertical; not part of initial parliamentary ingestion. | External publication site | P3 |

### 6.2 Access precondition

Before enabling scheduled retrieval from Barbados:

1. Inspect current Terms of Use and `robots.txt`.
2. Record permitted paths and any disallow rules.
3. Use a descriptive user agent and conservative request rate.
4. Do not bypass authentication, CAPTCHA, anti-bot controls or technical restrictions.
5. If automated access remains ambiguous, pause live crawling and request permission from the Clerk of Parliament.

The adapter must support `manual_fixture_only` mode so engineering can build and test normalization without prematurely enabling scheduled access.

### 6.3 Connector behavior

Barbados should use a search-form/listing adapter, not assumptions about REST endpoints.

#### Discovery rules

1. Observe the actual form method, fields, hidden tokens and result URLs in a browser/network inspection.
2. Reproduce only normal public requests permitted by the site's terms.
3. Store query parameters and result-page URL with each discovery run.
4. Run date-bounded searches to avoid repeatedly retrieving the full debate archive.
5. Treat House and Senate as separate chambers.
6. Capture correction/provisional language shown on debate pages or files.
7. Re-fetch recent provisional debates on a slower correction schedule and create a new document version when content changes.

#### Debate status model

```text
official_final_transcript
official_corrected_transcript
official_provisional_transcript
official_status_unknown
```

If the site only states that records are generally subject to correction, default newly captured debate text to `official_provisional_transcript` until a document-specific final/corrected marker is observed.

#### Barbados fixture set

- one recent House debate;
- one recent Senate debate;
- one debate marked or presumed subject to correction;
- one corrected/revised record if available;
- one order paper;
- one bill and resolution;
- one House minute and one Senate minute;
- one record returned through a keyword/date search.

### 6.4 Barbados adapter acceptance criteria

- Access review is recorded before scheduled live collection is enabled.
- Search requests can be run with a bounded date range.
- Chamber and transcript status are preserved.
- Revisions create a version rather than silently replacing captured content.
- The connector backs off on `429`, `403`, `5xx` and unexpected challenge pages.
- No automated browser step attempts to bypass a restriction.

---

## 7. Source inventory: Jamaica

### 7.1 Official source map

| ID | Collection | Exact official URL | Content and role | Access pattern | Priority |
|---|---|---|---|---|---|
| JM-01 | Schedule of Meetings | https://www.japarliament.gov.jm/index.php?Itemid=29&id=262&option=com_content&view=article | Current parliamentary and committee meeting schedule; initial sitting/event discovery. | Joomla article updated in place | P0 |
| JM-02 | House Order Papers | https://www.japarliament.gov.jm/index.php?Itemid=34&id=3&option=com_content&view=category | House order papers. | Joomla category -> article/file | P0 |
| JM-03 | Senate Order Papers | https://www.japarliament.gov.jm/index.php?Itemid=35&id=4&option=com_content&view=category | Senate order papers. | Joomla category -> article/file | P0 |
| JM-04 | Public Bills | https://www.japarliament.gov.jm/index.php?Itemid=46&id=337&option=com_content&view=article | Public bill documents, though labels and historical coverage may be inconsistent. | Long Joomla article -> linked documents | P0 |
| JM-05 | Private Bills | https://www.japarliament.gov.jm/index.php?Itemid=47&id=338&option=com_content&view=article | Private bill documents. | Long Joomla article -> linked documents | P1 |
| JM-06 | General Reports / committee reports | https://www.japarliament.gov.jm/index.php?Itemid=22&id=7&option=com_content&view=category | Committee and general reports. | Paginated Joomla category -> article -> file | P0 |
| JM-07 | Document Center | https://www.japarliament.gov.jm/index.php?Itemid=271&id=2550&option=com_content&view=article | Additional official document discovery route. | Joomla article/download links | P1 |
| JM-08 | House Minutes | https://www.japarliament.gov.jm/index.php?Itemid=193&id=16&option=com_content&view=category | House minutes route; current page may be sparse and subcategory-driven. | Joomla category/subcategories | P1 |
| JM-09 | Main Parliament site | https://www.japarliament.gov.jm/ | Navigation/discovery fallback and current notices. | Joomla site/search | P1 |
| JM-10 | PBCJ YouTube | https://www.youtube.com/user/pbcjamaica | Official broadcaster meeting recordings; needed when no current official text transcript is available. | YouTube channel/videos/captions | P0 |
| JM-11 | PBCJ Facebook | https://www.facebook.com/pbcjamaica | Secondary broadcast discovery only; do not make it a required ingestion dependency. | Public social page | P3 |
| JM-12 | Jamaica Information Service | https://jis.gov.jm/ | Search for historical official parliamentary/Hansard material and government statements. | Official site search | P2 |

### 7.2 Important limitation

Jamaica does not currently expose a dependable, clearly indexed current Hansard collection comparable to Trinidad and Tobago or Guyana. The adapter must therefore reconstruct a sitting record from multiple official streams.

```text
meeting schedule + order paper + minutes/report + PBCJ recording
  -> normalized Jamaica sitting
```

The absence of an official text transcript must remain visible. Never relabel an automated transcript as Hansard.

### 7.3 Connector behavior

#### Discovery rules

1. Snapshot `JM-01` on each run because the article is updated in place.
2. Discover House and Senate business separately from `JM-02` and `JM-03`.
3. Normalize Joomla URLs by sorting query parameters, but retain the original URL.
4. Follow article links to the actual file; capture both article and file provenance.
5. Match PBCJ videos to sittings using date, chamber, title and described business.
6. Require a high-confidence match before attaching a video to a sitting.
7. Use official YouTube captions when available and label them `official_video_caption` only if the channel/video supplies them as captions.
8. If Octivate transcribes audio, label it `octivate_machine_transcript`, store timestamps and model/version, and keep it below official text in evidence authority.
9. Use JIS only as an official historical/supporting archive, not as a substitute for Parliament provenance where Parliament records exist.

#### Video-to-sitting match score

```text
exact event date         +0.40
explicit chamber match   +0.25
matching sitting/meeting +0.20
matching agenda tokens   +0.15
```

Auto-link at `>= 0.85`; queue `0.65-0.84` for review; otherwise leave unlinked.

#### Jamaica fixture set

- one House meeting with order paper and PBCJ video;
- one Senate meeting with order paper and PBCJ video;
- one committee meeting;
- one video with official captions;
- one video without captions requiring a short machine-transcript test;
- one report with an intermediate Joomla article and a linked PDF;
- one historical official Hansard/JIS item;
- one schedule-page update where the URL stays unchanged but content changes.

### 7.4 Jamaica adapter acceptance criteria

- Snapshots and versions the schedule article when content changes.
- Correctly separates House, Senate and committee events.
- Preserves both Joomla article URL and underlying file URL.
- Does not claim official-Hansard status for captions or machine transcripts.
- Attaches videos only at the defined confidence threshold.
- All machine-transcript passages retain start/end timestamps and generation provenance.

---

## 8. Shared connector contract

Implement one interface and four adapters. Adapt names to existing repository conventions rather than duplicating an equivalent abstraction.

```ts
export type CountryCode = "TT" | "JM" | "GY" | "BB";

export interface DiscoveryWindow {
  from?: string; // ISO date
  to?: string;   // ISO date
  cursor?: string;
  limit?: number;
}

export interface ParliamentConnector {
  readonly country: CountryCode;
  readonly connectorVersion: string;

  discoverSittings(window: DiscoveryWindow): Promise<DiscoveryPage<SittingCandidate>>;
  discoverDocuments(
    sitting: SittingCandidate,
    window?: DiscoveryWindow
  ): Promise<DocumentCandidate[]>;
  fetchDocument(candidate: DocumentCandidate): Promise<CapturedDocument>;
  normalizeMetadata(captured: CapturedDocument): Promise<ParliamentaryDocument>;
  healthCheck(): Promise<ConnectorHealth>;
}
```

Country adapters:

```text
TrinidadTobagoParliamentAdapter
GuyanaParliamentAdapter
BarbadosParliamentAdapter
JamaicaParliamentAdapter
```

Required shared behaviors:

- bounded discovery by date/item count;
- polite rate limiting and exponential backoff;
- canonical URL plus original URL;
- idempotent capture;
- content hashing and version creation;
- retryable versus terminal error classification;
- structured warnings for missing/ambiguous metadata;
- fixture mode with no network dependency;
- dry-run mode that reports candidates without capture;
- per-source access-policy configuration.

---

## 9. Normalized data model

### 9.1 Sitting

```ts
export interface ParliamentarySitting {
  id: string;
  country: CountryCode;
  legislature: string;
  chamber: "house" | "senate" | "national_assembly" | "joint" | "committee" | "unknown";
  sittingDate: string;
  startTime?: string;
  parliamentNumber?: string;
  sessionNumber?: string;
  sittingNumber?: string;
  titleOriginal: string;
  titleNormalized?: string;
  sourcePageUrl: string;
  status: "scheduled" | "held" | "published" | "cancelled" | "unknown";
  discoveredAt: string;
  lastObservedAt: string;
  warnings: string[];
}
```

Recommended deterministic ID:

```text
{country}-{chamber}-{sittingDate}-{parliamentNumber|x}-{sessionNumber|x}-{sittingNumber|x}
```

When required components are missing, create a stable source-derived suffix rather than guessing.

### 9.2 Parliamentary document

```ts
export type ParliamentaryDocumentType =
  | "hansard"
  | "debate"
  | "order_paper"
  | "supplemental_order_paper"
  | "minutes"
  | "bill"
  | "act"
  | "notice_question"
  | "resolution"
  | "committee_report"
  | "paper_laid"
  | "ministerial_statement"
  | "video"
  | "caption"
  | "machine_transcript"
  | "other";

export type TranscriptStatus =
  | "official_final_transcript"
  | "official_corrected_transcript"
  | "official_provisional_transcript"
  | "official_status_unknown"
  | "official_minutes"
  | "official_video_caption"
  | "octivate_machine_transcript"
  | "not_applicable";

export interface ParliamentaryDocument {
  id: string;
  country: CountryCode;
  sittingId?: string;
  documentType: ParliamentaryDocumentType;
  transcriptStatus: TranscriptStatus;
  titleOriginal: string;
  titleNormalized?: string;
  chamber?: ParliamentarySitting["chamber"];
  publicationDate?: string;
  sittingDate?: string;
  articleUrl?: string;
  fileUrl?: string;
  canonicalUrl: string;
  mimeType?: string;
  contentHash: string;
  versionNumber: number;
  sourceAuthority: "official_parliament" | "official_broadcaster" | "official_government_archive";
  extractionMethod?: "html" | "pdf_text" | "ocr" | "official_caption" | "asr";
  extractionQuality?: number;
  capturedAt: string;
  warnings: string[];
}
```

### 9.3 Agenda item and contribution

```ts
export interface AgendaItem {
  id: string;
  sittingId: string;
  sequence?: number;
  type: string;
  titleOriginal: string;
  titleNormalized?: string;
  documentIds: string[];
}

export interface Contribution {
  id: string;
  sittingId: string;
  agendaItemId?: string;
  documentId: string;
  sequence: number;
  speakerLabelOriginal: string;
  speakerEntityId?: string;
  speakerRoleAtTime?: string;
  partyAtTime?: string;
  text: string;
  printedPageStart?: string;
  printedPageEnd?: string;
  pdfPageStart?: number;
  pdfPageEnd?: number;
  timestampStartSeconds?: number;
  timestampEndSeconds?: number;
  citationUrl: string;
  confidence: number;
}
```

### 9.4 Signal

```ts
export type ParliamentarySignalType =
  | "policy_intention_stated"
  | "ministerial_commitment_made"
  | "project_delay_acknowledged"
  | "funding_or_expenditure_discussed"
  | "bill_introduced_or_debated"
  | "opposition_challenge_raised"
  | "regulatory_problem_identified"
  | "company_or_stakeholder_named"
  | "political_narrative_emerging"
  | "previous_commitment_contradicted";

export interface ParliamentarySignal {
  id: string;
  signalType: ParliamentarySignalType;
  contributionIds: string[];
  summary: string;
  occurredAt: string;
  detectedAt: string;
  verificationStatus: "statement_confirmed" | "implementation_unverified" | "later_confirmed" | "contradicted";
  confidence: number;
}
```

Every signal must point to at least one contribution or exact document passage. Do not create a signal from a model summary that cannot be cited.

---

## 10. Capture, extraction and provenance requirements

### Raw capture

For every fetched item, retain:

- original response URL and final URL after redirects;
- retrieval timestamp;
- response status and content type;
- original file or page snapshot where permitted;
- content hash;
- source-published date if available;
- discovery page/query that led to the item;
- connector and parser version;
- access-policy decision.

### PDF extraction

1. Attempt native text extraction page by page.
2. Score text quality using character count, alphabetic ratio and corruption indicators.
3. Route low-quality pages to OCR.
4. Preserve native and OCR text separately if both exist.
5. Maintain PDF page index and printed page label separately.
6. Never strip headers/footers irreversibly; derived cleaned text can coexist with raw extraction.

### HTML extraction

- Store the relevant article/listing snapshot or normalized capture according to existing Octivate policy.
- Strip navigation only in the derived text layer.
- Preserve headings, links and list/table structure.
- Detect pages that return a soft error or challenge while using HTTP 200.

### Video/caption extraction

- Store official video URL and video ID.
- Capture title, description, publication date, duration and channel identity.
- Preserve caption timestamps.
- Record whether captions are official, automatically generated by the platform, or generated by Octivate.
- Do not download or redistribute video unless permitted; metadata/caption retrieval must follow platform terms.

---

## 11. Deduplication and versioning

Apply the following order:

1. Exact canonical URL match
2. Exact source file URL match
3. Exact content hash match
4. Strong country-specific identity key match
5. Human review for fuzzy candidates

Never deduplicate solely because two records share a title or date.

Create a new version when:

- the content hash changes at the same canonical source;
- a provisional debate is corrected;
- an order paper receives a supplement;
- an article updated in place contains materially changed content.

Supplements are separate documents, not versions of the original order paper.

---

## 12. Error model and observability

Recommended error classes:

```ts
type ConnectorErrorCode =
  | "ACCESS_POLICY_BLOCKED"
  | "ROBOTS_DISALLOWED"
  | "RATE_LIMITED"
  | "AUTH_OR_CHALLENGE_PAGE"
  | "LISTING_PARSE_FAILED"
  | "DOCUMENT_FETCH_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "TEXT_EXTRACTION_FAILED"
  | "OCR_REQUIRED"
  | "METADATA_AMBIGUOUS"
  | "SITTING_LINK_UNCERTAIN"
  | "VIDEO_LINK_UNCERTAIN"
  | "CONTENT_CHANGED"
  | "SOURCE_STRUCTURE_CHANGED";
```

Every connector run should report:

- items discovered;
- items fetched;
- new versus unchanged versus revised items;
- documents linked/unlinked to sittings;
- native-text versus OCR counts;
- parse warnings;
- access/rate-limit events;
- source structure changes;
- elapsed time and retrieval cost.

---

## 13. API/output boundary

The first implementation does not need a new external microservice. Add routes or internal functions consistent with the current Next.js architecture.

Minimum internal operations:

```http
POST /api/connectors/parliament/{country}/discover
POST /api/connectors/parliament/{country}/capture
GET  /api/connectors/parliament/{country}/health
GET  /api/parliament/sittings
GET  /api/parliament/documents
GET  /api/parliament/contributions
GET  /api/parliament/search
```

If equivalent generic connector or evidence routes already exist, extend them instead of duplicating endpoints.

Every evidence search result derived from parliamentary material must expose:

```text
country
chamber
sitting date
speaker/source label
document/transcript status
exact passage
page or timestamp
original official URL
capture date
```

---

## 14. Test strategy

### Unit tests

- URL canonicalization
- date and sitting-number parsing
- filename-hint parsing
- content hashing/version decisions
- chamber normalization
- transcript-status mapping
- record-link confidence scoring
- pagination loop detection
- soft-error/challenge-page detection

### Fixture tests

Store sanitized or permitted HTML/PDF metadata fixtures per country:

```text
tests/fixtures/parliament/tt/
tests/fixtures/parliament/gy/
tests/fixtures/parliament/bb/
tests/fixtures/parliament/jm/
```

Do not make standard CI depend on live government websites.

### Live smoke tests

Run manually or on a controlled schedule:

- one listing request per enabled country;
- one recent document fetch;
- selector/structure health check;
- no historical pagination crawl;
- no Barbados live test until access review is complete.

### Evaluation sample

Create 30 records per country:

- 20 recent;
- 5 historical;
- 5 deliberately difficult records.

Manually label expected chamber, date, sitting number, document type, transcript status, speaker segments and citations. Report precision/recall separately for discovery, metadata, sitting linking and speaker segmentation.

---

## 15. Delivery sequence for Jaden

### Phase 0 — map to the existing repo

1. Locate current source registry/import code.
2. Locate document capture and evidence models.
3. Locate job queue/scheduler and storage abstractions.
4. Reuse current audit/run tracking.
5. Identify schema changes and request approval before migrations.

### Phase 1 — shared core plus T&T

1. Implement shared types and connector interface.
2. Add fixture runner and connector health model.
3. Implement T&T House and Senate sitting discovery.
4. Resolve sitting-linked order papers, supplements, Hansard and video.
5. Add Hansard archive fallback.
6. Capture PDFs and page-level text.
7. Return normalized sittings/documents to the existing evidence pipeline.
8. Test one real Octivate decision question.

### Phase 2 — Guyana portability test

1. Add Guyana pagination adapter.
2. Add title normalization and confidence-based sitting linkage.
3. Add OCR routing.
4. Add notice papers and bill-status fields.
5. Compare quality/cost with T&T.

### Phase 3 — Barbados controlled adapter

1. Complete access/robots/terms review.
2. Build against fixtures in `manual_fixture_only` mode.
3. Implement bounded search-form retrieval if permitted.
4. Add provisional/corrected debate versioning.

### Phase 4 — Jamaica multimodal adapter

1. Snapshot meeting schedule.
2. Add House/Senate order-paper discovery.
3. Link PBCJ videos at a high confidence threshold.
4. Ingest official captions where available.
5. Add optional machine transcription with explicit provenance.

### Phase 5 — unified search and signal pilot

1. Search all four countries through one normalized interface.
2. Add contribution segmentation where evaluation supports it.
3. Generate a limited signal taxonomy.
4. Link signals into claims/citations.
5. Evaluate whether signals materially improve an Octivate brief.

---

## 16. Definition of done for the first vertical slice

The first slice is complete when:

- T&T House and Senate recent sittings are discoverable through one adapter;
- associated order papers, supplements and Hansard are captured idempotently;
- original official URLs/files and content hashes are retained;
- normalized sitting/document records enter the existing evidence path;
- cited passages preserve page references;
- duplicate discovery routes do not create duplicate documents;
- fixtures and unit tests pass;
- a real decision question retrieves at least three relevant, correctly cited parliamentary passages;
- failed retrievals and ambiguous metadata are visible in a run record;
- no historical bulk crawl has been required to demonstrate the capability.

---

## 17. Cursor guardrails

Cursor should follow these rules while implementing:

1. Inspect before editing; map this spec to current abstractions.
2. Do not overwrite unrelated work or restructure the whole pipeline.
3. Do not create four independent schemas or four unrelated scraper frameworks.
4. Do not add a microservice when an internal Next.js module/job fits the current architecture.
5. Do not guess CSS selectors in advance; confirm them from fixtures/live discovery and isolate them in country adapter modules.
6. Do not use an LLM to perform deterministic discovery or basic metadata parsing.
7. Use an LLM only for bounded semantic tasks such as difficult agenda/speaker segmentation, with versioned prompts and source-linked outputs.
8. Do not label machine transcripts as official.
9. Do not treat statements in Parliament as proof of implementation.
10. Do not bypass site restrictions, CAPTCHAs, authentication or rate limits.
11. Keep live government-site calls out of normal CI.
12. Add migrations only after checking whether the existing source/evidence schema can represent these objects.

---

## 18. Reference notes and verification status

The source inventory was checked against the live or recently indexed official sites on 11 August 2026. Government websites can change routes and page structure without notice. The exact collection URLs above are implementation seeds; selectors, form fields, redirect targets, pagination mechanics, terms and robots directives must be confirmed during the connector discovery step and recorded in tests/configuration.

Key official entry points:

- Trinidad and Tobago Parliament: https://www.ttparliament.org/
- Jamaica Houses of Parliament: https://www.japarliament.gov.jm/
- Parliament of Guyana: https://parliament.gov.gy/
- Barbados Parliament: https://www.barbadosparliament.com/

The engineering outcome is not four downloaded archives. It is one reliable, provenance-preserving parliamentary evidence source that Octivate can query consistently across four uneven official data environments.
