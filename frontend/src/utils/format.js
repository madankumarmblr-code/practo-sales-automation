export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function stageBadge(stage) {
  const map = {
    new: 'badge-blue',
    contacted: 'badge-teal',
    qualified: 'badge-amber',
    proposal: 'badge-coral',
    won: 'badge-green',
    lost: 'badge-gray',
  };
  return map[stage] || 'badge';
}

export function channelBadge(channel) {
  const map = {
    whatsapp: 'badge-teal',
    gmail: 'badge-coral',
    calls: 'badge-blue',
  };
  return map[channel] || 'badge';
}
