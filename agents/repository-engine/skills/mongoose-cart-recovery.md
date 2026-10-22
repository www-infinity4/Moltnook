# Legacy mongoose.os / C13b0 cart recovery skill

## Original project, recovered history — December 2025

The owner's historical `pewpi-infinity/mongoose.os` was described as an automation **cart library**, with many scripts named `cart*.py` or `cart*.sh`. It was **not established** to be a MongoDB database or to be the upstream Cesanta Mongoose OS firmware project. The `infinity-treasury` consumer was intended to pull **only cart scripts**, excluding research, tokens, credentials and huge directories. An assimilation script was described as `cart_c13b0_🧱🧠🧱_ASSIMILATE_FROM_MONGOOSE.sh`, and a login-assimilation script as `cart_c13b0_🧱🧠🧱_PEWPI_LOGIN_ASSIMILATION.sh`; these are historical names, NOT verified/current contents.

Other historical C13b0 carts:
- Cart 011: assembler, with `assembler/registry.js`, `assemble.js`, `intent_handlers.js`
- Cart 012: activation
- Cart 013: token→isolated website and ownership ledger
- Cart 014: marketplace, listings, and preview capture

As of October 22, 2026, GitHub cannot retrieve `pewpi-infinity/mongoose.os`, `pewpi-infinity/infinity-treasury` or `pewpi-infinity/infinity-brain-111` through the currently connected GitHub account (404). They may have moved, become private, or been removed. **Do not declare them deleted or fabricate their scripts.**

## How Bubbles should recover/use them

1. Search the saved `agents/repository-engine/verified-fork-registry.json` and current authenticated GitHub repositories. A presently readable `www-infinity4/C13b0` README describes an Infinity OS web application and a cartoon engine, not evidence the 1,000 legacy carts survived there.
2. If the original owner's repo becomes accessible with genuine GitHub read permission, obtain its pinned SHA and metadata tree through an authenticated, allowlisted read tool. Use `python3 scripts/mongoose_cart_inventory.py saved-tree.json` to inventory **metadata only**. Do not clone megabytes of irrelevant data, or request the user to type shell commands.
3. Inspect exact `cart*.py` and `cart*.sh` files from an approved repository only when a real task requires them. Check ownership, license, path, expected inputs, static syntax, dependencies, writes, secrets, and network behavior. **Never execute an untrusted cart just because it is discovered**.
4. For permitted execution, use an isolated cloud Python/Linux job workspace with no wallet secrets or unrestricted network, bounded time/CPU/storage and verified after-action receipts. Do not run arbitrary scripts on the user's Android phone, or ESP32 board.
5. Store a non-sensitive cart catalog with repository, path, SHA, language, source-verified status, test state and known limitations in the private Bubbles-Memory-Scripts system. Actual user/person memory belongs in verified wallet-scoped Cloudflare D1; a GitHub commit is not user memory sync.

## ESP32 / Mongoose name collision

**Three distinct concepts:**
- `mongoose.os`: owner's historical C13b0/Python/shell cart automation library (not currently accessible)
- **Cesanta Mongoose OS**: IoT firmware framework for ESP32 and related chips, built around C/JavaScript plus platform tooling; source: https://github.com/cesanta/mongoose-os
- **Mongoose for MongoDB**: JavaScript object/document modeling library, not the cart runtime.

An ESP32 is capable of sensors, local networking and automation, but the **Python cart library should run in a separate host/cloud sandbox**. Only validated, authenticated, minimally scoped device commands may eventually bridge to an ESP32; device discovery, firmware flashing, physical relay actuation and OTA deployment require their own measured hardware acceptance. Use ESP-IDF/ESPHome/Mongoose OS only after establishing the exact hardware/firmware and supported features. Never claim an emulator or cloud script turned on a physical relay.

## Success grading

Bubbles gets full credit for a cart action only after an actual verified repository read or authorized sandbox execution receipt. It gets **zero execution credit** for simply naming a cart or describing a command. Maintain Oracle styling on any user-facing control or card. Report inaccessible source plainly, provide alternatives through actual accessible forks, and do not make the user memorize internal tool names.

The `verified-fork-registry.json` entries are a source discovery aid, not an authorization grant. Color agents must retain pinned source and review+CI gates.
