# Native QuantaPhi projects and card commerce
Owner direction recorded October 23, 2026. Engineering specification; no native hosting or checkout deployment is claimed.

## Product
QuantaPhi becomes a project host that creates versioned projects and publishes useful cards. GitHub can remain an optional export/mirror. Cloudflare is the initial proposed infrastructure provider; an independently operated hosting platform is a separate implementation, not ownership of Cloudflare.

A card is a reusable application surface: selected sources, saved search/filter, content, actions, permissions, and receipts. Reads & Realms should support attributed creator/editor collections rather than repeated stock filler. Media Star should support creator-authorized digital content sold to users with verified entitlement.

## Verified source starting points
- QuantaPhi/shop-ad-phi.js has local listing drafts, seller links, a configured authenticated WidgetPhi publishing path and ControlPhi.requestSponsoredCard(query, cardId). Collection reports that rewards depend on StarQuest confirmation.
- Existing model-visible skill packets include github-build-publish, widgetphi-card-registry, creator-curated-shop and starquest-settlement-boundary. They are instructions, not deployed adapters.
- The current signed Bubbles bridge has an unresolved per-request identity rejection. This specification does not bypass it.
- Existing wallet balances, ledger identity, recovery and settlements remain authoritative. No new balance store may silently replace them.

## Build A: native project repository
First executable slice: authenticated create project, write a revision, list/read exact files, export, publish one reviewed static revision, roll back. Start with static projects; server execution requires a separately isolated worker adapter.

Proposed durable records:
- project: projectId, verified ownerId, slug, visibility, headRevision, createdAt.
- revision: revisionId, projectId, parentRevisionId, authorId, immutable file manifest, content hash, test/review receipts.
- artifact: projectId, revisionId, normalized relative path, hash, size, mediaType, blob key.
- release: releaseId, projectId, revisionId, verified route, deployment receipt, previous release.
- actionReceipt: requestId, ownerId, operation, input hash, state, output reference, timestamp.

Use an ownership-checked metadata store and content-addressed object storage behind a typed storage interface. D1/R2 are candidates on Cloudflare; use backend-neutral manifests and export for portability. Atomic head updates must compare the expected parent revision. Reject traversal, conflicting retries, unauthorized cross-owner references and oversized uploads. Public releases must never expose private artifacts. Preview untrusted project code on an isolated origin without owner cookies or wallet grants.

Git semantics such as branches, merge and clone must be implemented and tested before calling this a Git server. Native versioned project storage can be useful before full Git compatibility.

Acceptance: two users cannot read each other's private project; duplicate request does not create a duplicate revision; concurrent write rejects stale parent; hash verification catches corruption; a published static card matches the exact reviewed revision; rollback and export work. No GitHub request is required for this acceptance path.

## Build B: common source-card contract
Every provider adapter returns:
cardId, ownerId, sourceProvider, canonicalSourceIds/URLs, query, filters, fetchedAt, freshness, rights/access metadata, display surface, allowed actions, adapter version, evidence references.

Support search-only and explicitly curated/prepackaged modes. X, radio, Clubhouse and eBay require separate provider adapters and actual availability checks; do not treat all providers as universally embeddable or purchasable. A source card opens as a compact card in chat; full-page work remains separate.

Reads & Realms: collection includes curator/creator identity, attributed source, revision and freshness; creator supply, original writing and source-based summaries retain provenance. Check repeated-content fallback explicitly.
Media Star: digital offer includes seller, content revision, access rights, price and denomination, preview, entitlement policy and delivery verification.

Acceptance: saved filters survive authorized reload, source provenance stays attached, stale/unavailable content is labeled, provider errors do not substitute fabricated content, and the actual card control changes observable state.

## Build C: digital checkout and rewards
Use the existing authoritative wallet/StarQuest adapter. Quote a digital offer with immutable seller/content revision, integer minor-unit amount, denomination, expiry, item rights and clear total. A user's deliberate Buy action authorizes that exact quote, not an open-ended model instruction.

Settlement requires atomic buyer debit, seller credit and entitlement with a unique idempotency key. Test double tap, replay, insufficient funds, changed price, concurrent balance updates and failed delivery/recovery. Reward entries are separate policy-governed receipts linked to actual eligible events; they are not invented exchange rates, payouts or automatic rewards for every click. No conversion between cash, StarCoins, Quants and Infinity is assumed.

Third-party physical purchases keep provider checkout until an authorized payment adapter is approved and tested. A wallet link does not imply that eBay accepts Phi currencies. Never claim an external purchase completed without its provider order receipt.

Acceptance: one digital-content purchase debits once, credits the correct seller once, grants the right content, and both users can read the receipt; retry returns the same outcome. Unauthorized content cannot be sold.

## Build D: recipient-controlled product matching
Advertisers submit factual item attributes, seller identity, source, price/currency, availability and destination. Buyers/card owners choose whether to accept sponsored matching and define categories, keywords, exclusions, condition, price/currency and shipping region. These preferences have a revision and revocation state.

Match offers inside the platform against current explicit filters. Keep private recipient identity, contact details, exact location, conversation history and wallet balances out of advertiser responses. An address for placement is an opaque opt-in card/placement ID, not a personal street address or exported personal profile.

Labels: Advertisement, advertiser, why this matched, source freshness and Hide/Change filters. Enforce exclusions and currency/price limits before relevance ranking. Sponsors cannot override filters by bidding more. Advertising delivery does not authorize buying. Budget/spend requires a separate approved campaign and settlement adapter.

Quant AI explains observed value as source-backed relevance: for example, this opted-in card requests used records below its stated price limit. Do not infer that someone pays cash, owns valuables or will purchase from a browsing signal. Distinguish asking price, completed sale, estimated value and unknown value. Do not promise monetary value of activity-derived tokens.

Acceptance: opted-out or revoked placements receive no offer; disallowed categories, words, price or region fail; matching does not leak private profiles; explanations cite the filters; empty results stay empty.

## Integration order and proof
Native static project storage -> published compact card -> creator-owned digital item -> atomic entitlement purchase -> opt-in product matching -> individually approved external checkout adapters.

Keep Bubbles language planning, executable adapters and capability checks separate. Add semantic skill packets only when their source/contract is ready; advertise runtime capability only after health, authorization and acceptance receipts verify it. This file is not a Brain lease or a claim of execution.

## Primary technical references checked October 23, 2026
- https://developers.cloudflare.com/r2/
- https://developers.cloudflare.com/d1/
- https://developer.ebay.com/api-docs/buy/api-order.html
The eBay Order API documentation identifies guest/member checkout as limited release. Confirm current production approval before enabling provider checkout.
