/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Athlete, Exercise, Workout, LogEntry, ClosedExercise } from '../types';
import { findPreviousResult } from '../services/dbService';
import { Play, Check, Trash2, RotateCcw, Lock, Unlock, Calendar, UserPlus, FileText, ChevronDown, ChevronUp, Plus, Minus, Dumbbell } from 'lucide-react';

interface WorkoutTrackerProps {
  athletes: Athlete[];
  exercises: Exercise[];
  workouts: Workout[];
  logs: LogEntry[];
  closed: ClosedExercise[];
  onSaveLogs: (newLogs: LogEntry[]) => void;
  onDeleteWorkoutLogs: (date: string, workoutId: string) => void;
  onToggleCloseExercise: (athleteId: string, exerciseId: string) => void;
  onAddExerciseToWorkout: (workoutId: string, exerciseName: string, defaultWeight: number, defaultReps: number, defaultSets: number) => void;
}

export default function WorkoutTracker({
  athletes,
  exercises,
  workouts,
  logs,
  closed,
  onSaveLogs,
  onDeleteWorkoutLogs,
  onToggleCloseExercise,
  onAddExerciseToWorkout,
}: WorkoutTrackerProps) {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>(workouts[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Local state for current inputs. Structure: { [exerciseId_athleteId]: { weight, reps, sets, wasEntered } }
  const [inputs, setInputs] = useState<Record<string, { weight: number; reps: number; sets: number; isModified: boolean }>>({});
  
  const [showClosedExercises, setShowClosedExercises] = useState(false);
  const [showQuickAddExercise, setShowQuickAddExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseWeight, setNewExerciseWeight] = useState(10);
  const [newExerciseReps, setNewExerciseReps] = useState(12);
  const [newExerciseSets, setNewExerciseSets] = useState(4);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset confirmation state when date or workout changes
  useEffect(() => {
    setConfirmDelete(false);
  }, [selectedWorkoutId, selectedDate]);

  const activeWorkout = workouts.find(w => w.id === selectedWorkoutId);
  const activeWorkoutExercises = activeWorkout
    ? activeWorkout.exerciseIds
        .map(id => exercises.find(ex => ex.id === id))
        .filter((ex): ex is Exercise => !!ex)
    : [];

  const isAlreadySavedForThisDate = logs.some(
    log => log.date === selectedDate && log.workoutId === selectedWorkoutId
  );

  // Reset/initialize inputs when selected workout or date changes
  useEffect(() => {
    if (!activeWorkout) return;
    
    // Check if there are saved drafts in localStorage
    const savedDraftsStr = localStorage.getItem('gym_tracker_workout_drafts_v1');
    let savedDrafts: Record<string, { date: string; inputs: Record<string, { weight: number; reps: number; sets: number; isModified: boolean }> }> = {};
    if (savedDraftsStr) {
      try {
        savedDrafts = JSON.parse(savedDraftsStr);
      } catch (e) {
        console.error('Error parsing saved drafts', e);
      }
    }

    // Purge old drafts from other days to satisfy "если новый день"
    const todayStr = new Date().toISOString().split('T')[0];
    let purgedSome = false;
    Object.keys(savedDrafts).forEach(k => {
      if (savedDrafts[k].date !== todayStr) {
        delete savedDrafts[k];
        purgedSome = true;
      }
    });
    if (purgedSome) {
      localStorage.setItem('gym_tracker_workout_drafts_v1', JSON.stringify(savedDrafts));
    }

    const draftKey = `${selectedWorkoutId}_${selectedDate}`;
    const existingDraft = savedDrafts[draftKey];

    const initialInputs: Record<string, { weight: number; reps: number; sets: number; isModified: boolean }> = {};
    
    activeWorkoutExercises.forEach(ex => {
      athletes.forEach(athlete => {
        const key = `${ex.id}_${athlete.id}`;
        
        // 1. If there is a saved draft input for this key, restore it
        if (existingDraft && existingDraft.inputs[key]) {
          initialInputs[key] = existingDraft.inputs[key];
        } else {
          // 2. Otherwise look for existing log entry on this exact date
          const existingLog = logs.find(
            log => log.date === selectedDate && log.athleteId === athlete.id && log.exerciseId === ex.id && log.workoutId === selectedWorkoutId
          );
          
          if (existingLog) {
            initialInputs[key] = {
              weight: existingLog.weight,
              reps: existingLog.reps,
              sets: existingLog.sets,
              isModified: true,
            };
          } else {
            // 3. Otherwise look for previous record for copy-placeholder
            const prevLog = findPreviousResult(logs, athlete.id, ex.id, selectedDate);
            initialInputs[key] = {
              weight: prevLog ? prevLog.weight : ex.defaultWeight,
              reps: prevLog ? prevLog.reps : ex.defaultReps,
              sets: prevLog ? prevLog.sets : ex.defaultSets,
              isModified: false, // Indicates coach hasn't actively entered/modified for today yet
            };
          }
        }
      });
    });
    
    setInputs(initialInputs);
    setSaveStatus('idle');
  }, [selectedWorkoutId, selectedDate, logs, exercises]);

  // Save inputs to drafts whenever they change
  useEffect(() => {
    if (!selectedWorkoutId || !selectedDate || Object.keys(inputs).length === 0) return;
    if (saveStatus === 'saved') return;

    // Check if there is any modified/entered state to save
    const hasAnyModified = Object.keys(inputs).some(key => inputs[key]?.isModified);
    
    const savedDraftsStr = localStorage.getItem('gym_tracker_workout_drafts_v1');
    let savedDrafts: Record<string, { date: string; inputs: Record<string, { weight: number; reps: number; sets: number; isModified: boolean }> }> = {};
    if (savedDraftsStr) {
      try {
        savedDrafts = JSON.parse(savedDraftsStr);
      } catch (e) {}
    }

    const draftKey = `${selectedWorkoutId}_${selectedDate}`;

    if (hasAnyModified) {
      savedDrafts[draftKey] = {
        date: selectedDate,
        inputs: inputs,
      };
    } else {
      delete savedDrafts[draftKey];
    }

    localStorage.setItem('gym_tracker_workout_drafts_v1', JSON.stringify(savedDrafts));
  }, [inputs, selectedWorkoutId, selectedDate, saveStatus]);

  const handleInputChange = (exId: string, athleteId: string, field: 'weight' | 'reps' | 'sets', val: number) => {
    const key = `${exId}_${athleteId}`;
    setInputs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: Math.max(0, val),
        isModified: true,
      }
    }));
  };

  const incrementField = (exId: string, athleteId: string, field: 'weight' | 'reps' | 'sets', step: number) => {
    const key = `${exId}_${athleteId}`;
    const currentVal = inputs[key]?.[field] ?? 0;
    handleInputChange(exId, athleteId, field, parseFloat((currentVal + step).toFixed(2)));
  };

  const handleAutofillFromPrevious = (exId: string, athleteId: string) => {
    const prevLog = findPreviousResult(logs, athleteId, exId, selectedDate);
    const key = `${exId}_${athleteId}`;
    const exercise = exercises.find(ex => ex.id === exId);
    
    if (prevLog) {
      setInputs(prev => ({
        ...prev,
        [key]: {
          weight: prevLog.weight,
          reps: prevLog.reps,
          sets: prevLog.sets,
          isModified: true,
        }
      }));
    } else if (exercise) {
      setInputs(prev => ({
        ...prev,
        [key]: {
          weight: exercise.defaultWeight,
          reps: exercise.defaultReps,
          sets: exercise.defaultSets,
          isModified: true,
        }
      }));
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000); // auto-reset after 5 seconds
    } else {
      onDeleteWorkoutLogs(selectedDate, selectedWorkoutId);
      setConfirmDelete(false);
    }
  };

  const handleSave = () => {
    if (!activeWorkout) return;

    // Filter which exercises are actively logged (either modified, or the coach accepts default)
    const newLogsToSave: LogEntry[] = [];

    activeWorkoutExercises.forEach(ex => {
      athletes.forEach(athlete => {
        const key = `${ex.id}_${athlete.id}`;
        const input = inputs[key];
        const isClosed = closed.some(c => c.athleteId === athlete.id && c.exerciseId === ex.id);

        // If exercise is closed, we don't log unless explicitly modified
        if (isClosed && !input?.isModified) {
          return;
        }

        if (input) {
          newLogsToSave.push({
            id: `log_${Date.now()}_${ex.id}_${athlete.id}`,
            date: selectedDate,
            workoutId: selectedWorkoutId,
            exerciseId: ex.id,
            athleteId: athlete.id,
            weight: input.weight,
            reps: input.reps,
            sets: input.sets,
          });
        }
      });
    });

    onSaveLogs(newLogsToSave);
    
    // Clear the draft from localStorage for this workout and date
    const savedDraftsStr = localStorage.getItem('gym_tracker_workout_drafts_v1');
    if (savedDraftsStr) {
      try {
        const savedDrafts = JSON.parse(savedDraftsStr);
        const draftKey = `${selectedWorkoutId}_${selectedDate}`;
        delete savedDrafts[draftKey];
        localStorage.setItem('gym_tracker_workout_drafts_v1', JSON.stringify(savedDrafts));
      } catch (e) {
        console.error('Error clearing draft on save', e);
      }
    }

    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExerciseName.trim()) return;
    onAddExerciseToWorkout(selectedWorkoutId, newExerciseName.trim(), newExerciseWeight, newExerciseReps, newExerciseSets);
    setNewExerciseName('');
    setShowQuickAddExercise(false);
  };

  // Divide active exercises into open and closed
  const partitionedExercises = activeWorkoutExercises.reduce(
    (acc, ex) => {
      // An exercise is closed for the workout if BOTH athletes have closed it,
      // or if it's closed for any athlete and showClosed is false we might hide parts.
      // Let's check if the exercise is closed for Petya AND Roma:
      const petyaClosed = closed.some(c => c.athleteId === 'petya' && c.exerciseId === ex.id);
      const romaClosed = closed.some(c => c.athleteId === 'roma' && c.exerciseId === ex.id);
      
      if (petyaClosed && romaClosed) {
        acc.closed.push(ex);
      } else {
        acc.open.push(ex);
      }
      return acc;
    },
    { open: [] as Exercise[], closed: [] as Exercise[] }
  );

  return (
    <div className="space-y-6">
      {/* Top control bar: Workout selection and Date Selection */}
      <div className="bg-card-dark p-4 rounded-xl border border-border-dark shadow-md flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end flex-1 w-full min-w-0">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Dumbbell className="h-3.5 w-3.5 text-accent-lime flex-shrink-0" />
              <span>Выбрать тренировку</span>
            </label>
            <select
              value={selectedWorkoutId}
              onChange={(e) => setSelectedWorkoutId(e.target.value)}
              className="w-full bg-input-dark border border-border-dark text-white text-base md:text-sm font-medium rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-lime/50 min-h-[42px]"
            >
              {workouts.map(w => (
                <option key={w.id} value={w.id} className="bg-card-dark text-white">{w.name}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-accent-lime flex-shrink-0" />
              <span>Дата тренировки</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-input-dark border border-border-dark text-white text-base md:text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-lime/50 min-h-[42px] [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="w-full lg:w-auto flex items-end">
          <button
            onClick={() => setShowQuickAddExercise(!showQuickAddExercise)}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-1.5 bg-input-dark hover:bg-white/5 border border-border-dark text-gray-300 text-sm font-bold rounded-lg px-4 py-2.5 transition-colors cursor-pointer min-h-[42px]"
          >
            <Plus className="h-4 w-4 text-accent-lime flex-shrink-0" />
            <span>Добавить упражнение</span>
          </button>
        </div>
      </div>

      {/* Quick Add Exercise Dialog within the workout */}
      {showQuickAddExercise && (
        <form onSubmit={handleQuickAdd} className="bg-card-dark border border-border-dark p-5 rounded-xl space-y-4 animate-fadeIn">
          <h3 className="text-sm font-bold text-accent-lime uppercase tracking-wider">Добавление нового упражнения в этот шаблон</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Название упражнения</label>
              <input
                type="text"
                required
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
                placeholder="Например: Жим лежа"
                className="w-full bg-input-dark border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-lime/50 placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Вес по умолчанию (кг)</label>
              <input
                type="number"
                step="0.25"
                required
                value={newExerciseWeight}
                onChange={(e) => setNewExerciseWeight(parseFloat(e.target.value) || 0)}
                className="w-full bg-input-dark border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-lime/50 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Повторы</label>
                <input
                  type="number"
                  required
                  value={newExerciseReps}
                  onChange={(e) => setNewExerciseReps(parseInt(e.target.value) || 0)}
                  className="w-full bg-input-dark border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-lime/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Подходы</label>
                <input
                  type="number"
                  required
                  value={newExerciseSets}
                  onChange={(e) => setNewExerciseSets(parseInt(e.target.value) || 0)}
                  className="w-full bg-input-dark border border-border-dark text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-lime/50 font-mono"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowQuickAddExercise(false)}
              className="text-gray-400 hover:text-white hover:bg-white/5 text-xs font-semibold rounded-md px-3 py-2 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="bg-accent-lime hover:bg-lime-400 text-black text-xs font-bold uppercase tracking-wider rounded-md px-4 py-2 shadow-md transition-all cursor-pointer"
            >
              Добавить в шаблон
            </button>
          </div>
        </form>
      )}

      {/* Main exercises input listing - 1 Screen Grid layout */}
      <div className="space-y-4">
        {partitionedExercises.open.length === 0 && partitionedExercises.closed.length === 0 && (
          <div className="bg-card-dark rounded-xl border border-border-dark p-8 text-center text-gray-400 text-sm shadow-md">
            В этой тренировке пока нет упражнений. Нажмите «Добавить упражнение», чтобы начать.
          </div>
        )}

        {/* List of open exercises */}
        {partitionedExercises.open.map((ex, idx) => {
          return (
            <div key={ex.id} id={`exercise_card_${ex.id}`} className="bg-card-dark rounded-xl border border-border-dark shadow-lg overflow-hidden transition-all">
              {/* Exercise Header */}
              <div className="bg-black/40 border-b border-border-dark px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-accent-lime text-black text-xs font-black font-mono">
                    {idx + 1}
                  </span>
                  <h3 className="font-bold text-white text-sm sm:text-base tracking-tight">{ex.name}</h3>
                </div>
                <span className="self-start sm:self-auto text-xs font-mono font-semibold text-gray-400 bg-black/50 border border-border-dark px-2.5 py-1 rounded-md">
                  Цель: {ex.defaultWeight} кг × {ex.defaultReps} × {ex.defaultSets}
                </span>
              </div>

              {/* Side-by-side 2 Columns Athletes Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-dark">
                {athletes.map(athlete => {
                  const key = `${ex.id}_${athlete.id}`;
                  const input = inputs[key] || { weight: ex.defaultWeight, reps: ex.defaultReps, sets: ex.defaultSets, isModified: false };
                  
                  // Check if exercise is closed for THIS athlete specifically
                  const isClosedForAthlete = closed.some(c => c.athleteId === athlete.id && c.exerciseId === ex.id);
                  const prevLog = findPreviousResult(logs, athlete.id, ex.id, selectedDate);

                  return (
                    <div key={athlete.id} className={`p-4 space-y-3 transition-opacity ${isClosedForAthlete ? 'bg-black/30 opacity-40' : ''}`}>
                      {/* Athlete Sub-header */}
                      <div className="flex items-center justify-between pb-1 border-b border-border-dark/45">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${athlete.id === 'petya' ? 'bg-[#C1FF72]' : 'bg-[#38bdf8]'}`}></span>
                          <span className="font-extrabold text-white text-sm tracking-wide">{athlete.name}</span>
                          {isClosedForAthlete && (
                            <span className="inline-flex items-center gap-1 bg-black/60 text-prev-dark text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border-dark font-mono">
                              <Lock className="h-2.5 w-2.5 text-prev-dark" /> закрыто
                            </span>
                          )}
                        </div>

                        {/* Lock / Unlock Toggle for Athlete */}
                        <button
                          type="button"
                          onClick={() => onToggleCloseExercise(athlete.id, ex.id)}
                          title={isClosedForAthlete ? "Открыть упражнение" : "Закрыть упражнение (скрыть для этого спортсмена)"}
                          className={`p-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                            isClosedForAthlete 
                              ? 'text-accent-lime hover:bg-accent-lime/10 bg-accent-lime/5 border border-accent-lime/20' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {isClosedForAthlete ? (
                            <>
                              <Unlock className="h-3 w-3 text-accent-lime" />
                              <span className="text-[10px]">Открыть</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              <span className="text-[10px]">Закрыть</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Previous Result Showcase */}
                      <div className="bg-black/30 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border-dark">
                        <div className="text-xs">
                          <span className="text-gray-500 block font-bold uppercase text-[9px] tracking-widest">Ранее:</span>
                          {prevLog ? (
                            <span className="font-bold text-gray-300 font-mono">
                              {prevLog.weight}кг × {prevLog.reps} × {prevLog.sets} подх.
                              <span className="text-gray-500 text-[10px] ml-1.5 font-sans">({prevLog.date.split('-').slice(1).join('.')})</span>
                            </span>
                          ) : (
                            <span className="text-gray-600 italic">Нет записей</span>
                          )}
                        </div>

                        {/* Rapid Autofill Button */}
                        <button
                          type="button"
                          onClick={() => handleAutofillFromPrevious(ex.id, athlete.id)}
                          disabled={isClosedForAthlete}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wider text-accent-lime hover:text-white bg-black/40 border border-border-dark hover:border-accent-lime/50 disabled:opacity-30 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Копировать</span>
                        </button>
                      </div>

                      {/* Quick numerical input blocks */}
                      {!isClosedForAthlete && (
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          {/* Weight Field with quick +2.5 / +5 and micro +/- */}
                          <div className="bg-black/45 border border-border-dark rounded-lg p-1.5 shadow-md">
                            <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider text-center mb-1">Вес (кг)</span>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'weight', -2.5)}
                                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center bg-input-dark hover:bg-white/5 border border-border-dark rounded text-gray-300 font-bold cursor-pointer text-xs sm:text-sm"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="0.25"
                                value={input.weight}
                                onChange={(e) => handleInputChange(ex.id, athlete.id, 'weight', parseFloat(e.target.value) || 0)}
                                className="w-8 sm:w-12 text-center text-base sm:text-sm font-black font-mono text-white bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'weight', 2.5)}
                                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center bg-input-dark hover:bg-white/5 border border-border-dark rounded text-gray-300 font-bold cursor-pointer text-xs sm:text-sm"
                              >
                                +
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1 mt-1.5">
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'weight', 5)}
                                className="text-[9px] font-mono py-0.5 bg-accent-lime/10 hover:bg-accent-lime/20 text-accent-lime border border-accent-lime/20 rounded font-black cursor-pointer"
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'weight', -5)}
                                className="text-[9px] font-mono py-0.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-900/30 rounded font-black cursor-pointer"
                              >
                                -5
                              </button>
                            </div>
                          </div>

                          {/* Reps Field */}
                          <div className="bg-black/45 border border-border-dark rounded-lg p-1.5 shadow-md">
                            <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider text-center mb-1">Повторы</span>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'reps', -1)}
                                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center bg-input-dark hover:bg-white/5 border border-border-dark rounded text-gray-300 font-bold cursor-pointer text-xs sm:text-sm"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={input.reps}
                                onChange={(e) => handleInputChange(ex.id, athlete.id, 'reps', parseInt(e.target.value) || 0)}
                                className="w-8 sm:w-12 text-center text-base sm:text-sm font-black font-mono text-white bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'reps', 1)}
                                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center bg-input-dark hover:bg-white/5 border border-border-dark rounded text-gray-300 font-bold cursor-pointer text-xs sm:text-sm"
                              >
                                +
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1 mt-1.5">
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'reps', 2)}
                                className="text-[9px] font-mono py-0.5 bg-accent-lime/10 hover:bg-accent-lime/20 text-accent-lime border border-accent-lime/20 rounded font-black cursor-pointer"
                              >
                                +2
                              </button>
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'reps', -2)}
                                className="text-[9px] font-mono py-0.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-900/30 rounded font-black cursor-pointer"
                              >
                                -2
                              </button>
                            </div>
                          </div>

                          {/* Sets/Rounds Field */}
                          <div className="bg-black/45 border border-border-dark rounded-lg p-1.5 shadow-md">
                            <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider text-center mb-1">Подходы</span>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'sets', -1)}
                                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center bg-input-dark hover:bg-white/5 border border-border-dark rounded text-gray-300 font-bold cursor-pointer text-xs sm:text-sm"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={input.sets}
                                onChange={(e) => handleInputChange(ex.id, athlete.id, 'sets', parseInt(e.target.value) || 0)}
                                className="w-8 sm:w-12 text-center text-base sm:text-sm font-black font-mono text-white bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => incrementField(ex.id, athlete.id, 'sets', 1)}
                                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center bg-input-dark hover:bg-white/5 border border-border-dark rounded text-gray-300 font-bold cursor-pointer text-xs sm:text-sm"
                              >
                                +
                              </button>
                            </div>
                            <div className="grid grid-cols-1 gap-1 mt-1.5">
                              <div className="text-[9px] font-bold uppercase text-center py-0.5 bg-black/35 border border-border-dark text-gray-500 rounded font-mono leading-none">
                                {input.isModified ? 'изм.' : 'исх.'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {isClosedForAthlete && (
                        <div className="bg-black/40 rounded-lg p-4 text-center border border-dashed border-border-dark">
                          <p className="text-xs text-gray-400 font-medium">
                            Упражнение закрыто для этого спортсмена.
                          </p>
                          <button
                            type="button"
                            onClick={() => onToggleCloseExercise(athlete.id, ex.id)}
                            className="mt-1.5 text-xs text-accent-lime hover:text-lime-400 font-black tracking-wider uppercase cursor-pointer"
                          >
                            Открыть заново
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {partitionedExercises.closed.length > 0 && (
          <div className="mt-4 bg-card-dark rounded-xl border border-border-dark overflow-hidden shadow-md">
            <button
              type="button"
              onClick={() => setShowClosedExercises(!showClosedExercises)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-bold uppercase tracking-wider text-gray-400 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent-lime" />
                <span>Закрытые упражнения ({partitionedExercises.closed.length})</span>
              </span>
              {showClosedExercises ? <ChevronUp className="h-4 w-4 text-accent-lime" /> : <ChevronDown className="h-4 w-4 text-accent-lime" />}
            </button>
            
            {showClosedExercises && (
              <div className="divide-y divide-border-dark/60 bg-black/40 border-t border-border-dark">
                {partitionedExercises.closed.map((ex, idx) => (
                  <div key={ex.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-white text-sm">{ex.name}</h4>
                      <p className="text-xs text-gray-500 font-mono">Скрыто, так как закрыто для обоих спортсменов</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleCloseExercise('petya', ex.id)}
                        className="text-xs font-bold uppercase tracking-wider bg-input-dark hover:bg-accent-lime hover:text-black border border-border-dark px-3 py-2 rounded-lg text-gray-300 transition-colors cursor-pointer"
                      >
                        Открыть для Пети
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleCloseExercise('roma', ex.id)}
                        className="text-xs font-bold uppercase tracking-wider bg-input-dark hover:bg-accent-lime hover:text-black border border-border-dark px-3 py-2 rounded-lg text-gray-300 transition-colors cursor-pointer"
                      >
                        Открыть для Ромы
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Big Prominent Bottom Action Button */}
      {activeWorkout && (activeWorkoutExercises.length > 0) && (
        <div className="bg-card-dark p-4 rounded-xl border border-border-dark shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-4 z-10">
          <div>
            <h4 className="font-extrabold text-white text-sm uppercase tracking-wider">
              {isAlreadySavedForThisDate ? 'Тренировка сохранена!' : 'Готово к сохранению?'}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5 animate-fadeIn">
              {isAlreadySavedForThisDate ? (
                <span>Вы можете скорректировать значения и обновить лог за </span>
              ) : (
                <span>Результаты запишутся в лог за </span>
              )}
              <span className={`font-black font-mono bg-black/40 px-1.5 py-0.5 rounded ${isAlreadySavedForThisDate ? 'text-gray-400' : 'text-accent-lime'}`}>
                {selectedDate}
              </span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {isAlreadySavedForThisDate && (
              <button
                onClick={handleDelete}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider px-5 py-3.5 rounded-lg border transition-all cursor-pointer ${
                  confirmDelete 
                    ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 animate-pulse shadow-lg shadow-red-600/20'
                    : 'bg-red-950/30 hover:bg-red-900/40 text-red-400 border-red-900/50 hover:border-red-800'
                }`}
              >
                <Trash2 className="h-4 w-4 stroke-[2.5px]" />
                <span>{confirmDelete ? 'Точно удалить?' : 'Удалить тренировку'}</span>
              </button>
            )}

            <button
              onClick={handleSave}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wider px-6 py-3.5 rounded-lg shadow-lg transition-all cursor-pointer ${
                isAlreadySavedForThisDate
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700 shadow-neutral-900/30'
                  : 'bg-accent-lime hover:bg-lime-400 text-black shadow-accent-lime/25 hover:shadow-accent-lime/35'
              }`}
            >
              <Check className="h-4 w-4 stroke-[3px]" />
              <span>{isAlreadySavedForThisDate ? 'Изменить тренировку' : `Сохранить тренировку за ${selectedDate}`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Save Success Alert Overlay */}
      {saveStatus === 'saved' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-accent-lime text-black text-xs font-black uppercase tracking-widest px-6 py-4 rounded-xl shadow-[0_0_35px_rgba(193,255,114,0.4)] border border-accent-lime/50 flex items-center gap-2.5 animate-bounce z-50">
          <span className="w-2.5 h-2.5 rounded-full bg-black animate-ping"></span>
          <span>Результаты успешно записаны в Sheets БД!</span>
        </div>
      )}
    </div>
  );
}
