export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPrice(price) {
  return parseFloat(String(price || '0').replace(/,/g, '') || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return null;
  let d;
  const chineseMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (chineseMatch) {
    d = new Date(parseInt(chineseMatch[1]), parseInt(chineseMatch[2]) - 1, parseInt(chineseMatch[3]));
  } else {
    d = new Date(dateStr);
  }
  return isNaN(d.getTime()) ? null : d;
}

export function getYearFromDate(dateStr) {
  const d = formatDate(dateStr);
  return d ? d.getFullYear() : null;
}

export function getMonthFromDate(dateStr) {
  const d = formatDate(dateStr);
  return d ? d.getMonth() : null;
}

export function getStoredYear() {
  return parseInt(localStorage.getItem('selectedYear'));
}

export function setStoredYear(year) {
  localStorage.setItem('selectedYear', year);
}

export function getBudgets() {
  return JSON.parse(localStorage.getItem('wardrobeBudgets') || '{}');
}

export function setBudgets(budgets) {
  localStorage.setItem('wardrobeBudgets', JSON.stringify(budgets));
}
