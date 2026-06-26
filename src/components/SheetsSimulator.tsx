import React, { useState, useEffect } from 'react';
import { Athlete, Exercise, Workout, LogEntry, ClosedExercise } from '../types';
import { generateSheetCSV } from '../services/dbService';
import {
  getActiveSpreadsheetId,
  setActiveSpreadsheetId,
  getAppsScriptUrl,
  setAppsScriptUrl,
  setupSpreadsheetAndSeed,
  loadDataFromSpreadsheet,
} from '../services/googleSheetsService';
import {
  FileSpreadsheet,
  Download,
  Clipboard,
  Check,
  RefreshCw,
  Link2,
  AlertCircle,
  HelpCircle,
  Database,
  Code,
} from 'lucide-react';

interface SheetsSimulatorProps {
  athletes: Athlete[];
  exercises: Exercise[];
  workouts: Workout[];
  logs: LogEntry[];
  closed: ClosedExercise[];
  onSyncData: (synced: {
    exercises: Exercise[];
    workouts: Workout[];
    logs: LogEntry[];
    closed: ClosedExercise[];
  }) => void;
  onExportAll: () => Promise<void>;
}

export default function SheetsSimulator({
  athletes,
  exercises,
  workouts,
  logs,
  closed,
  onSyncData,
  onExportAll,
}: SheetsSimulatorProps) {
  const [spreadsheetId, setSpreadsheetId] = useState<string>(
    getActiveSpreadsheetId() || '1XbAN6Chyb5cAEbehf5pNcGmg4Fd_UG1vBGgTG5Xmha8'
  );
  const [appsScriptUrl, setAppsScriptUrlState] = useState<string>(getAppsScriptUrl() || '');
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const [activeSheet, setActiveSheet] = useState<'athletes' | 'workouts' | 'exercises' | 'logs' | 'closed'>('logs');
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Sync inputs to localStorage
  useEffect(() => {
    setActiveSpreadsheetId(spreadsheetId);
  }, [spreadsheetId]);

  useEffect(() => {
    setAppsScriptUrl(appsScriptUrl);
  }, [appsScriptUrl]);

  // Extract ID from full URL if the user pasted a link
  const handleSpreadsheetIdChange = (val: string) => {
    let finalId = val.trim();
    const sheetUrlRegex = /\/d\/([a-zA-Z0-9-_]+)/;
    const match = finalId.match(sheetUrlRegex);
    if (match && match[1]) {
      finalId = match[1];
    }
    setSpreadsheetId(finalId);
  };

  // Force pulling data from Google Sheet
  const handlePullFromSheets = async () => {
    if (!appsScriptUrl.trim()) {
      setSyncStatus({
        type: 'error',
        message: 'Пожалуйста, настройте и вставьте ссылку на ваш Web App из Google Apps Script ниже.',
      });
      return;
    }
    setLoading(true);
    setSyncStatus(null);
    try {
      const synced = await loadDataFromSpreadsheet(spreadsheetId);
      onSyncData(synced);
      setSyncStatus({
        type: 'success',
        message: 'Все таблицы успешно импортированы из Google Sheets в локальное приложение!',
      });
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: `Ошибка при импорте: ${err.message || err}. Проверьте правильность ссылки Web App.`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Force pushing data to Google Sheet
  const handlePushToSheets = async () => {
    if (!appsScriptUrl.trim()) {
      setSyncStatus({
        type: 'error',
        message: 'Пожалуйста, настройте и вставьте ссылку на ваш Web App из Google Apps Script ниже.',
      });
      return;
    }
    setLoading(true);
    setSyncStatus(null);
    try {
      await onExportAll();
      setSyncStatus({
        type: 'success',
        message: 'Все локальные данные успешно выгружены в Google Таблицу (старые данные перезаписаны).',
      });
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: `Ошибка при экспорте: ${err.message || err}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Sheet configuration details for the preview table
  const sheetsConfig = {
    athletes: {
      title: 'Athletes (Спортсмены)',
      columns: ['id', 'name'],
      data: athletes,
    },
    workouts: {
      title: 'Workouts (Шаблоны)',
      columns: ['id', 'name', 'exerciseIds'],
      data: workouts.map(w => ({
        id: w.id,
        name: w.name,
        exerciseIds: w.exerciseIds.join(','),
      })),
    },
    exercises: {
      title: 'Exercises (Справочник)',
      columns: ['id', 'name', 'defaultWeight', 'defaultReps', 'defaultSets', 'unit'],
      data: exercises,
    },
    logs: {
      title: 'Logs (Записи результатов)',
      columns: ['id', 'date', 'workoutId', 'exerciseId', 'athleteId', 'weight', 'reps', 'sets'],
      data: [...logs].sort((a, b) => b.date.localeCompare(a.date)),
    },
    closed: {
      title: 'ClosedExercises (Закрытые)',
      columns: ['athleteId', 'exerciseId', 'closedAt'],
      data: closed,
    },
  };

  const activeSheetConfig = sheetsConfig[activeSheet];

  const handleDownloadCSV = (sheetKey: typeof activeSheet) => {
    const config = sheetsConfig[sheetKey];
    const csvContent = generateSheetCSV(config.title, config.data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GymTracker_${config.title.split(' ')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCSVToClipboard = () => {
    const csvContent = generateSheetCSV(activeSheetConfig.title, activeSheetConfig.data);
    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const appsScriptCode = `function doGet(e) {
  return handleLoad();
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === "load") {
      return handleLoad();
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetsExist(ss);

    if (action === "setupAndSeed") {
      writeToSheet(ss.getSheetByName("Logs"), [
        ['id', 'date', 'workoutId', 'exerciseId', 'athleteId', 'weight', 'reps', 'sets'],
        ...postData.logs.map(log => [log.id, log.date, log.workoutId, log.exerciseId, log.athleteId, log.weight, log.reps, log.sets])
      ]);
      writeToSheet(ss.getSheetByName("Exercises"), [
        ['id', 'name', 'defaultWeight', 'defaultReps', 'defaultSets', 'unit'],
        ...postData.exercises.map(ex => [ex.id, ex.name, ex.defaultWeight, ex.defaultReps, ex.defaultSets, ex.unit])
      ]);
      writeToSheet(ss.getSheetByName("Workouts"), [
        ['id', 'name', 'exerciseIds'],
        ...postData.workouts.map(w => [w.id, w.name, w.exerciseIds.join(',')])
      ]);
      writeToSheet(ss.getSheetByName("Closed"), [
        ['athleteId', 'exerciseId', 'closedAt'],
        ...postData.closed.map(c => [c.athleteId, c.exerciseId, c.closedAt])
      ]);
    } else if (action === "appendLogEntries") {
      const sheet = ss.getSheetByName("Logs");
      postData.logs.forEach(log => {
        sheet.appendRow([log.id, log.date, log.workoutId, log.exerciseId, log.athleteId, log.weight, log.reps, log.sets]);
      });
    } else if (action === "overwriteExercises") {
      writeToSheet(ss.getSheetByName("Exercises"), [
        ['id', 'name', 'defaultWeight', 'defaultReps', 'defaultSets', 'unit'],
        ...postData.exercises.map(ex => [ex.id, ex.name, ex.defaultWeight, ex.defaultReps, ex.defaultSets, ex.unit])
      ]);
    } else if (action === "overwriteWorkouts") {
      writeToSheet(ss.getSheetByName("Workouts"), [
        ['id', 'name', 'exerciseIds'],
        ...postData.workouts.map(w => [w.id, w.name, w.exerciseIds.join(',')])
      ]);
    } else if (action === "overwriteClosed") {
      writeToSheet(ss.getSheetByName("Closed"), [
        ['athleteId', 'exerciseId', 'closedAt'],
        ...postData.closed.map(c => [c.athleteId, c.exerciseId, c.closedAt])
      ]);
    }

    return createJSONResponse({ success: true });
  } catch (err) {
    return createJSONResponse({ error: err.toString() });
  }
}

function handleLoad() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetsExist(ss);

    const result = {
      logs: parseSheet(ss.getSheetByName("Logs"), ["id", "date", "workoutId", "exerciseId", "athleteId", "weight", "reps", "sets"]),
      exercises: parseSheet(ss.getSheetByName("Exercises"), ["id", "name", "defaultWeight", "defaultReps", "defaultSets", "unit"]),
      workouts: parseSheet(ss.getSheetByName("Workouts"), ["id", "name", "exerciseIds"]),
      closed: parseSheet(ss.getSheetByName("Closed"), ["athleteId", "exerciseId", "closedAt"])
    };

    return createJSONResponse(result);
  } catch (err) {
    return createJSONResponse({ error: err.toString() });
  }
}

function ensureSheetsExist(ss) {
  const sheetNames = ["Logs", "Exercises", "Workouts", "Closed"];
  sheetNames.forEach(name => {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  });
}

function parseSheet(sheet, keys) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(cell => cell === "")) continue;
    const item = {};
    keys.forEach((key, idx) => {
      let val = row[idx];
      if (key === "exerciseIds" && val) {
        val = String(val).split(",").filter(Boolean);
      } else if (["weight", "defaultWeight"].includes(key)) {
        val = parseFloat(val) || 0;
      } else if (["reps", "sets", "defaultReps", "defaultSets"].includes(key)) {
        val = parseInt(val) || 0;
      } else if (val === undefined) {
        val = "";
      }
      item[key] = val;
    });
    rows.push(item);
  }
  return rows;
}

function writeToSheet(sheet, rows) {
  sheet.clearContents();
  if (rows.length > 0) {
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function createJSONResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* DB Connection Config Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
        {/* URL Inputs */}
        <div className="bg-card-dark rounded-xl border border-border-dark p-5 shadow-md lg:col-span-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-widest text-accent-lime flex items-center gap-2">
              <Database className="h-4 w-4" />
              Интеграция с Google Таблицей
            </h3>
            <p className="text-[11px] text-gray-400">
              Полностью автономный доступ без раздражающих окон авторизации и авторизационных токенов. Все данные пишутся напрямую по вашей ссылке.
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                Ссылка на Google Таблицу:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                  onChange={(e) => handleSpreadsheetIdChange(e.target.value)}
                  className="w-full bg-input-dark border border-border-dark text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-lime/50 font-mono"
                  placeholder="Вставьте ссылку на Google Таблицу..."
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                Ссылка на Google Apps Script Web App:
              </label>
              <input
                type="text"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrlState(e.target.value)}
                className="w-full bg-input-dark border border-border-dark text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-lime/50 font-mono text-accent-lime font-bold"
                placeholder="https://script.google.com/macros/s/.../exec"
              />
              <span className="block text-[9px] text-gray-500 mt-1">
                Укажите Web App URL, полученный после развертывания скрипта.
              </span>
            </div>
          </div>

          {spreadsheetId && (
            <div className="pt-2">
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                target="_blank"
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 bg-input-dark hover:bg-white/10 text-gray-300 text-xs font-black uppercase tracking-widest py-3 px-4 rounded-xl border border-border-dark whitespace-nowrap cursor-pointer transition-colors"
              >
                <Link2 className="h-4 w-4 text-accent-lime" />
                <span>Открыть Таблицу Google</span>
              </a>
            </div>
          )}
        </div>

        {/* Sync Controls */}
        <div className="bg-card-dark rounded-xl border border-border-dark p-5 shadow-md lg:col-span-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-widest text-accent-lime flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Действия с Базой Данных
            </h3>
            <p className="text-[11px] text-gray-400">
              Выполняйте импорт и экспорт данных в один клик. Все изменения тренировок будут также автоматически фоново синхронизироваться!
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePullFromSheets}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider py-3.5 px-4 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 text-white" />
              )}
              <span>Загрузить данные из Google Таблицы</span>
            </button>

            <button
              onClick={handlePushToSheets}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2.5 bg-neutral-900 hover:bg-neutral-800 border border-border-dark disabled:border-transparent disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider py-3.5 px-4 rounded-xl transition-all cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-accent-lime" />
              )}
              <span>Выгрузить локальные данные в Google</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-border-dark/50 pt-3">
            <span>Режим интеграции:</span>
            <span className="font-mono bg-accent-lime/10 text-accent-lime border border-accent-lime/20 px-2 py-0.5 rounded text-[10px] font-bold">
              Apps Script Web App API
            </span>
          </div>
        </div>
      </div>

      {/* Sync State Alert Area */}
      {syncStatus && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            syncStatus.type === 'success'
              ? 'bg-accent-lime/10 border-accent-lime/30 text-accent-lime'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {syncStatus.type === 'success' ? (
              <Check className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <span className="block text-xs font-bold uppercase tracking-wide">
              {syncStatus.type === 'success' ? 'Синхронизация успешна' : 'Проблема синхронизации'}
            </span>
            <span className="block text-[11px] text-gray-300 mt-1">{syncStatus.message}</span>
          </div>
        </div>
      )}

      {/* Instructions Card */}
      <div className="bg-card-dark rounded-xl border border-border-dark overflow-hidden shadow-md">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between p-4 bg-black/25 text-left font-bold text-xs uppercase tracking-wider text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-accent-lime" />
            Инструкция: Настройка базы данных за 30 секунд
          </span>
          <span className="text-gray-500 font-mono text-[10px]">
            {showInstructions ? '[ Скрыть ]' : '[ Развернуть ]'}
          </span>
        </button>

        {showInstructions && (
          <div className="p-5 border-t border-border-dark/60 space-y-4 text-xs text-gray-300 font-sans leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-bold text-accent-lime uppercase tracking-wider text-[11px]">Как настроить Google Таблицу</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-300">
                  <li>Откройте вашу таблицу <a href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} target="_blank" rel="noreferrer" className="text-indigo-400 underline font-semibold">по этой ссылке</a>.</li>
                  <li>Перейдите в меню <b>Расширения (Extensions) &rarr; Apps Script</b>.</li>
                  <li>Удалите весь старый код в редакторе.</li>
                  <li>Скопируйте скрипт (справа) и вставьте его в редактор.</li>
                  <li>Нажмите <b>Развернуть &rarr; Новое развертывание</b> (Deploy &rarr; New deployment).</li>
                  <li>Выберите тип: <b>Веб-приложение</b> (Web App) нажав на шестеренку.</li>
                  <li>Запуск от имени: <b>Я</b> (Me).</li>
                  <li>Доступ: <b>Все</b> (Anyone).</li>
                  <li>Нажмите <b>Развернуть</b>, предоставьте разрешения и скопируйте полученную ссылку <b>URL веб-приложения</b> в поле выше.</li>
                </ol>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-accent-lime uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Code className="h-3.5 w-3.5" />
                    Код Google Apps Script
                  </h4>
                  <button
                    onClick={copyScriptToClipboard}
                    className="bg-input-dark hover:bg-accent-lime hover:text-black border border-border-dark text-[10px] font-black uppercase tracking-widest py-1 px-2.5 rounded cursor-pointer transition-colors"
                  >
                    {copiedScript ? 'Скопировано!' : 'Копировать код'}
                  </button>
                </div>
                <pre className="w-full h-48 bg-black/60 rounded-lg p-3 overflow-y-auto border border-border-dark/50 text-[10px] text-gray-400 font-mono leading-normal">
                  {appsScriptCode}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sheets Tabs Preview Header */}
      <div className="bg-card-dark text-white rounded-xl p-5 border border-border-dark shadow-md space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border-dark/60 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent-lime/10 rounded-lg border border-accent-lime/20">
              <FileSpreadsheet className="h-5 w-5 text-accent-lime" />
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base leading-none uppercase tracking-wider">
                Текущие таблицы базы данных
              </h2>
              <p className="text-[10px] text-gray-400 mt-1">
                Просматривайте структуру и данные ваших таблиц. Вы можете скачать любую таблицу в формате CSV.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleDownloadCSV(activeSheet)}
              className="inline-flex items-center gap-1.5 bg-input-dark hover:bg-accent-lime hover:text-black text-[11px] sm:text-xs font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-lg border border-border-dark hover:border-accent-lime/40 transition-colors cursor-pointer font-sans"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Скачать CSV</span>
            </button>
            <button
              onClick={handleCopyCSVToClipboard}
              className="inline-flex items-center gap-1.5 bg-input-dark hover:bg-accent-lime hover:text-black text-[11px] sm:text-xs font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-lg border border-border-dark hover:border-accent-lime/40 transition-colors cursor-pointer font-sans"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-black stroke-[3px]" /> : <Clipboard className="h-3.5 w-3.5" />}
              <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>
        </div>

        {/* Tab selector buttons */}
        <div className="flex flex-wrap gap-2">
          {Object.keys(sheetsConfig).map(key => {
            const isActive = activeSheet === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSheet(key as any)}
                className={`text-[10.5px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-accent-lime text-black border-accent-lime shadow-md'
                    : 'bg-input-dark hover:bg-white/5 border-border-dark text-gray-400 hover:text-white'
                }`}
              >
                📊 {sheetsConfig[key as keyof typeof sheetsConfig].title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sheet Grid Table Layout */}
      <div className="bg-card-dark rounded-xl border border-border-dark shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              {/* Alphabetical headers */}
              <tr className="bg-black/50 border-b border-border-dark">
                <th className="px-3 py-1 bg-black/40 text-center text-[9px] text-gray-600 font-bold border-r border-border-dark w-10"></th>
                {activeSheetConfig.columns.map((col, idx) => (
                  <th key={col} className="px-3 py-1 text-center font-bold text-gray-500 border-r border-border-dark">
                    {String.fromCharCode(65 + idx)}
                  </th>
                ))}
              </tr>
              {/* Row Header Labels */}
              <tr className="bg-black/25 border-b border-border-dark text-[11px] font-semibold text-gray-400">
                <th className="px-3 py-2 bg-black/35 text-center border-r border-border-dark text-gray-600">#</th>
                {activeSheetConfig.columns.map(col => (
                  <th key={col} className="px-3 py-2.5 font-bold uppercase tracking-wider text-accent-lime/90 border-r border-border-dark">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark/60 bg-black/10">
              {activeSheetConfig.data.length === 0 ? (
                <tr>
                  <td colSpan={activeSheetConfig.columns.length + 1} className="p-8 text-center text-gray-500 italic">
                    Таблица пуста (нет записей)
                  </td>
                </tr>
              ) : (
                activeSheetConfig.data.map((row: any, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/5 text-[11.5px] text-gray-300 transition-colors">
                    <td className="px-3 py-2 bg-black/30 border-r border-border-dark text-center text-[10px] text-gray-600 font-bold select-none">
                      {rIdx + 1}
                    </td>
                    {activeSheetConfig.columns.map(col => {
                      const val = row[col];
                      const isNumeric = typeof val === 'number';
                      return (
                        <td
                          key={col}
                          className={`px-3 py-2 border-r border-border-dark ${
                            isNumeric ? 'text-right font-black text-accent-lime font-mono' : 'text-left font-semibold text-gray-300'
                          }`}
                        >
                          {val === undefined || val === null ? '' : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
