/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Athlete, Exercise, LogEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Award, 
  Calendar, 
  Dumbbell, 
  Zap, 
  Users, 
  User, 
  Info, 
  Sparkles, 
  Activity 
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface StatsViewerProps {
  athletes: Athlete[];
  exercises: Exercise[];
  logs: LogEntry[];
}

export default function StatsViewer({ athletes, exercises, logs }: StatsViewerProps) {
  const [selectedAthleteId, setSelectedAthleteId] = useState<'all' | 'petya' | 'roma'>('all');

  // 1. Group logs by date to compute the workout activity map
  const logsCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      if (selectedAthleteId !== 'all' && log.athleteId !== selectedAthleteId) return;
      counts[log.date] = (counts[log.date] || 0) + 1;
    });
    return counts;
  }, [logs, selectedAthleteId]);

  // 2. Generate past 12 months' days (approx 371 days = 53 weeks * 7 days) ending on Sunday of current week
  const { weeks, monthLabels, totalContributionsLastYear } = useMemo(() => {
    const runtimeToday = new Date();
    
    // Find upcoming Sunday to align the calendar nicely
    const endDate = new Date(runtimeToday);
    const currentDay = runtimeToday.getDay(); // 0 is Sunday, 1 is Monday...
    const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay;
    endDate.setDate(runtimeToday.getDate() + daysToSunday);
    
    // 370 days back from Sunday gives us a Monday start
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 370);
    
    const daysList: { dateStr: string; count: number; dateObj: Date; isFuture: boolean }[] = [];
    const tempDate = new Date(startDate);
    
    while (tempDate <= endDate) {
      const y = tempDate.getFullYear();
      const m = String(tempDate.getMonth() + 1).padStart(2, '0');
      const d = String(tempDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const isFuture = tempDate > runtimeToday;
      
      daysList.push({
        dateStr,
        count: isFuture ? 0 : (logsCountByDate[dateStr] || 0),
        dateObj: new Date(tempDate),
        isFuture
      });
      
      tempDate.setDate(tempDate.getDate() + 1);
    }
    
    // Group into columns of weeks (7 days each, Mon -> Sun)
    const weeksList: typeof daysList[] = [];
    for (let i = 0; i < daysList.length; i += 7) {
      weeksList.push(daysList.slice(i, i + 7));
    }
    
    // Build month labels aligned to week columns
    const labels: { index: number; label: string }[] = [];
    let lastMonth = -1;
    weeksList.forEach((week, wIdx) => {
      const firstDay = week[0];
      if (firstDay) {
        const month = firstDay.dateObj.getMonth();
        if (month !== lastMonth) {
          const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
          labels.push({ index: wIdx, label: monthNames[month] });
          lastMonth = month;
        }
      }
    });
    
    const total = daysList.reduce((sum, d) => sum + d.count, 0);
    
    return {
      weeks: weeksList,
      monthLabels: labels,
      totalContributionsLastYear: total
    };
  }, [logsCountByDate]);

  // Calculate unique workout/training sessions for this month and past year
  const trainingStats = useMemo(() => {
    const runtimeToday = new Date();
    const currentYear = runtimeToday.getFullYear();
    const currentMonthStr = String(runtimeToday.getMonth() + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonthStr}`;

    const trainingDates = Object.keys(logsCountByDate).filter(dateStr => logsCountByDate[dateStr] > 0);

    const workoutsThisMonth = trainingDates.filter(dateStr => dateStr.startsWith(currentMonthPrefix)).length;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const workoutsPastYear = trainingDates.filter(dateStr => {
      const d = new Date(dateStr);
      return d >= oneYearAgo && d <= runtimeToday;
    }).length;

    return {
      workoutsThisMonth,
      workoutsPastYear
    };
  }, [logsCountByDate]);

  const getWorkoutsEnding = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) {
      return 'тренировка';
    }
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
      return 'тренировки';
    }
    return 'тренировок';
  };

  // Russian ending pluralization helper for exercises count
  const getExercisesEnding = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) {
      return 'упражнение';
    }
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
      return 'упражнения';
    }
    return 'упражнений';
  };

  // Determine the CSS background color of a cell based on contribution intensity
  const getCellBgColor = (count: number) => {
    if (count === 0) return 'bg-white/[0.04] border border-white/[0.02]';
    if (count <= 2) return 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/30';
    if (count <= 5) return 'bg-emerald-800/60 text-emerald-200 border border-emerald-700/35';
    if (count <= 9) return 'bg-emerald-500/85 text-black font-semibold border border-emerald-400/40';
    return 'bg-accent-lime text-black font-black border border-accent-lime/40';
  };

  // Compute stats for individual athletes
  const getAthleteKPIs = (athleteId: string) => {
    const athleteLogs = logs.filter(l => l.athleteId === athleteId);
    const totalSessions = Array.from(new Set(athleteLogs.map(l => l.date))).length;
    const totalSets = athleteLogs.reduce((sum, l) => sum + l.sets, 0);
    const totalTonnage = athleteLogs.reduce((sum, l) => sum + (l.weight * l.reps * l.sets), 0);
    const maxWeight = athleteLogs.length > 0 ? Math.max(...athleteLogs.map(l => l.weight)) : 0;
    
    // Find favorite exercise
    const exerciseCounts: Record<string, number> = {};
    athleteLogs.forEach(l => {
      exerciseCounts[l.exerciseId] = (exerciseCounts[l.exerciseId] || 0) + 1;
    });
    let favoriteExerciseName = '—';
    let maxCount = 0;
    Object.keys(exerciseCounts).forEach(exId => {
      if (exerciseCounts[exId] > maxCount) {
        maxCount = exerciseCounts[exId];
        favoriteExerciseName = exercises.find(ex => ex.id === exId)?.name || '—';
      }
    });

    return {
      totalSessions,
      totalSets,
      totalTonnage,
      maxWeight,
      favoriteExerciseName,
      hasLogs: athleteLogs.length > 0
    };
  };

  const petyaKPIs = useMemo(() => getAthleteKPIs('petya'), [logs, exercises]);
  const romaKPIs = useMemo(() => getAthleteKPIs('roma'), [logs, exercises]);

  // Current single athlete selected KPIs
  const isPetya = selectedAthleteId === 'petya';
  const currentAthleteKPIs = isPetya ? petyaKPIs : romaKPIs;

  // Single athlete strength records ledger
  const personalRecords = useMemo(() => {
    if (selectedAthleteId === 'all') return [];
    
    return exercises.map(ex => {
      const exLogs = logs.filter(l => l.exerciseId === ex.id && l.athleteId === selectedAthleteId);
      if (exLogs.length === 0) {
        return {
          exerciseName: ex.name,
          maxWeight: null,
          latestWeight: null,
          latestReps: null,
          latestSets: null,
          latestDate: null,
        };
      }
      
      const maxWeight = Math.max(...exLogs.map(l => l.weight));
      const sortedLogs = [...exLogs].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sortedLogs[0];
      
      return {
        exerciseName: ex.name,
        maxWeight,
        latestWeight: latest.weight,
        latestReps: latest.reps,
        latestSets: latest.sets,
        latestDate: latest.date,
      };
    });
  }, [exercises, logs, selectedAthleteId]);

  // Count active exercises for the current filters to decide if we show empty page warning
  const activeExercisesCount = useMemo(() => {
    return exercises.filter(ex => 
      logs.some(l => l.exerciseId === ex.id && (selectedAthleteId === 'all' || l.athleteId === selectedAthleteId))
    ).length;
  }, [exercises, logs, selectedAthleteId]);

  return (
    <div className="space-y-6">
      {/* 1. Header with Athlete Selection Tabs */}
      <div className="bg-card-dark p-4 sm:p-5 rounded-xl border border-border-dark shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-extrabold text-white text-base leading-none uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent-lime" />
            Информационная панель спортсменов
          </h2>
          <p className="text-[11px] text-gray-400 mt-1">
            Анализ динамики весов, рекордов и общей тренировочной активности
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-input-dark border border-border-dark p-1 rounded-xl w-full md:w-auto self-stretch md:self-auto">
          <button
            onClick={() => setSelectedAthleteId('all')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              selectedAthleteId === 'all'
                ? 'bg-accent-lime text-black font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Все спортсмены</span>
          </button>
          <button
            onClick={() => setSelectedAthleteId('petya')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              selectedAthleteId === 'petya'
                ? 'bg-indigo-500 text-white font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Петя</span>
          </button>
          <button
            onClick={() => setSelectedAthleteId('roma')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              selectedAthleteId === 'roma'
                ? 'bg-orange-500 text-white font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Рома</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedAthleteId}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* 2. GitHub-Style Training Activity Calendar Map */}
          <div className="bg-card-dark p-5 rounded-xl border border-border-dark shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border-dark">
              <div>
                <h3 className="font-extrabold text-white text-sm sm:text-base uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-5 w-5 text-accent-lime" />
                  Карта тренировочной активности
                </h3>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-left sm:text-right font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-accent-lime">
                    {trainingStats.workoutsThisMonth}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {getWorkoutsEnding(trainingStats.workoutsThisMonth)} за этот месяц
                  </span>
                </div>
                <div className="hidden sm:block text-neutral-800 font-black">|</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-accent-lime">
                    {trainingStats.workoutsPastYear}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {getWorkoutsEnding(trainingStats.workoutsPastYear)} за год
                  </span>
                </div>
              </div>
            </div>

            {/* Heatmap Layout with scroll option on mobile */}
            <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
              <div className="min-w-[710px] select-none">
                {/* Month Labels Row */}
                <div className="relative h-4 mb-1 text-[9px] text-gray-500 font-bold">
                  {monthLabels.map((lbl, idx) => (
                    <span
                      key={idx}
                      className="absolute"
                      style={{ left: `${lbl.index * 13 + 28}px` }}
                    >
                      {lbl.label}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  {/* Day Labels Column */}
                  <div className="flex flex-col justify-between text-[9px] text-gray-500 font-bold h-[78px] w-5 pr-1 py-0.5">
                    <span>Пн</span>
                    <span className="opacity-0">Вт</span>
                    <span>Ср</span>
                    <span className="opacity-0">Чт</span>
                    <span>Пт</span>
                    <span className="opacity-0">Сб</span>
                    <span className="opacity-0">Вс</span>
                  </div>

                  {/* Grid of Weeks */}
                  <div className="flex gap-[3px] flex-1">
                    {weeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-[3px] flex-shrink-0">
                        {week.map(day => {
                          const formattedDate = day.dateObj.toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          });
                          const tooltipText = `${formattedDate}: ${day.count} ${getExercisesEnding(day.count)}`;
                          return (
                            <div
                              key={day.dateStr}
                              title={tooltipText}
                              className={`w-2.5 h-2.5 rounded-[1.5px] transition-transform duration-100 hover:scale-125 cursor-pointer hover:border-white/30 ${
                                day.isFuture 
                                  ? 'bg-transparent border border-dashed border-neutral-800/40' 
                                  : getCellBgColor(day.count)
                              }`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Color Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-gray-500 gap-2 border-t border-border-dark/50 pt-3">
              <span>Каждый закрашенный квадратик представляет количество выполненных и сохраненных упражнений за этот день.</span>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span>Меньше</span>
                <div className="w-2.5 h-2.5 rounded-[1.5px] bg-white/[0.04] border border-white/[0.02]" />
                <div className="w-2.5 h-2.5 rounded-[1.5px] bg-emerald-950/40 border border-emerald-900/30" />
                <div className="w-2.5 h-2.5 rounded-[1.5px] bg-emerald-800/60 border border-emerald-700/35" />
                <div className="w-2.5 h-2.5 rounded-[1.5px] bg-emerald-500/85 border border-emerald-400/40" />
                <div className="w-2.5 h-2.5 rounded-[1.5px] bg-accent-lime border border-accent-lime/40" />
                <span>Больше</span>
              </div>
            </div>
          </div>

          {/* 3. Stats & Info Blocks Grid */}
          {selectedAthleteId === 'all' ? (
            /* SIDE-BY-SIDE COMPARE VIEW */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Petya card */}
              <div className="bg-[#0b0f13]/60 p-5 rounded-xl border border-indigo-500/20 shadow-md space-y-4 shadow-[0_0_15px_-3px_rgba(99,102,241,0.03)]">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-500/10">
                  <span className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    ПЕТЯ (ПЕТР)
                  </span>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-500/20">Спортсмен</span>
                </div>
                {petyaKPIs.hasLogs ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">Общий тоннаж</span>
                      <span className="text-lg font-black text-white font-mono">
                        {petyaKPIs.totalTonnage >= 1000 ? `${(petyaKPIs.totalTonnage / 1000).toFixed(1)} т` : `${petyaKPIs.totalTonnage} кг`}
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Вес за все время</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">Тяжелый вес</span>
                      <span className="text-lg font-black text-indigo-300 font-mono">
                        {petyaKPIs.maxWeight} <span className="text-xs text-gray-400">кг</span>
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Рекорд в жиме/приседе</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">Активные сессии</span>
                      <span className="text-lg font-black text-white font-mono">
                        {petyaKPIs.totalSessions} <span className="text-xs text-gray-400">дней</span>
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Тренировочные дни</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">Всего подходов</span>
                      <span className="text-lg font-black text-white font-mono">
                        {petyaKPIs.totalSets} <span className="text-xs text-gray-400">раз</span>
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Сумма всех сетов</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    Петя еще не выполнял упражнения
                  </div>
                )}
              </div>

              {/* Roma card */}
              <div className="bg-[#0b0f13]/60 p-5 rounded-xl border border-orange-500/20 shadow-md space-y-4 shadow-[0_0_15px_-3px_rgba(249,115,22,0.03)]">
                <div className="flex items-center justify-between pb-2 border-b border-orange-500/10">
                  <span className="text-sm font-black text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    РОМА
                  </span>
                  <span className="text-[10px] bg-orange-500/10 text-orange-300 font-bold px-2 py-0.5 rounded border border-orange-500/20">Спортсмен</span>
                </div>
                {romaKPIs.hasLogs ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">Общий тоннаж</span>
                      <span className="text-lg font-black text-white font-mono">
                        {romaKPIs.totalTonnage >= 1000 ? `${(romaKPIs.totalTonnage / 1000).toFixed(1)} т` : `${romaKPIs.totalTonnage} кг`}
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Вес за все время</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">Тяжелый вес</span>
                      <span className="text-lg font-black text-orange-300 font-mono">
                        {romaKPIs.maxWeight} <span className="text-xs text-gray-400">кг</span>
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Рекорд в жиме/приседе</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">Активные сессии</span>
                      <span className="text-lg font-black text-white font-mono">
                        {romaKPIs.totalSessions} <span className="text-xs text-gray-400">дней</span>
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Тренировочные дни</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">Всего подходов</span>
                      <span className="text-lg font-black text-white font-mono">
                        {romaKPIs.totalSets} <span className="text-xs text-gray-400">раз</span>
                      </span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">Сумма всех сетов</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    Рома еще не выполнял упражнения
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SINGLE ATHLETE PROFILE VIEW & RECORDS TABLE */
            <div className="space-y-6">
              {/* Highlight Dashboard Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0b0f13]/60 p-4 rounded-xl border border-border-dark shadow-md flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${isPetya ? 'bg-indigo-500/10 text-indigo-400' : 'bg-orange-500/10 text-orange-400'}`}>
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 font-bold uppercase">Общий тоннаж</span>
                    <span className="text-lg font-black text-white font-mono">
                      {currentAthleteKPIs.totalTonnage >= 1000 ? `${(currentAthleteKPIs.totalTonnage / 1000).toFixed(1)} т` : `${currentAthleteKPIs.totalTonnage} кг`}
                    </span>
                  </div>
                </div>

                <div className="bg-[#0b0f13]/60 p-4 rounded-xl border border-border-dark shadow-md flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${isPetya ? 'bg-indigo-500/10 text-indigo-400' : 'bg-orange-500/10 text-orange-400'}`}>
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 font-bold uppercase">Тренировочные дни</span>
                    <span className="text-lg font-black text-white font-mono">
                      {currentAthleteKPIs.totalSessions} {currentAthleteKPIs.totalSessions === 1 ? 'день' : currentAthleteKPIs.totalSessions > 1 && currentAthleteKPIs.totalSessions < 5 ? 'дня' : 'дней'}
                    </span>
                  </div>
                </div>

                <div className="bg-[#0b0f13]/60 p-4 rounded-xl border border-border-dark shadow-md flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${isPetya ? 'bg-indigo-500/10 text-indigo-400' : 'bg-orange-500/10 text-orange-400'}`}>
                    <Dumbbell className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 font-bold uppercase">Подходов закрыто</span>
                    <span className="text-lg font-black text-white font-mono">
                      {currentAthleteKPIs.totalSets} раз
                    </span>
                  </div>
                </div>

                <div className="bg-[#0b0f13]/60 p-4 rounded-xl border border-border-dark shadow-md flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${isPetya ? 'bg-indigo-500/10 text-indigo-400' : 'bg-orange-500/10 text-orange-400'}`}>
                    <Award className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] text-gray-500 font-bold uppercase">Частое упр.</span>
                    <span className="text-sm font-black text-white truncate block">
                      {currentAthleteKPIs.favoriteExerciseName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Records and Last values Table */}
              <div className="bg-[#0b0f13]/40 p-5 rounded-xl border border-border-dark shadow-md space-y-4">
                <h3 className="font-extrabold text-white text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-border-dark">
                  <Award className="h-5 w-5 text-accent-lime" />
                  Личные рекорды и последние показатели ({isPetya ? 'Петя' : 'Рома'})
                </h3>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border-dark/60 text-gray-500 uppercase font-bold tracking-wider text-[9px]">
                        <th className="py-2.5 px-2">Упражнение</th>
                        <th className="py-2.5 px-2 text-center text-accent-lime font-black">Рекордный вес</th>
                        <th className="py-2.5 px-2 text-center text-gray-300">Последний рабочий вес</th>
                        <th className="py-2.5 px-2 text-center text-gray-400">Схема подходов</th>
                        <th className="py-2.5 px-2 text-right text-gray-500">Дата последнего замера</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900/50">
                      {personalRecords.map((rec, i) => (
                        <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 px-2 font-bold text-white max-w-[200px] sm:max-w-xs truncate">{rec.exerciseName}</td>
                          <td className="py-3 px-2 text-center font-black text-accent-lime font-mono text-sm">
                            {rec.maxWeight ? `${rec.maxWeight} кг` : '—'}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-gray-300 font-mono">
                            {rec.latestWeight ? `${rec.latestWeight} кг` : '—'}
                          </td>
                          <td className="py-3 px-2 text-center text-gray-400 font-mono">
                            {rec.latestReps && rec.latestSets ? `${rec.latestReps} повт × ${rec.latestSets} подх` : '—'}
                          </td>
                          <td className="py-3 px-2 text-right text-gray-500 font-mono text-[10px]">
                            {rec.latestDate ? rec.latestDate.split('-').reverse().join('.') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. Complete Progress Charts Grid for All Exercises */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-border-dark/40">
              <Sparkles className="h-4 w-4 text-accent-lime" />
              <h3 className="font-extrabold text-white text-sm sm:text-base uppercase tracking-wider">
                Графики прогресса по упражнениям
              </h3>
            </div>

            {activeExercisesCount === 0 ? (
              <div className="bg-card-dark rounded-xl border border-border-dark p-12 text-center text-gray-500 text-sm">
                Нет записей тренировок по выбранным параметрам.<br />
                <span className="block mt-2 text-xs">Внесите и сохраните новые результаты в разделе «Тренировка» для отображения статистики.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {exercises.map(ex => (
                  <ExerciseProgressCard 
                    key={ex.id}
                    exercise={ex}
                    logs={logs}
                    selectedAthleteId={selectedAthleteId}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * STAIRCASE PROGRESS CARD FOR INDIVIDUAL EXERCISES
 */
function ExerciseProgressCard({ exercise, logs, selectedAthleteId }: {
  key?: string;
  exercise: Exercise;
  logs: LogEntry[];
  selectedAthleteId: 'all' | 'petya' | 'roma';
}) {
  const petyaLogs = useMemo(() => {
    return logs
      .filter(l => l.exerciseId === exercise.id && l.athleteId === 'petya')
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, exercise.id]);

  const romaLogs = useMemo(() => {
    return logs
      .filter(l => l.exerciseId === exercise.id && l.athleteId === 'roma')
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, exercise.id]);

  const maxRepsGlobal = useMemo(() => {
    const petyaMax = petyaLogs.length > 0 ? Math.max(...petyaLogs.map(l => l.reps)) : 0;
    const romaMax = romaLogs.length > 0 ? Math.max(...romaLogs.map(l => l.reps)) : 0;
    return Math.max(petyaMax, romaMax, exercise.defaultReps, 8);
  }, [petyaLogs, romaLogs, exercise.defaultReps]);

  const hasPetyaLogs = petyaLogs.length > 0;
  const hasRomaLogs = romaLogs.length > 0;

  // Decide if we should render this card
  const showCard = selectedAthleteId === 'all'
    ? (hasPetyaLogs || hasRomaLogs)
    : (selectedAthleteId === 'petya' ? hasPetyaLogs : hasRomaLogs);

  if (!showCard) {
    return null;
  }

  return (
    <div className="bg-card-dark p-4 sm:p-5 rounded-xl border border-border-dark shadow-md flex flex-col justify-between space-y-4">
      {/* Exercise Card Title Header */}
      <div className="flex justify-between items-start border-b border-border-dark/40 pb-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-extrabold text-white text-xs sm:text-sm uppercase tracking-wide truncate">
            {exercise.name}
          </h4>
          <span className="text-[10px] text-gray-500 font-mono">
            Цель: {exercise.defaultWeight} {exercise.unit} ({exercise.defaultReps}×{exercise.defaultSets})
          </span>
        </div>
      </div>

      {/* Rows of Staircases */}
      <div className="space-y-4">
        {(selectedAthleteId === 'all' || selectedAthleteId === 'petya') && (
          <StaircaseRow
            athleteName="Петя"
            athleteId="petya"
            logs={petyaLogs}
            colorClass="bg-indigo-500"
            bgClass="bg-indigo-600/20 border border-indigo-500/20"
            activeColorClass="text-indigo-400"
            maxRepsGlobal={maxRepsGlobal}
            unit={exercise.unit}
          />
        )}

        {(selectedAthleteId === 'all' || selectedAthleteId === 'roma') && (
          <StaircaseRow
            athleteName="Рома"
            athleteId="roma"
            logs={romaLogs}
            colorClass="bg-orange-500"
            bgClass="bg-orange-600/20 border border-orange-500/20"
            activeColorClass="text-orange-400"
            maxRepsGlobal={maxRepsGlobal}
            unit={exercise.unit}
          />
        )}
      </div>
    </div>
  );
}

/**
 * REUSABLE STAIRCASE ROW COMPONENT
 */
function StaircaseRow({ 
  athleteName, 
  athleteId,
  logs, 
  colorClass, 
  bgClass,
  activeColorClass,
  maxRepsGlobal,
  unit
}: {
  athleteName: string;
  athleteId: string;
  logs: LogEntry[];
  colorClass: string;
  bgClass: string;
  activeColorClass: string;
  maxRepsGlobal: number;
  unit: string;
}) {
  const latestLog = logs[logs.length - 1] || null;
  const [activeLog, setActiveLog] = useState<LogEntry | null>(null);

  // Default to showing the latest log when not hovering
  const displayedLog = activeLog || latestLog;

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-between py-4 px-4 bg-white/[0.01] rounded-xl border border-dashed border-border-dark/30 h-[100px]">
        <div className="flex flex-col gap-1">
          <span className={`text-xs font-black uppercase tracking-wider ${activeColorClass}`}>
            {athleteName}
          </span>
          <span className="text-xs text-gray-500 italic">Нет записей по этому упражнению</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0f13]/30 p-3 sm:p-4 rounded-xl border border-border-dark/60 space-y-3 relative">
      {/* Row Header - Clean & Minimal */}
      <div className="flex items-center justify-between pb-2 border-b border-border-dark/40">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black uppercase tracking-widest ${activeColorClass}`}>
            {athleteName}
          </span>
          <span className="text-[10px] text-gray-500 font-mono bg-neutral-900 px-1.5 py-0.5 rounded border border-border-dark/40">
            {logs.length} тр.
          </span>
        </div>
        {displayedLog && (
          <span className="text-[11px] text-accent-lime font-mono font-extrabold animate-fadeIn">
            Тр. #{logs.indexOf(displayedLog) + 1} ({displayedLog.date.split('-').reverse().slice(0, 2).join('.')}) :
          </span>
        )}
      </div>

      {/* The staircase layout */}
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin h-[105px]">
        {logs.map((log, idx) => {
          const reps = log.reps;
          const sets = log.sets;
          const weight = log.weight;
          const isActive = displayedLog && displayedLog.id === log.id;

          return (
            <div 
              key={log.id} 
              className="flex flex-col items-center gap-1 cursor-pointer select-none relative group flex-shrink-0"
              onMouseEnter={() => setActiveLog(log)}
              onMouseLeave={() => setActiveLog(null)}
              onClick={() => setActiveLog(log)}
            >
              {/* Dynamic micro-tooltip positioned above the bar */}
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-20 animate-fadeIn">
                <div className="bg-neutral-950 border border-border-dark/80 text-white text-[10px] font-mono rounded px-2.5 py-1.5 shadow-2xl whitespace-nowrap flex flex-col gap-0.5 items-center">
                  <span className="text-gray-400 font-bold">Тр. #{idx + 1} ({log.date.split('-').reverse().slice(0, 2).join('.')})</span>
                  <span className="font-extrabold text-accent-lime">Схема: {reps} × {sets}</span>
                  <span className="font-bold text-white">Вес: {weight} {unit}</span>
                  <span className="text-gray-500 text-[9px]">Объем: {reps * sets} повт.</span>
                </div>
                {/* Arrow */}
                <div className="w-1.5 h-1.5 bg-neutral-950 border-r border-b border-border-dark rotate-45 -mt-1" />
              </div>

              {/* Reps label at the top of the bar */}
              <span className={`text-[9px] font-black font-mono transition-colors duration-150 ${
                isActive ? 'text-white scale-110' : 'text-gray-500 group-hover:text-gray-300'
              }`}>
                {reps}
              </span>

              {/* The stacked bar of sets with uniform-sized bricks (max 6 sets) */}
              <div className="flex flex-col-reverse gap-[2px] w-6 sm:w-7 transition-all duration-200">
                {Array.from({ length: Math.min(sets, 6) }).map((_, sIdx) => (
                  <div 
                    key={sIdx} 
                    className={`h-2.5 rounded-[1.5px] transition-all duration-150 ${
                      isActive 
                        ? colorClass + ' opacity-100 shadow-[0_0_6px_rgba(255,255,255,0.15)] scale-x-105' 
                        : bgClass + ' opacity-60 group-hover:opacity-90'
                    }`}
                  />
                ))}
              </div>

              {/* Subtle weight display at the bottom */}
              <span className={`text-[9px] font-bold font-mono transition-colors duration-150 ${
                isActive ? 'text-white font-extrabold' : 'text-gray-500 group-hover:text-gray-300'
              }`}>
                {weight}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
