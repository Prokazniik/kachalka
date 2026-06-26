/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  loadInitialData, 
  saveAllData,
  SEED_ATHLETES,
  SEED_EXERCISES,
  SEED_WORKOUTS,
  SEED_LOGS,
  SEED_CLOSED
} from './services/dbService';
import { Athlete, Exercise, Workout, LogEntry, ClosedExercise } from './types';
import WorkoutTracker from './components/WorkoutTracker';
import TemplateEditor from './components/TemplateEditor';
import StatsViewer from './components/StatsViewer';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dumbbell, 
  TrendingUp, 
  BookOpen, 
  Users, 
  Calendar, 
  Activity, 
  Settings, 
  Copy, 
  Check, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  ExternalLink 
} from 'lucide-react';
import {
  getActiveSpreadsheetId,
  getAppsScriptUrl,
  setActiveSpreadsheetId,
  setAppsScriptUrl,
  appendLogEntries,
  overwriteLogs,
  overwriteExercises,
  overwriteWorkouts,
  overwriteClosed,
  setupSpreadsheetAndSeed,
  loadDataFromSpreadsheet,
} from './services/googleSheetsService';

const APPS_SCRIPT_CODE_TEMPLATE = `// Вставьте этот код в ваш Google Apps Script (Расширения -> Apps Script)
// Ссылка на таблицу: https://docs.google.com/spreadsheets/d/1XbAN6Chyb5cAEbehf5pNcGmg4Fd_UG1vBGgTG5Xmha8/edit
const SPREADSHEET_ID = "1XbAN6Chyb5cAEbehf5pNcGmg4Fd_UG1vBGgTG5Xmha8";

function doGet(e) {
  return handleLoad(e);
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    if (action === "load") {
      return handleLoad(postData);
    }
    
    const ss = getSS(postData);
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
    } else if (action === "overwriteLogs") {
      writeToSheet(ss.getSheetByName("Logs"), [
        ['id', 'date', 'workoutId', 'exerciseId', 'athleteId', 'weight', 'reps', 'sets'],
        ...postData.logs.map(log => [log.id, log.date, log.workoutId, log.exerciseId, log.athleteId, log.weight, log.reps, log.sets])
      ]);
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

function handleLoad(params) {
  try {
    const ss = getSS(params);
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

function getSS(params) {
  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}
  
  if (!ss) {
    let id = SPREADSHEET_ID;
    if (params && params.spreadsheetId) {
      id = params.spreadsheetId;
    }
    ss = SpreadsheetApp.openById(id);
  }
  return ss;
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
  try {
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row || row.every(cell => cell === "")) continue;
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
  } catch (e) {
    return [];
  }
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

export default function App() {
  const [data, setData] = useState<{
    athletes: Athlete[];
    exercises: Exercise[];
    workouts: Workout[];
    logs: LogEntry[];
    closed: ClosedExercise[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'workout' | 'templates' | 'stats'>('workout');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'success' | 'failed' | 'offline'>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSpreadsheetId, setTempSpreadsheetId] = useState(getActiveSpreadsheetId());
  const [tempAppsScriptUrl, setTempAppsScriptUrl] = useState(getAppsScriptUrl() || '');
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeInstructionStep, setActiveInstructionStep] = useState(0);

  // Initialize and load from Google Sheets
  const handleConnect = async () => {
    setConnectionStatus('connecting');
    setConnectionError(null);
    const sheetId = getActiveSpreadsheetId();
    
    try {
      // 1. Fetch from sheet
      const response = await loadDataFromSpreadsheet(sheetId);
      
      // 2. If data is empty (completely uninitialized sheet), seed it automatically
      if (response.exercises.length === 0 && response.workouts.length === 0) {
        console.log('Google Sheet is empty. Automatically initializing structure and seeding default training templates...');
        await setupSpreadsheetAndSeed(
          sheetId,
          SEED_EXERCISES,
          SEED_WORKOUTS,
          SEED_LOGS,
          SEED_CLOSED
        );
        
        // Reload after seeding
        const seededResponse = await loadDataFromSpreadsheet(sheetId);
        setData({
          athletes: SEED_ATHLETES,
          exercises: seededResponse.exercises.length > 0 ? seededResponse.exercises : SEED_EXERCISES,
          workouts: seededResponse.workouts.length > 0 ? seededResponse.workouts : SEED_WORKOUTS,
          logs: seededResponse.logs.length > 0 ? seededResponse.logs : SEED_LOGS,
          closed: seededResponse.closed.length > 0 ? seededResponse.closed : SEED_CLOSED,
        });
      } else {
        // Successful load
        setData({
          athletes: SEED_ATHLETES,
          exercises: response.exercises,
          workouts: response.workouts,
          logs: response.logs,
          closed: response.closed,
        });
      }
      setConnectionStatus('success');
    } catch (err: any) {
      console.error('Initialization Google Sheets load error:', err);
      setConnectionError(err.message || 'Ошибка подключения к Google Sheets.');
      setConnectionStatus('failed');
    }
  };

  useEffect(() => {
    handleConnect();
  }, []);

  const handleContinueOffline = () => {
    const loaded = loadInitialData();
    setData(loaded);
    setConnectionStatus('offline');
  };

  // Sync state helper to write back to Google Sheets in the background when active
  const syncToSheets = async (updatedState: NonNullable<typeof data>) => {
    if (connectionStatus === 'offline') return; // Bypass sync if we are in offline mode
    const sheetId = getActiveSpreadsheetId();
    const appsScriptUrl = getAppsScriptUrl();
    if (sheetId && appsScriptUrl) {
      try {
        await setupSpreadsheetAndSeed(
          sheetId,
          updatedState.exercises,
          updatedState.workouts,
          updatedState.logs,
          updatedState.closed
        );
      } catch (err) {
        console.warn('Background Google Sheets sync failed:', err);
      }
    }
  };

  // Copy code utility
  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleSaveSettings = () => {
    setActiveSpreadsheetId(tempSpreadsheetId);
    setAppsScriptUrl(tempAppsScriptUrl);
    setShowSettingsModal(false);
    handleConnect();
  };

  if (connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center font-sans text-white p-6">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-accent-lime/20 blur-xl rounded-full animate-pulse"></div>
            <div className="relative w-20 h-20 rounded-2xl bg-accent-lime flex items-center justify-center shadow-2xl shadow-accent-lime/30 animate-bounce">
              <Dumbbell className="h-10 w-10 text-black animate-spin" style={{ animationDuration: '3s' }} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black italic text-accent-lime tracking-tight">КАЧАЛКА</h1>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Coach Pro v1.0</span>
          </div>
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-200">
              <RefreshCw className="h-4 w-4 text-accent-lime animate-spin" />
              <span>Синхронизация с базой данных...</span>
            </div>
            <p className="text-xs text-gray-500 max-w-sm">
              Подключаемся к Google Таблице и загружаем актуальные результаты тренировок Ромы и Пети.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (connectionStatus === 'failed') {
    return (
      <div className="min-h-screen bg-bg-dark text-[#E0E0E0] font-sans flex flex-col p-4 sm:p-8 selection:bg-accent-lime selection:text-black">
        <div className="max-w-4xl mx-auto w-full space-y-6 my-auto py-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 justify-center sm:justify-start">
            <div className="w-10 h-10 rounded-xl bg-accent-lime flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-black" />
            </div>
            <div>
              <h1 className="font-black italic text-lg sm:text-xl tracking-tighter text-accent-lime leading-none">КАЧАЛКА</h1>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-mono">Coach Pro v1.0</span>
            </div>
          </div>

          {/* Main Error Box */}
          <div className="bg-card-dark border border-red-500/30 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
            
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0 mx-auto sm:mx-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-4 text-center sm:text-left flex-1">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white uppercase">Проблема подключения к Google Таблице</h2>
                  <p className="text-xs text-gray-400 mt-1">Обычно это происходит при первом запуске, если ваш Google Apps Script не развернут или не авторизован.</p>
                </div>

                <div className="bg-black/40 border border-border-dark p-3.5 rounded-xl font-mono text-xs text-red-400 whitespace-pre-wrap leading-relaxed text-left">
                  {connectionError}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <button
                    onClick={handleConnect}
                    className="flex items-center justify-center gap-2 bg-accent-lime text-black font-extrabold text-sm py-3 px-6 rounded-xl hover:bg-opacity-90 transition-all uppercase tracking-wider cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4 animate-spin" style={{ animationDuration: '3s' }} />
                    Попробовать снова
                  </button>
                  <button
                    onClick={handleContinueOffline}
                    className="flex items-center justify-center gap-2 bg-card-dark border border-border-dark text-gray-300 font-extrabold text-sm py-3 px-6 rounded-xl hover:text-white hover:bg-[#202020] transition-all uppercase tracking-wider cursor-pointer"
                  >
                    <WifiOff className="h-4 w-4" />
                    Работать офлайн (локально)
                  </button>
                  <button
                    onClick={() => {
                      setTempSpreadsheetId(getActiveSpreadsheetId());
                      setTempAppsScriptUrl(getAppsScriptUrl() || '');
                      setShowSettingsModal(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-[#202020]/50 border border-border-dark text-gray-400 font-bold text-sm py-3 px-5 rounded-xl hover:text-white transition-all cursor-pointer"
                  >
                    <Settings className="h-4 w-4" />
                    Изменить ссылки
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible/Tabbed Instructions */}
          <div className="bg-card-dark border border-border-dark rounded-2xl p-6 space-y-5 shadow-xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent-lime"></span>
              Инструкция по настройке и исправлению скрипта
            </h3>

            {/* Steps Nav */}
            <div className="grid grid-cols-4 gap-1.5 border-b border-border-dark pb-3">
              {[
                '1. Сделать таблицу публичной',
                '2. Открыть редактор кода',
                '3. Вставить код',
                '4. Развернуть Веб-приложение'
              ].map((stepTitle, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveInstructionStep(idx)}
                  className={`py-2 px-1.5 text-[11px] font-bold uppercase tracking-wider text-center border-b-2 transition-all ${
                    activeInstructionStep === idx
                      ? 'border-accent-lime text-accent-lime font-black'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {stepTitle.split('. ')[0]}. {stepTitle.split('. ')[1].slice(0, 16)}...
                </button>
              ))}
            </div>

            {/* Active Step Content */}
            <div className="text-xs text-gray-300 space-y-4">
              {activeInstructionStep === 0 && (
                <div className="space-y-3 leading-relaxed">
                  <p>
                    Для быстрой и надежной работы приложение считывает архив тренировок напрямую. Для этого таблица должна быть доступна для чтения всем, у кого есть ссылка.
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-gray-400">
                    <li>Откройте вашу таблицу: <a href="https://docs.google.com/spreadsheets/d/1XbAN6Chyb5cAEbehf5pNcGmg4Fd_UG1vBGgTG5Xmha8/edit" target="_blank" rel="noreferrer" className="text-accent-lime hover:underline font-bold inline-flex items-center gap-0.5">Открыть Таблицу <ExternalLink className="h-3 w-3" /></a></li>
                    <li>В правом верхнем углу нажмите кнопку <strong className="text-white">Настройки доступа (Share)</strong>.</li>
                    <li>В секции общего доступа измените <strong className="text-white">«Ограниченный доступ» (Restricted)</strong> на <strong className="text-white">«Все, у кого есть ссылка» (Anyone with the link)</strong>.</li>
                    <li>Убедитесь, что роль справа установлена как <strong className="text-white">«Читатель» (Viewer)</strong>.</li>
                    <li>Нажмите <strong className="text-white">Готово (Done)</strong>.</li>
                  </ol>
                </div>
              )}

              {activeInstructionStep === 1 && (
                <div className="space-y-3 leading-relaxed">
                  <p>
                    Вам нужно прикрепить специальный скрипт к вашей таблице, чтобы приложение могло записывать новые тренировки в реальном времени.
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-gray-400">
                    <li>В вашей таблице перейдите в меню: <strong className="text-white">Расширения (Extensions) &rarr; Apps Script</strong>.</li>
                    <li>Откроется редактор кода Google Apps Script. В левой колонке вы увидите файл <code className="text-gray-300">Код.gs</code> (или Code.gs).</li>
                    <li>Выделите весь существующий код в окне редактора и <strong className="text-red-400">удалите его полностью</strong>.</li>
                  </ol>
                </div>
              )}

              {activeInstructionStep === 2 && (
                <div className="space-y-3">
                  <p className="leading-relaxed">
                    Скопируйте исправленный нами код, поддерживающий автономную работу, запуск в качестве независимого приложения, и автоматическое создание листов (Logs, Exercises, Workouts, Closed) при первом обращении.
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-[#151515] px-4 py-2 rounded-t-xl border-t border-x border-border-dark">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">Код для Код.gs</span>
                      <button
                        onClick={handleCopyScriptCode}
                        className="flex items-center gap-1 bg-accent-lime hover:bg-opacity-90 text-black text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors"
                      >
                        {copiedScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedScript ? 'Скопировано!' : 'Копировать'}
                      </button>
                    </div>
                    <pre className="bg-black/60 border border-border-dark p-4 rounded-b-xl text-left text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-60 leading-relaxed scrollbar-thin">
                      {APPS_SCRIPT_CODE_TEMPLATE}
                    </pre>
                  </div>
                </div>
              )}

              {activeInstructionStep === 3 && (
                <div className="space-y-3 leading-relaxed">
                  <p>
                    Правильное развертывание скрипта — это самый важный шаг. Следуйте строго этой инструкции:
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-gray-400">
                    <li>В верхнем меню редактора нажмите на иконку <strong className="text-white">Сохранить проект</strong> (дискета).</li>
                    <li>Нажмите на синюю кнопку <strong className="text-white">Начать развертывание (Deploy) &rarr; Новое развертывание (New deployment)</strong>.</li>
                    <li>В левом верхнем углу открывшегося окна нажмите на шестеренку <strong className="text-white">«Выберите тип» (Select type)</strong> и выберите <strong className="text-white">«Веб-приложение» (Web app)</strong>.</li>
                    <li>Установите настройки в точности так:
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-300">
                        <li>Описание: <code className="text-accent-lime">Качалка БД v1</code></li>
                        <li>Запуск от имени (Execute as): <strong className="text-white">Я (ваша почта)</strong></li>
                        <li>У кого есть доступ (Who has access): <strong className="text-white">Все (Anyone)</strong> (это крайне важно для CORS!)</li>
                      </ul>
                    </li>
                    <li>Нажмите синюю кнопку <strong className="text-white">Развернуть (Deploy)</strong>.</li>
                    <li>Появится запрос авторизации. Нажмите <strong className="text-white">Предоставить доступ (Authorize Access)</strong>, выберите вашу учетную запись Google.</li>
                    <li>Появится предупреждение безопасности. Нажмите снизу слева <strong className="text-gray-400 underline">«Дополнительные настройки» (Advanced)</strong>, а затем внизу ссылку <strong className="text-red-400">«Перейти к проекту Untitled (небезопасно)»</strong>.</li>
                    <li>Нажмите кнопку <strong className="text-white">Разрешить (Allow)</strong>.</li>
                    <li>Скопируйте полученный <strong className="text-accent-lime">URL веб-приложения (Web App URL)</strong> и вставьте его в настройки нашего приложения, нажав на кнопку «Изменить ссылки» выше.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle saving workout log entries
  const handleSaveLogs = (newLogs: LogEntry[]) => {
    setData(prev => {
      if (!prev) return prev;
      
      const freshLogs = prev.logs.filter(oldLog => {
        const matchesNew = newLogs.some(
          newLog => 
            newLog.date === oldLog.date && 
            newLog.athleteId === oldLog.athleteId && 
            newLog.exerciseId === oldLog.exerciseId && 
            newLog.workoutId === oldLog.workoutId
        );
        return !matchesNew;
      });

      const updated = {
        ...prev,
        logs: [...freshLogs, ...newLogs],
      };
      
      saveAllData(updated);
      
      // Background Sync using setupAndSeed to keep Google Sheets state in perfect sync and prevent duplicates
      syncToSheets(updated);

      return updated;
    });
  };

  // Handle deleting all log entries for a specific workout on a specific date
  const handleDeleteWorkoutLogs = (date: string, workoutId: string) => {
    setData(prev => {
      if (!prev) return prev;

      const updatedLogs = prev.logs.filter(
        log => !(log.date === date && log.workoutId === workoutId)
      );

      const updated = {
        ...prev,
        logs: updatedLogs,
      };

      saveAllData(updated);

      // Background Sync - overwrite the entire logs sheet with the updated records
      syncToSheets(updated);

      return updated;
    });
  };

  // Toggle closed status for an athlete's exercise
  const handleToggleCloseExercise = (athleteId: string, exerciseId: string) => {
    setData(prev => {
      if (!prev) return prev;
      
      const isAlreadyClosed = prev.closed.some(
        c => c.athleteId === athleteId && c.exerciseId === exerciseId
      );

      let updatedClosedList: ClosedExercise[];
      if (isAlreadyClosed) {
        updatedClosedList = prev.closed.filter(
          c => !(c.athleteId === athleteId && c.exerciseId === exerciseId)
        );
      } else {
        updatedClosedList = [
          ...prev.closed,
          {
            athleteId,
            exerciseId,
            closedAt: new Date().toISOString().split('T')[0],
          }
        ];
      }

      const updated = {
        ...prev,
        closed: updatedClosedList,
      };

      saveAllData(updated);

      // Background Sync
      syncToSheets(updated);

      return updated;
    });
  };

  // Add exercise directly to exercise каталог and optionally link to active workout template
  const handleAddExerciseToWorkout = (workoutId: string, exerciseName: string, defaultWeight: number, defaultReps: number, defaultSets: number) => {
    setData(prev => {
      if (!prev) return prev;

      const existingEx = prev.exercises.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase());
      let finalExId = existingEx?.id;
      let updatedExercises = [...prev.exercises];

      if (!existingEx) {
        finalExId = `ex_${Date.now()}`;
        const newEx: Exercise = {
          id: finalExId,
          name: exerciseName,
          defaultWeight,
          defaultReps,
          defaultSets,
          unit: 'кг',
        };
        updatedExercises.push(newEx);
      }

      const updatedWorkouts = prev.workouts.map(w => {
        if (w.id === workoutId && finalExId) {
          if (!w.exerciseIds.includes(finalExId)) {
            return {
              ...w,
              exerciseIds: [...w.exerciseIds, finalExId],
            };
          }
        }
        return w;
      });

      const updated = {
        ...prev,
        exercises: updatedExercises,
        workouts: updatedWorkouts,
      };

      saveAllData(updated);

      // Background Sync
      syncToSheets(updated);

      return updated;
    });
  };

  // Create new Workout Template
  const handleAddWorkout = (name: string, exerciseIds: string[]) => {
    setData(prev => {
      if (!prev) return prev;
      
      const newWorkout: Workout = {
        id: `workout_${Date.now()}`,
        name,
        exerciseIds,
      };

      const updatedWorkouts = [...prev.workouts, newWorkout];
      const updated = {
        ...prev,
        workouts: updatedWorkouts,
      };

      saveAllData(updated);

      // Background Sync
      syncToSheets(updated);

      return updated;
    });
  };

  // Add simple catalog exercise definition
  const handleAddExerciseToCatalog = (name: string, defaultWeight: number, defaultReps: number, defaultSets: number) => {
    setData(prev => {
      if (!prev) return prev;

      const newEx: Exercise = {
        id: `ex_${Date.now()}`,
        name,
        defaultWeight,
        defaultReps,
        defaultSets,
        unit: 'кг',
      };

      const updatedExercises = [...prev.exercises, newEx];
      const updated = {
        ...prev,
        exercises: updatedExercises,
      };

      saveAllData(updated);

      // Background Sync
      syncToSheets(updated);

      return updated;
    });
  };

  // Modify exercise composition of a workout template
  const handleUpdateWorkoutExercises = (workoutId: string, exerciseIds: string[]) => {
    setData(prev => {
      if (!prev) return prev;

      const updatedWorkouts = prev.workouts.map(w => {
        if (w.id === workoutId) {
          return {
            ...w,
            exerciseIds,
          };
        }
        return w;
      });

      const updated = {
        ...prev,
        workouts: updatedWorkouts,
      };

      saveAllData(updated);

      // Background Sync
      syncToSheets(updated);

      return updated;
    });
  };

  const totalSetsLogged = data?.logs.reduce((sum, log) => sum + log.sets, 0) || 0;
  const uniqueWorkoutDays = new Set(data?.logs.map(log => log.date) || []).size;

  return (
    <div className="min-h-screen bg-bg-dark text-[#E0E0E0] font-sans flex flex-col selection:bg-accent-lime selection:text-black">
      {/* Top Navigation Coach Bar */}
      <header className="bg-black border-b border-border-dark sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-accent-lime flex items-center justify-center shadow-lg shadow-accent-lime/15">
                <Dumbbell className="h-5 w-5 text-black" />
              </div>
              <div>
                <h1 className="font-black italic text-lg sm:text-xl tracking-tighter text-accent-lime leading-none">КАЧАЛКА</h1>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-mono">Coach Pro v1.0</span>
              </div>
            </div>

            {/* Micro Metrics Dashboard Banner */}
            <div className="hidden md:flex items-center gap-6 text-xs text-gray-400 border-l border-border-dark pl-6">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-accent-lime/80" />
                <span>Спортсмены: <strong className="text-white font-bold font-mono">Петя, Рома</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#818cf8]" />
                <span>Дней занятий: <strong className="text-white font-bold font-mono">{uniqueWorkoutDays}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-amber-400" />
                <span>Всего подходов: <strong className="text-white font-bold font-mono">{totalSetsLogged}</strong></span>
              </div>
            </div>

            {/* Connection Status & Settings Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTempSpreadsheetId(getActiveSpreadsheetId());
                  setTempAppsScriptUrl(getAppsScriptUrl() || '');
                  setShowSettingsModal(true);
                }}
                className="p-1.5 rounded-lg bg-card-dark hover:bg-[#202020] border border-border-dark transition-colors group cursor-pointer"
                title="Настройки подключения"
              >
                <Settings className="h-4 w-4 text-gray-400 group-hover:text-accent-lime transition-colors" />
              </button>
              
              <button
                onClick={handleConnect}
                className={`inline-flex items-center gap-1.5 bg-card-dark text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-border-dark transition-all cursor-pointer ${
                  connectionStatus === 'success' 
                    ? 'text-[#C1FF72] hover:text-white' 
                    : connectionStatus === 'offline'
                    ? 'text-amber-400 hover:text-white'
                    : 'text-red-400 hover:text-white'
                }`}
                title={connectionStatus === 'success' ? 'Синхронизировано. Нажмите, чтобы обновить данные.' : 'Режим офлайн. Нажмите для подключения.'}
              >
                {connectionStatus === 'success' ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-accent-lime animate-pulse" />
                    <span className="hidden sm:inline">Sheets БД</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Офлайн</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-border-dark bg-black/40">
          <nav className="flex space-x-1 py-2 overflow-x-auto scrollbar-none" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('workout')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all uppercase tracking-wider ${
                activeTab === 'workout'
                  ? 'bg-accent-lime text-black shadow-md shadow-accent-lime/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Dumbbell className="h-4 w-4" />
              <span>⚡ Тренировка</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all uppercase tracking-wider ${
                activeTab === 'templates'
                  ? 'bg-accent-lime text-black shadow-md shadow-accent-lime/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>📋 Шаблоны</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all uppercase tracking-wider ${
                activeTab === 'stats'
                  ? 'bg-accent-lime text-black shadow-md shadow-accent-lime/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>📈 Статистика</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Workspace Body with Transitions */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <AnimatePresence mode="wait">
          {data && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'workout' && (
                <WorkoutTracker
                  athletes={data.athletes}
                  exercises={data.exercises}
                  workouts={data.workouts}
                  logs={data.logs}
                  closed={data.closed}
                  onSaveLogs={handleSaveLogs}
                  onDeleteWorkoutLogs={handleDeleteWorkoutLogs}
                  onToggleCloseExercise={handleToggleCloseExercise}
                  onAddExerciseToWorkout={handleAddExerciseToWorkout}
                />
              )}

              {activeTab === 'templates' && (
                <TemplateEditor
                  exercises={data.exercises}
                  workouts={data.workouts}
                  onAddWorkout={handleAddWorkout}
                  onAddExercise={handleAddExerciseToCatalog}
                  onUpdateWorkoutExercises={handleUpdateWorkoutExercises}
                />
              )}

              {activeTab === 'stats' && (
                <StatsViewer
                  athletes={data.athletes}
                  exercises={data.exercises}
                  logs={data.logs}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-card-dark border border-border-dark rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center pb-2 border-b border-border-dark">
              <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Settings className="h-5 w-5 text-accent-lime" />
                Настройки подключения
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">ID Google Таблицы</label>
                <input
                  type="text"
                  value={tempSpreadsheetId}
                  onChange={(e) => setTempSpreadsheetId(e.target.value)}
                  placeholder="Например: 1XbAN6Chyb5cAEbehf5pNcGmg4Fd_UG1vBGgTG5Xmha8"
                  className="w-full bg-black border border-border-dark rounded-xl px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-accent-lime"
                />
                <span className="text-[10px] text-gray-500 leading-normal block">
                  Буквенно-цифровой код из адресной строки вашей таблицы.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">URL Google Apps Script Web App</label>
                <input
                  type="text"
                  value={tempAppsScriptUrl}
                  onChange={(e) => setTempAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-black border border-border-dark rounded-xl px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-accent-lime"
                />
                <span className="text-[10px] text-gray-500 leading-normal block">
                  Веб-ссылка, сгенерированная при развертывании в Apps Script.
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                onClick={handleSaveSettings}
                className="flex-1 bg-accent-lime hover:bg-opacity-90 text-black font-extrabold text-sm py-2.5 rounded-xl transition-all uppercase tracking-wider cursor-pointer"
              >
                Сохранить и подключиться
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="bg-[#202020] text-gray-300 hover:text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Humble Footer */}
      <footer className="bg-black/40 border-t border-border-dark py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-500 font-mono space-y-1">
          <div>КАЧАЛКА Coach Pro MVP — Прогресс-Логгер для Пети и Ромы. Синхронизировано в реальном времени.</div>
          <div className="text-[10px] text-gray-600">Spreadsheet ID: <span className="font-mono">{getActiveSpreadsheetId()}</span></div>
        </div>
      </footer>
    </div>
  );
}
