# Block exercise interaction

Word blocks, Phrase Builder, and Next-word blocks show their options above the
destination. On touch pickup, blocks immediately move above the fingertip; on
desktop, dragging places the pointer near the lower edge of the block.

The shared blockDrag helper defines this offset and the padded touch drop target.
The finger or cursor can reach the destination even when the lifted block is
visually above it. Only correct blocks stick. Cancellation or lost pointer capture
returns an unplaced block to the options.

All three exercises follow the pointer directly, without magnetic attraction or
block-overlap snapping. Placement happens when the pointer enters the active
destination (including the shared touch padding). The next destination highlights
only when the correct block is held. Desktop exercises share the same custom grab
cursor; the desktop lift takes effect on movement, not on initial mouse-down.
