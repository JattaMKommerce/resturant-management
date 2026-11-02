// Kept in sync with OFFERING_TYPES in backend/controllers/offeringController.js
export const OFFERING_TYPES = [
  { id: 'TODAYS_SPECIAL', label: "Today's Special", emoji: '⭐', timeHint: 'e.g. All day, today only' },
  { id: 'BRUNCH', label: 'Brunch', emoji: '🥞', timeHint: 'e.g. 10:00 AM – 12:30 PM' },
  { id: 'LUNCH', label: 'Lunch', emoji: '🍛', timeHint: 'e.g. 12:30 PM – 3:30 PM' },
  { id: 'DINNER', label: 'Dinner', emoji: '🍽️', timeHint: 'e.g. 7:00 PM – 11:00 PM' },
  { id: 'COMBO', label: 'Combos', emoji: '🍱', timeHint: 'e.g. All day' }
];

export function getOfferingType(id) {
  return OFFERING_TYPES.find(t => t.id === id) || OFFERING_TYPES[0];
}

export function formatOfferingPrice(price) {
  if (price === null || price === undefined || price === '') return null;
  const value = Number(price);
  if (!Number.isFinite(value)) return null;
  return `₹${Number.isInteger(value) ? value : value.toFixed(2)}`;
}
