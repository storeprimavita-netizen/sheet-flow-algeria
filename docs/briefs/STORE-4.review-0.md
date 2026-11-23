VERDICT: ESCALATE
Reviewer model: claude-opus

## Summary

The design review checked the revised brief against D99 and the current stock and money readers. Three medium findings need a revised contract, including explicit treatment of D28 for order edits, role visibility and revenue. No implementation or live RLS tests exist yet.

## Findings

1. **Medium · STORE-4.md parent and lines.** Enforce at commit that line-backed orders have an exact amount and no parent variant, and that their line quantities sum to the parent quantity. Define legacy compatibility field values and the allowed quantity and price edits for a line-backed order.
2. **Medium · D99 and D28.** Explicitly establish whether line amounts and agent reads preserve the locked D14/D61 calculation and existing role contract. Get an owner decision before changing what a role can access or how profit is calculated.
3. **Medium · STORE-4.md checkout stock.** Final placement needs a stock check under the transaction lock. Use a shared D58 rule and avoid requiring buyer reconfirmation when a stock change leaves the selected quantity available and the quote unchanged.
4. **Low · replay persistence.** Store a keyed digest of the canonical payload in the replay table. Define the retention window and avoid copying buyer data into the replay record.
5. **Low · receipt privacy.** Set a receipt lifetime and `Referrer-Policy: no-referrer`. Keep third-party scripts off receipt pages.
6. **Low · carrier fixture.** Verify the existing ZR schema and fixture contract for item amounts on discounted parcels. The parcel amount must reflect the exact charge.

## Acceptance additions

- Verify commit-time invariants and line-backed edit behavior through normal agent and admin paths.
- Check last-piece contention, benign stock movement with unchanged price, hashed replay persistence and receipt expiry.
- Cover caller scope for line details and exact COD in the delivery view and carrier fixture.
