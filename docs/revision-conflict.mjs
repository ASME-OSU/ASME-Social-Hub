/**
 * Ignore dispatcher-managed metadata when checking an in-progress editor session.
 * The latest status/results/log/revision are always taken from GitHub on save.
 * Any other change is treated as a real edit conflict (fail closed).
 */
const SERVER_OWNED = new Set(['status', 'results', 'log', 'revision']);

function editableSnapshot(campaign) {
  return Object.fromEntries(
    Object.entries(campaign || {})
      .filter(([key]) => !SERVER_OWNED.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function hasEditableConflict(original, latest) {
  return JSON.stringify(editableSnapshot(original)) !== JSON.stringify(editableSnapshot(latest));
}
