// Indian number formatting: ₹10,00,000
export function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function formatNum(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function formatPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

export function formatRoas(n: number): string {
  return n.toFixed(2) + 'x'
}
