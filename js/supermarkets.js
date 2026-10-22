// Shared supermarket constants.

export const MAX_SUPERMARKETS = 6;

// Profile columns holding preferred supermarkets, top preference first.
export const SUPERMARKET_SLOTS = Array.from({ length: MAX_SUPERMARKETS }, (_, i) => `supermarket_${i + 1}`);
