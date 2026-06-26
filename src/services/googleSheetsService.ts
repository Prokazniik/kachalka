import { LogEntry, Exercise, Workout, ClosedExercise } from '../types';

// Storage keys
const APPS_SCRIPT_URL_KEY = 'gym_tracker_apps_script_url';
const SPREADSHEET_ID_KEY = 'gym_tracker_active_spreadsheet_id';

// Retrieve stored Apps Script Web App URL
export const getAppsScriptUrl = (): string | null => {
  const stored = localStorage.getItem(APPS_SCRIPT_URL_KEY);
  if (stored && (stored.includes('AKfycbxzJAvR') || stored.trim() === '')) {
    localStorage.removeItem(APPS_SCRIPT_URL_KEY);
    return 'https://script.google.com/macros/s/AKfycbwDSM3N8vU3PFZZ_6h0T5aV5D7XkV43Sd23dvzLsvyFtbzULHdGM2s-ySFyKK7C6hJ3/exec';
  }
  return stored || 'https://script.google.com/macros/s/AKfycbwDSM3N8vU3PFZZ_6h0T5aV5D7XkV43Sd23dvzLsvyFtbzULHdGM2s-ySFyKK7C6hJ3/exec';
};

export const setAppsScriptUrl = (url: string | null) => {
  if (url) {
    localStorage.setItem(APPS_SCRIPT_URL_KEY, url.trim());
  } else {
    localStorage.removeItem(APPS_SCRIPT_URL_KEY);
  }
};

// Retrieve spreadsheet ID (for reference/link generation)
export const getActiveSpreadsheetId = (): string => {
  return localStorage.getItem(SPREADSHEET_ID_KEY) || '1XbAN6Chyb5cAEbehf5pNcGmg4Fd_UG1vBGgTG5Xmha8';
};

export const setActiveSpreadsheetId = (id: string | null) => {
  if (id) {
    localStorage.setItem(SPREADSHEET_ID_KEY, id.trim());
  } else {
    localStorage.removeItem(SPREADSHEET_ID_KEY);
  }
};

// Compatibility dummy exports to prevent breaking other modules
export const getCachedToken = () => 'direct_link_no_token_needed';
export const initAuth = (onAuthSuccess?: any, onAuthFailure?: any) => {
  if (onAuthSuccess) {
    onAuthSuccess({ displayName: 'Тренер' }, 'direct_link_no_token_needed');
  }
  return () => {};
};
export const googleSignIn = async () => {
  return { user: { displayName: 'Тренер', email: 'direct-link@db' }, accessToken: 'direct_link_no_token_needed' };
};
export const logout = async () => {};

// --- Google Apps Script API Operations ---

// Helper for making API calls to Google Apps Script Web App
async function callAppsScript(payload: any = null): Promise<any> {
  const url = getAppsScriptUrl();
  if (!url) {
    throw new Error('Пожалуйста, вставьте ссылку на ваш Web App из Google Apps Script.');
  }

  // Google Apps Script redirect-friendly fetch using simple text/plain POST to avoid preflight issues
  const options: RequestInit = {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(payload),
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Ошибка подключения (${response.status}): ${response.statusText}`);
    }

    const result = await response.json();
    if (result.error) {
      throw new Error(`Ошибка Apps Script: ${result.error}`);
    }
    return result;
  } catch (err: any) {
    console.error('Apps Script call failed:', err);
    throw new Error(
      'Не удалось сохранить данные на сервере. Пожалуйста, убедитесь, что ваш Google Apps Script развернут как Веб-приложение (Web App), запуск от имени "Я" (Me), доступ предоставлен "Всем" (Anyone), и вы дали разрешение "Authorize Access" при первом запуске.'
    );
  }
}

// Setup Headers and write initial seed data in one batch
export async function setupSpreadsheetAndSeed(
  _spreadsheetId: string,
  exercises: Exercise[],
  workouts: Workout[],
  logs: LogEntry[],
  closed: ClosedExercise[]
) {
  return await callAppsScript({
    action: 'setupAndSeed',
    spreadsheetId: _spreadsheetId,
    exercises,
    workouts,
    logs,
    closed,
  });
}

// Helper to normalize any date representation from Google Sheets into "YYYY-MM-DD"
export function normalizeDate(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  
  // 1. Handle "Date(2026,5,24)" or "Date(2026, 5, 24)"
  if (str.startsWith('Date(') && str.endsWith(')')) {
    const parts = str.substring(5, str.length - 1).split(',').map(x => parseInt(x.trim()));
    if (parts.length >= 3) {
      const y = parts[0];
      const m = parts[1] + 1; // Google Gviz months are 0-indexed
      const d = parts[2];
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Handle standard YYYY-MM-DD (with optional time, e.g. from ISO or SQL formats)
  const yyyymmddRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
  const matchYMD = str.match(yyyymmddRegex);
  if (matchYMD) {
    return `${matchYMD[1]}-${matchYMD[2].padStart(2, '0')}-${matchYMD[3].padStart(2, '0')}`;
  }

  // 3. Handle DD.MM.YYYY or DD/MM/YYYY (common in Russian and European sheets)
  const ddmmyyyyRegex = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/;
  const matchDMY = str.match(ddmmyyyyRegex);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2].padStart(2, '0')}-${matchDMY[1].padStart(2, '0')}`;
  }

  // 4. Try parsing with standard Date constructor
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = parsed.getMonth() + 1;
      const d = parsed.getDate();
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  } catch (e) {}

  return str;
}

// Helper to fetch directly from Google Visualization API (extremely fast & robust read for public sheets)
async function fetchSheetGviz(spreadsheetId: string, sheetName: string, keys: string[]): Promise<any[]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when reading sheet: ${sheetName}`);
  }
  const text = await res.text();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`Invalid Google Sheets output format`);
  }
  const json = JSON.parse(text.substring(start, end + 1));
  if (json.status !== 'ok') {
    throw new Error(`Google Sheets responded with status: ${json.status}`);
  }
  
  const rows = json.table.rows;
  if (!rows || rows.length === 0) return [];
  
  const result: any[] = [];
  for (const row of rows) {
    if (!row || !row.c) continue;
    const item: any = {};
    keys.forEach((key, idx) => {
      const cell = row.c[idx];
      let val = cell ? cell.v : null;
      const formattedVal = cell ? cell.f : null;
      
      // Formatting adjustments
      if (key === 'exerciseIds' && val) {
        val = String(val).split(',').filter(Boolean);
      } else if (['weight', 'defaultWeight'].includes(key)) {
        val = parseFloat(val) || 0;
      } else if (['reps', 'sets', 'defaultReps', 'defaultSets'].includes(key)) {
        val = parseInt(val) || 0;
      } else if (key === 'date' || key === 'closedAt') {
        let normalized = normalizeDate(formattedVal);
        if (!normalized || normalized.startsWith('Date(')) {
          normalized = normalizeDate(val);
        }
        val = normalized;
      } else if (val === null || val === undefined) {
        val = '';
      }
      item[key] = val;
    });
    
    // Skip empty lines or header rows
    if (item.id === 'id' || item.athleteId === 'athleteId' || Object.values(item).every(v => v === '')) {
      continue;
    }
    result.push(item);
  }
  return result;
}

// Load entire database from Google Spreadsheet
export async function loadDataFromSpreadsheet(_spreadsheetId: string): Promise<{
  exercises: Exercise[];
  workouts: Workout[];
  logs: LogEntry[];
  closed: ClosedExercise[];
}> {
  const spreadsheetId = _spreadsheetId || getActiveSpreadsheetId();
  
  const normalizeLog = (log: any): LogEntry => ({
    ...log,
    date: normalizeDate(log.date),
    weight: parseFloat(log.weight) || 0,
    reps: parseInt(log.reps) || 0,
    sets: parseInt(log.sets) || 0,
  });

  const normalizeClosed = (c: any): ClosedExercise => ({
    ...c,
    closedAt: normalizeDate(c.closedAt),
  });

  // Try direct Visualization API fetch first (fast, bypasses all CORS/Apps Script issues)
  try {
    const [logs, exercises, workouts, closed] = await Promise.all([
      fetchSheetGviz(spreadsheetId, 'Logs', ['id', 'date', 'workoutId', 'exerciseId', 'athleteId', 'weight', 'reps', 'sets']),
      fetchSheetGviz(spreadsheetId, 'Exercises', ['id', 'name', 'defaultWeight', 'defaultReps', 'defaultSets', 'unit']),
      fetchSheetGviz(spreadsheetId, 'Workouts', ['id', 'name', 'exerciseIds']),
      fetchSheetGviz(spreadsheetId, 'Closed', ['athleteId', 'exerciseId', 'closedAt'])
    ]);
    
    return {
      logs: logs.map(normalizeLog),
      exercises,
      workouts,
      closed: closed.map(normalizeClosed)
    };
  } catch (gvizError: any) {
    console.warn('Direct Google Sheet gviz fetch failed, falling back to Apps Script Web App:', gvizError);
    
    const url = getAppsScriptUrl();
    if (!url) {
      throw new Error('Пожалуйста, укажите ссылку на ваш Web App из Google Apps Script.');
    }

    try {
      // First try standard GET (triggers doGet) with cache buster
      const response = await fetch(`${url}?spreadsheetId=${spreadsheetId}&_=${Date.now()}`, {
        method: 'GET',
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`Ошибка при чтении из Web App (${response.status})`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(`Ошибка Apps Script: ${result.error}`);
      }

      return {
        exercises: result.exercises || [],
        workouts: result.workouts || [],
        logs: (result.logs || []).map(normalizeLog),
        closed: (result.closed || []).map(normalizeClosed),
      };
    } catch (err: any) {
      console.warn('Apps Script load GET failed, trying POST:', err);
      try {
        const response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify({ action: 'load', spreadsheetId }),
        });
        if (!response.ok) {
          throw new Error(`Ошибка при чтении из Web App (${response.status})`);
        }
        const result = await response.json();
        if (result.error) {
          throw new Error(`Ошибка Apps Script: ${result.error}`);
        }
        return {
          exercises: result.exercises || [],
          workouts: result.workouts || [],
          logs: (result.logs || []).map(normalizeLog),
          closed: (result.closed || []).map(normalizeClosed),
        };
      } catch (fallbackErr: any) {
        throw new Error(
          'Не удалось подключиться и получить данные. Пожалуйста, убедитесь, что:\n1. Ваша Google Таблица открыта по ссылке (Доступ ограничен &rarr; Все, у кого есть ссылка &rarr; Читатель).\n2. Ваш Google Apps Script развернут как Веб-приложение (New Deployment &rarr; Web App).\n3. Выполнен запуск от вашего имени ("Me"), доступ предоставлен "Всем" ("Anyone").\n4. Вы дали права доступа "Authorize Access" при первой установке скрипта.'
        );
      }
    }
  }
}

// Append log entry rows directly to the Google Sheet
export async function appendLogEntries(_spreadsheetId: string, logs: LogEntry[]) {
  if (logs.length === 0) return;
  return await callAppsScript({
    action: 'appendLogEntries',
    spreadsheetId: _spreadsheetId,
    logs,
  });
}

// Overwrite Logs Sheet entirely
export async function overwriteLogs(_spreadsheetId: string, logs: LogEntry[]) {
  return await callAppsScript({
    action: 'overwriteLogs',
    spreadsheetId: _spreadsheetId,
    logs,
  });
}

// Overwrite Exercises Sheet entirely
export async function overwriteExercises(_spreadsheetId: string, exercises: Exercise[]) {
  return await callAppsScript({
    action: 'overwriteExercises',
    spreadsheetId: _spreadsheetId,
    exercises,
  });
}

// Overwrite Workouts Sheet entirely
export async function overwriteWorkouts(_spreadsheetId: string, workouts: Workout[]) {
  return await callAppsScript({
    action: 'overwriteWorkouts',
    spreadsheetId: _spreadsheetId,
    workouts,
  });
}

// Overwrite Closed Exercises Sheet entirely
export async function overwriteClosed(_spreadsheetId: string, closed: ClosedExercise[]) {
  return await callAppsScript({
    action: 'overwriteClosed',
    spreadsheetId: _spreadsheetId,
    closed,
  });
}
