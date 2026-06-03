# Cap Table

A free, local-first cap table modeling tool. No login, no subscription, no server.

**[Live demo →](https://captable-app-ten.vercel.app)**

---

## What it does

- **Ledger** — full ownership table with basic and fully-diluted percentages, editable in-browser (add/edit/delete any security)
- **Round Simulator** — Series A modeling with iterative option pool solver, SAFE/note conversion (cap, discount, or most-favorable), and pre/post dilution matrix
- **Multi-Round** — chain Seed → Series A → Series B → C; each round auto-converts unpriced instruments and expands the option pool
- **Waterfall** — liquidation payout calculator with an exit valuation slider ($0–$100M+); handles 1× non-participating, participating, and participating-capped preferred with correct preference return math
- **Share URL** — the entire cap table state compresses into a URL hash fragment via lz-string; send a link to your lawyer before a board meeting, no account required
- **Import / Export** — JSON round-trip and CSV export (for lawyers and accountants who live in Excel)

---

## Why it exists

Carta charges $600+/year. Pulley and Captable.io exist but aren't open source and don't have a real modeling engine. This tool has the math, it's free, and your data never leaves your browser.

The goal is an open-source Carta alternative — starting with the modeling layer and building toward full cap table management.

---

## Local development

```bash
npm install
npm run dev
```

Requires Node 18+. Built with Vite, React 19, TypeScript, and Tailwind CSS 3.

```bash
npm run build   # production build
npm run lint    # eslint check
```

---

## JSON schema

The entire cap table is a single JSON object. Clean enough to use as an open standard for legal tech tooling.

```json
{
  "companyName": "Acme Technologies, Inc.",
  "authorizedShares": 15000000,
  "stakeholders": [
    { "id": "founder-alice", "name": "Alice Chen", "type": "founder" }
  ],
  "securities": [
    {
      "kind": "common",
      "id": "common-alice",
      "stakeholderId": "founder-alice",
      "shares": 4500000,
      "grantDate": "2022-01-15",
      "vestingMonths": 48,
      "cliffMonths": 12
    },
    {
      "kind": "safe",
      "id": "safe-sofia",
      "stakeholderId": "angel-sofia",
      "investmentAmount": 150000,
      "safeType": "cap_only",
      "valuationCap": 6000000
    },
    {
      "kind": "convertible_note",
      "id": "note-bridge",
      "stakeholderId": "vc-bridge",
      "principalAmount": 500000,
      "interestRate": 0.08,
      "issueDate": "2023-03-01",
      "maturityDate": "2025-03-01",
      "valuationCap": 10000000,
      "discountRate": 0.20,
      "compoundingFrequency": "annual"
    }
  ]
}
```

Security `kind` values: `common` · `preferred` · `option` · `safe` · `convertible_note`

SAFE `safeType` values: `cap_only` · `discount_only` · `most_favorable` · `post_money_safe`

Preferred `preferenceType` values: `non_participating` · `participating` · `participating_capped`

---

## Stack

- [Vite](https://vitejs.dev) + [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [lz-string](https://github.com/pieroxy/lz-string) for URL compression

---

## License

MIT
