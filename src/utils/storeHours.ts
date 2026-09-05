import { Store } from '../types';

export interface StoreHoursStatus {
  isOpen: boolean;
  statusLabel: string;
  badgeClass: string;
  dotClass: string;
  scheduleDetail: string;
  nextEventText: string;
}

/**
 * Normalizes day string or checks if day index is included.
 * Day index: 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado.
 */
function isDayAllowed(dayIndex: number, text: string): boolean {
  const t = text.toLowerCase();

  // All days
  if (t.includes('todos os dias') || t.includes('diariamente') || t.includes('diario') || t.includes('segunda a domingo')) {
    return true;
  }

  // Terça a Domingo (closed on Monday: 1)
  if (t.includes('terça a domingo') || t.includes('terca a domingo')) {
    return dayIndex !== 1; // Open on 0, 2, 3, 4, 5, 6
  }

  // Quarta a Domingo (closed on Monday 1, Tuesday 2)
  if (t.includes('quarta a domingo')) {
    return dayIndex >= 3 || dayIndex === 0;
  }

  // Quinta a Domingo
  if (t.includes('quinta a domingo')) {
    return dayIndex >= 4 || dayIndex === 0;
  }

  // Segunda a Sábado (closed on Sunday: 0)
  if (t.includes('segunda a sábado') || t.includes('segunda a sabado')) {
    return dayIndex !== 0;
  }

  // Segunda a Sexta (closed on Saturday 6, Sunday 0)
  if (t.includes('segunda a sexta')) {
    return dayIndex >= 1 && dayIndex <= 5;
  }

  // Specific days list (e.g. "Sex, Sáb e Dom")
  const dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dayAbbr = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  
  if (t.includes(dayNames[dayIndex]) || t.includes(dayAbbr[dayIndex])) {
    return true;
  }

  // Default fallback: assume open all days if pattern not recognized
  return true;
}

interface TimeRange {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

/**
 * Parses time ranges like "18:00 às 23:30", "18:00 - 23:30", "11:00 às 15:00 e das 18:00 às 23:30".
 */
function parseTimeRanges(text: string): TimeRange[] {
  const ranges: TimeRange[] = [];
  // Regex to match e.g. "18:00" followed by separator and another "23:30"
  const regex = /(\d{1,2})[:h](\d{2})?\s*(?:às|as|até|ate|-|a)\s*(\d{1,2})[:h](\d{2})?/gi;
  
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const startHour = parseInt(match[1], 10);
    const startMin = match[2] ? parseInt(match[2], 10) : 0;
    const endHour = parseInt(match[3], 10);
    const endMin = match[4] ? parseInt(match[4], 10) : 0;
    ranges.push({ startHour, startMin, endHour, endMin });
  }

  return ranges;
}

/**
 * Checks if current time is within a time range, supporting overnight shifts (e.g. 18:00 às 02:00).
 */
function isTimeInRange(nowMinutes: number, range: TimeRange): boolean {
  const startTotal = range.startHour * 60 + range.startMin;
  const endTotal = range.endHour * 60 + range.endMin;

  if (startTotal <= endTotal) {
    // Normal daytime / evening shift within same day
    return nowMinutes >= startTotal && nowMinutes <= endTotal;
  } else {
    // Overnight shift: open from e.g. 18:00 (1080m) to 02:00 (120m) next day
    return nowMinutes >= startTotal || nowMinutes <= endTotal;
  }
}

/**
 * Evaluates whether a store is open right now based on its workingHours string.
 */
export function getStoreHoursStatus(store: Store, referenceDate = new Date()): StoreHoursStatus {
  // If store is explicitly deactivated in admin
  if (store.isActive === false) {
    return {
      isOpen: false,
      statusLabel: 'Fechado',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      dotClass: 'bg-slate-400',
      scheduleDetail: store.workingHours || 'Indisponível no momento',
      nextEventText: 'Pausado pelo estabelecimento'
    };
  }

  const hoursStr = store.workingHours || '';
  if (!hoursStr.trim()) {
    return {
      isOpen: true,
      statusLabel: 'Online',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500 animate-pulse',
      scheduleDetail: 'Aberto agora',
      nextEventText: 'Atendimento Normal'
    };
  }

  const currentDay = referenceDate.getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb
  const currentHours = referenceDate.getHours();
  const currentMinutes = referenceDate.getMinutes();
  const nowTotalMinutes = currentHours * 60 + currentMinutes;

  const dayAllowed = isDayAllowed(currentDay, hoursStr);
  const timeRanges = parseTimeRanges(hoursStr);

  // If no time ranges could be parsed, fallback to open if day is allowed
  if (timeRanges.length === 0) {
    return {
      isOpen: dayAllowed,
      statusLabel: dayAllowed ? 'Online' : 'Fechado',
      badgeClass: dayAllowed 
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
        : 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: dayAllowed ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400',
      scheduleDetail: hoursStr,
      nextEventText: dayAllowed ? 'Aberto hoje' : 'Fechado hoje'
    };
  }

  // Check if now matches any range for today
  let isOpenNow = false;
  let currentActiveRange: TimeRange | null = null;

  if (dayAllowed) {
    for (const range of timeRanges) {
      if (isTimeInRange(nowTotalMinutes, range)) {
        isOpenNow = true;
        currentActiveRange = range;
        break;
      }
    }
  }

  // Also check if yesterday was open and an overnight shift extends into this morning!
  if (!isOpenNow) {
    const yesterday = (currentDay + 6) % 7;
    if (isDayAllowed(yesterday, hoursStr)) {
      for (const range of timeRanges) {
        const startTotal = range.startHour * 60 + range.startMin;
        const endTotal = range.endHour * 60 + range.endMin;
        if (startTotal > endTotal && nowTotalMinutes <= endTotal) {
          isOpenNow = true;
          currentActiveRange = range;
          break;
        }
      }
    }
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  if (isOpenNow && currentActiveRange) {
    const closeStr = `${pad(currentActiveRange.endHour)}:${pad(currentActiveRange.endMin)}`;
    return {
      isOpen: true,
      statusLabel: 'Online • Aberto Agora',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      dotClass: 'bg-emerald-500 animate-pulse',
      scheduleDetail: hoursStr,
      nextEventText: `Fecha às ${closeStr}`
    };
  }

  // If closed, find next opening time
  const firstRange = timeRanges[0];
  const startStr = `${pad(firstRange.startHour)}:${pad(firstRange.startMin)}`;
  const nextText = dayAllowed && nowTotalMinutes < (firstRange.startHour * 60 + firstRange.startMin)
    ? `Abre hoje às ${startStr}`
    : `Fechado no momento (Abre às ${startStr})`;

  return {
    isOpen: false,
    statusLabel: 'Fechado',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 font-semibold',
    dotClass: 'bg-rose-500',
    scheduleDetail: hoursStr,
    nextEventText: nextText
  };
}
