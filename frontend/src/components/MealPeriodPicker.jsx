import React from 'react';

/**
 * Breakfast / Lunch / Dinner tags for a dish or category (REQ-001).
 * `value` is an array of period keys; an empty array means "served all day".
 */
export const MEAL_PERIODS = [
  { key: 'BREAKFAST', label: 'Breakfast' },
  { key: 'LUNCH', label: 'Lunch' },
  { key: 'DINNER', label: 'Dinner' }
];

export function parseMealPeriods(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
}

export default function MealPeriodPicker({ value = [], onChange, label = 'Served at', hint }) {
  const toggle = (key) => {
    const next = value.includes(key) ? value.filter((k) => k !== key) : [...value, key];
    onChange(MEAL_PERIODS.map((p) => p.key).filter((k) => next.includes(k)));
  };
  return (
    <fieldset>
      <legend className="block font-bold text-[#1F2937] mb-1">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {MEAL_PERIODS.map((p) => (
          <label key={p.key}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer text-xs font-bold ${value.includes(p.key) ? 'bg-[#EAF4F7] border-[#3A7D7C] text-[#2F6665]' : 'bg-white border-[#D7E5E8] text-[#475569]'}`}>
            <input type="checkbox" className="accent-[#3A7D7C]" checked={value.includes(p.key)} onChange={() => toggle(p.key)} />
            {p.label}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-[#64748B] mt-1">
        {hint || (value.length === 0 ? 'None ticked: served all day.' : 'Customers can only order this during the ticked meal times (when meal scheduling is on in Settings).')}
      </p>
    </fieldset>
  );
}
