/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Exercise, Workout } from '../types';
import { Plus, Trash2, ListPlus, Edit2, Check, BookOpen, Dumbbell, Sparkles } from 'lucide-react';

interface TemplateEditorProps {
  exercises: Exercise[];
  workouts: Workout[];
  onAddWorkout: (name: string, exerciseIds: string[]) => void;
  onAddExercise: (name: string, defaultWeight: number, defaultReps: number, defaultSets: number) => void;
  onUpdateWorkoutExercises: (workoutId: string, exerciseIds: string[]) => void;
}

export default function TemplateEditor({
  exercises,
  workouts,
  onAddWorkout,
  onAddExercise,
  onUpdateWorkoutExercises,
}: TemplateEditorProps) {
  // Workout creation state
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [workoutError, setWorkoutError] = useState('');

  // Exercise creation state
  const [newExName, setNewExName] = useState('');
  const [newExWeight, setNewExWeight] = useState(10);
  const [newExReps, setNewExReps] = useState(12);
  const [newExSets, setNewExSets] = useState(4);
  const [exError, setExError] = useState('');

  // Selected workout to modify/inspect
  const [activeWorkoutId, setActiveWorkoutId] = useState<string>(workouts[0]?.id || '');

  const activeWorkout = workouts.find(w => w.id === activeWorkoutId);

  const handleCreateWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkoutName.trim()) {
      setWorkoutError('Введите название тренировки');
      return;
    }
    if (selectedExerciseIds.length === 0) {
      setWorkoutError('Выберите хотя бы одно упражнение для тренировки');
      return;
    }
    onAddWorkout(newWorkoutName.trim(), selectedExerciseIds);
    setNewWorkoutName('');
    setSelectedExerciseIds([]);
    setWorkoutError('');
  };

  const handleCreateExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) {
      setExError('Введите название упражнения');
      return;
    }
    // Check for duplicate names
    if (exercises.some(ex => ex.name.toLowerCase() === newExName.trim().toLowerCase())) {
      setExError('Упражнение с таким названием уже существует');
      return;
    }
    onAddExercise(newExName.trim(), newExWeight, newExReps, newExSets);
    setNewExName('');
    setExError('');
  };

  const handleToggleExerciseInNewWorkout = (id: string) => {
    setSelectedExerciseIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleRemoveExerciseFromWorkout = (workoutId: string, exId: string) => {
    const targetWorkout = workouts.find(w => w.id === workoutId);
    if (!targetWorkout) return;
    const updatedIds = targetWorkout.exerciseIds.filter(id => id !== exId);
    onUpdateWorkoutExercises(workoutId, updatedIds);
  };

  const handleAddExerciseToWorkout = (workoutId: string, exId: string) => {
    const targetWorkout = workouts.find(w => w.id === workoutId);
    if (!targetWorkout) return;
    if (targetWorkout.exerciseIds.includes(exId)) return;
    onUpdateWorkoutExercises(workoutId, [...targetWorkout.exerciseIds, exId]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* COLUMN 1: Workout Templates Manager */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-card-dark p-5 rounded-xl border border-border-dark shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border-dark gap-3">
            <h2 className="font-bold text-white flex items-center gap-2 text-sm sm:text-base uppercase tracking-wider">
              <Dumbbell className="h-5 w-5 text-accent-lime flex-shrink-0" />
              Шаблоны тренировок
            </h2>
            <select
              value={activeWorkoutId}
              onChange={(e) => setActiveWorkoutId(e.target.value)}
              className="w-full sm:w-auto bg-input-dark border border-border-dark text-white text-base md:text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent-lime/50 max-w-full"
            >
              {workouts.map(w => (
                <option key={w.id} value={w.id} className="bg-card-dark text-white">{w.name}</option>
              ))}
            </select>
          </div>

          {activeWorkout ? (
            <div className="space-y-4">
              <div className="bg-accent-lime/10 border border-accent-lime/20 p-4 rounded-lg shadow-sm">
                <span className="block text-[9px] font-black text-accent-lime uppercase tracking-widest">Активный шаблон:</span>
                <span className="font-extrabold text-white text-lg">{activeWorkout.name}</span>
                <span className="block text-xs text-gray-400 mt-1">Всего упражнений в шаблоне: {activeWorkout.exerciseIds.length}</span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Состав упражнений в шаблоне:</h3>
                <div className="divide-y divide-border-dark bg-black/35 rounded-lg border border-border-dark overflow-hidden">
                  {activeWorkout.exerciseIds.map((exId, idx) => {
                    const ex = exercises.find(e => e.id === exId);
                    if (!ex) return null;
                    return (
                      <div key={exId} className="px-3.5 py-3 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-gray-500">{idx + 1}.</span>
                          <span className="font-semibold text-gray-200">{ex.name}</span>
                          <span className="text-[10.5px] font-mono text-accent-lime/80 bg-black/40 px-1.5 py-0.5 rounded border border-border-dark">({ex.defaultWeight}кг × {ex.defaultReps} × {ex.defaultSets})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExerciseFromWorkout(activeWorkout.id, exId)}
                          className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-950/25 rounded transition-all cursor-pointer"
                          title="Исключить из шаблона"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  {activeWorkout.exerciseIds.length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-500 italic">Этот шаблон пуст. Добавьте упражнения ниже.</div>
                  )}
                </div>
              </div>

              {/* Add existing exercises to this template */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Добавить из справочника в текущий шаблон:</h3>
                <div className="flex flex-wrap gap-1.5">
                  {exercises
                    .filter(ex => !activeWorkout.exerciseIds.includes(ex.id))
                    .map(ex => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => handleAddExerciseToWorkout(activeWorkout.id, ex.id)}
                        className="inline-flex items-center gap-1.5 bg-input-dark hover:bg-white/5 border border-border-dark hover:border-accent-lime/50 text-gray-300 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 text-accent-lime" />
                        <span>{ex.name}</span>
                      </button>
                    ))}
                  {exercises.filter(ex => !activeWorkout.exerciseIds.includes(ex.id)).length === 0 && (
                    <span className="text-xs text-gray-500 italic">Все доступные упражнения уже добавлены в этот шаблон!</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Выберите или создайте тренировку</p>
          )}
        </div>

        {/* Create new training template form */}
        <div className="bg-card-dark p-5 rounded-xl border border-border-dark shadow-md space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2 text-sm sm:text-base pb-3 border-b border-border-dark uppercase tracking-wider">
            <ListPlus className="h-5 w-5 text-indigo-400 flex-shrink-0" />
            Создать новый шаблон тренировки
          </h2>
          
          <form onSubmit={handleCreateWorkout} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Название тренировки</label>
              <input
                type="text"
                required
                value={newWorkoutName}
                onChange={(e) => setNewWorkoutName(e.target.value)}
                placeholder="Например: Тренировка ног"
                className="w-full bg-input-dark border border-border-dark text-white text-base md:text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent-lime/50 placeholder-gray-600 min-h-[42px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Выберите упражнения в шаблон</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1.5 bg-black/40 rounded-lg border border-border-dark">
                {exercises.map(ex => {
                  const isChecked = selectedExerciseIds.includes(ex.id);
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => handleToggleExerciseInNewWorkout(ex.id)}
                      className={`flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isChecked 
                          ? 'bg-accent-lime text-black border-accent-lime font-black' 
                          : 'bg-input-dark border-border-dark text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <span className="truncate pr-2">{ex.name}</span>
                      {isChecked ? (
                        <Check className="h-3.5 w-3.5 text-black stroke-[3px] flex-shrink-0" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {workoutError && <p className="text-xs text-rose-400 font-semibold">{workoutError}</p>}

            <button
              type="submit"
              className="w-full bg-accent-lime hover:bg-lime-400 text-black font-bold uppercase tracking-wider text-xs py-3 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer min-h-[42px]"
            >
              Создать тренировку
            </button>
          </form>
        </div>
      </div>

      {/* COLUMN 2: Exercises Catalogue (Directory/Справочник) */}
      <div className="space-y-6">
        <div className="bg-card-dark p-5 rounded-xl border border-border-dark shadow-md space-y-4">
          <h2 className="font-bold text-white flex items-center gap-2 text-sm sm:text-base pb-3 border-b border-border-dark uppercase tracking-wider">
            <BookOpen className="h-5 w-5 text-accent-lime flex-shrink-0" />
            Справочник упражнений
          </h2>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {exercises.map(ex => (
              <div key={ex.id} className="p-3 bg-black/30 hover:bg-black/50 rounded-lg border border-border-dark transition-colors">
                <span className="font-bold text-white text-xs sm:text-sm block">{ex.name}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest block mt-1 font-mono">
                  По умолчанию: <span className="text-accent-lime font-black">{ex.defaultWeight} кг</span> × {ex.defaultReps} × {ex.defaultSets} подх.
                </span>
              </div>
            ))}
          </div>

          {/* Add exercise definition to database */}
          <div className="pt-2 border-t border-border-dark">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Новое упражнение в справочник</h3>
            
            <form onSubmit={handleCreateExercise} className="space-y-3">
              <div>
                <input
                  type="text"
                  required
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  placeholder="Название упражнения"
                  className="w-full bg-input-dark border border-border-dark text-white text-base md:text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-accent-lime/50 placeholder-gray-600 min-h-[42px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1 text-center">Вес (кг)</label>
                  <input
                    type="number"
                    step="0.25"
                    required
                    value={newExWeight}
                    onChange={(e) => setNewExWeight(parseFloat(e.target.value) || 0)}
                    className="w-full bg-input-dark border border-border-dark text-white text-base md:text-sm rounded-lg px-2 py-2.5 font-mono text-center focus:outline-none focus:ring-1 focus:ring-accent-lime/50 min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1 text-center">Повторы</label>
                  <input
                    type="number"
                    required
                    value={newExReps}
                    onChange={(e) => setNewExReps(parseInt(e.target.value) || 0)}
                    className="w-full bg-input-dark border border-border-dark text-white text-base md:text-sm rounded-lg px-2 py-2.5 font-mono text-center focus:outline-none focus:ring-1 focus:ring-accent-lime/50 min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1 text-center">Подходы</label>
                  <input
                    type="number"
                    required
                    value={newExSets}
                    onChange={(e) => setNewExSets(parseInt(e.target.value) || 0)}
                    className="w-full bg-input-dark border border-border-dark text-white text-base md:text-sm rounded-lg px-2 py-2.5 font-mono text-center focus:outline-none focus:ring-1 focus:ring-accent-lime/50 min-h-[42px]"
                  />
                </div>
              </div>

              {exError && <p className="text-[11px] text-rose-400 font-semibold">{exError}</p>}

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 bg-accent-lime hover:bg-lime-400 text-black font-bold uppercase tracking-wider text-xs py-3 rounded-lg transition-colors shadow-md cursor-pointer min-h-[42px]"
              >
                <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Добавить в справочник</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
