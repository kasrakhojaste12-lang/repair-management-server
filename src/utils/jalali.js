// تبدیل تاریخ میلادی به شمسی و برعکس (الگوریتم استاندارد jalaali)
// همه‌ی گزارش‌های ماهانه بر اساس تقویم شمسی محاسبه می‌شوند.

function div(a, b) {
  return Math.trunc(a / b);
}

function mod(a, b) {
  return a - Math.trunc(a / b) * b;
}

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324,
  2394, 2456, 3178
];

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'ابان',
  'اذر',
  'دی',
  'بهمن',
  'اسفند'
];

function jalCal(jy) {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  let jm;

  for (let index = 1; index < BREAKS.length; index += 1) {
    jm = BREAKS[index];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export function gregorianToJalali(gy, gm, gd) {
  return d2j(g2d(gy, gm, gd));
}

export function jalaliToGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}

function pad(value) {
  return String(value).padStart(2, '0');
}

// ورودی می‌تواند 'YYYY-MM-DD'، 'YYYY-MM-DD HH:mm:ss' یا Date باشد
export function parseDateParts(value) {
  if (value instanceof Date) {
    return { gy: value.getFullYear(), gm: value.getMonth() + 1, gd: value.getDate() };
  }
  const text = String(value ?? '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  return { gy: Number(match[1]), gm: Number(match[2]), gd: Number(match[3]) };
}

export function jalaliMonthKey(jy, jm) {
  return `${jy}-${pad(jm)}`;
}

export function jalaliMonthLabel(jy, jm) {
  return `${JALALI_MONTHS[jm - 1]} ${jy}`;
}

// شروع ماه شمسی و شروع ماه بعد، به شکل تاریخ میلادی برای کوئری SQL
export function jalaliMonthRange(jy, jm) {
  const start = jalaliToGregorian(jy, jm, 1);
  const next = jm === 12 ? { y: jy + 1, m: 1 } : { y: jy, m: jm + 1 };
  const end = jalaliToGregorian(next.y, next.m, 1);
  return {
    start: `${start.gy}-${pad(start.gm)}-${pad(start.gd)}`,
    endExclusive: `${end.gy}-${pad(end.gm)}-${pad(end.gd)}`
  };
}

export function currentJalaliMonth(now = new Date()) {
  const { jy, jm } = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return { year: jy, month: jm };
}

export function addJalaliMonths(jy, jm, delta) {
  const total = (jy * 12 + (jm - 1)) + delta;
  return { year: div(total, 12), month: mod(total, 12) + 1 };
}
