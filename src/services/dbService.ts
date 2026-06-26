/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Athlete, Exercise, Workout, LogEntry, ClosedExercise } from '../types';

// Seed initial data
export const SEED_ATHLETES: Athlete[] = [
  { id: 'petya', name: 'Петя' },
  { id: 'roma', name: 'Рома' },
];

export const SEED_EXERCISES: Exercise[] = [
  { id: 'ex_lat_pull', name: 'Тяга блока вертикаль', defaultWeight: 57, defaultReps: 13, defaultSets: 4, unit: 'кг' },
  { id: 'ex_lateral_raise', name: 'Отведение гантель в стороны', defaultWeight: 7, defaultReps: 12, defaultSets: 4, unit: 'кг' },
  { id: 'ex_dumbbell_press', name: 'Жим гантель', defaultWeight: 23.5, defaultReps: 15, defaultSets: 4, unit: 'кг' },
  { id: 'ex_bicep_ez', name: 'Бицепс EZ', defaultWeight: 7.5, defaultReps: 12, defaultSets: 5, unit: 'кг' },
  { id: 'ex_bench_press', name: 'Жим штанги лежа', defaultWeight: 60, defaultReps: 14, defaultSets: 6, unit: 'кг' },
  { id: 'ex_bicep_femoralis', name: 'Бицепс бедра', defaultWeight: 70, defaultReps: 14, defaultSets: 6, unit: 'кг' },
  { id: 'ex_dips', name: 'Брусья', defaultWeight: 0, defaultReps: 14, defaultSets: 6, unit: 'кг' },
];

export const SEED_WORKOUTS: Workout[] = [
  {
    id: 'workout_1',
    name: 'Тренировка 1 (Вертикаль, Отведения, Жим гантелей, Бицепс EZ)',
    exerciseIds: ['ex_lat_pull', 'ex_lateral_raise', 'ex_dumbbell_press', 'ex_bicep_ez'],
  },
  {
    id: 'workout_2',
    name: 'Тренировка 2 (Жим штанги лежа, Бицепс бедра, Брусья)',
    exerciseIds: ['ex_bench_press', 'ex_bicep_femoralis', 'ex_dips'],
  }
];

// Historical logs to show "Previous results" out of the box
export const SEED_LOGS: LogEntry[] = [
  // Workout 1:
  { id: 'log_w1_lat_petya', date: '2026-06-24', workoutId: 'workout_1', exerciseId: 'ex_lat_pull', athleteId: 'petya', weight: 57, reps: 13, sets: 2 },
  { id: 'log_w1_lat_roma', date: '2026-06-24', workoutId: 'workout_1', exerciseId: 'ex_lat_pull', athleteId: 'roma', weight: 57, reps: 13, sets: 6 },
  
  { id: 'log_w1_latraise_petya', date: '2026-06-24', workoutId: 'workout_1', exerciseId: 'ex_lateral_raise', athleteId: 'petya', weight: 7, reps: 12, sets: 6 },
  
  { id: 'log_w1_dbpress_roma', date: '2026-06-24', workoutId: 'workout_1', exerciseId: 'ex_dumbbell_press', athleteId: 'roma', weight: 23.5, reps: 15, sets: 6 },
  
  { id: 'log_w1_bi_roma', date: '2026-06-24', workoutId: 'workout_1', exerciseId: 'ex_bicep_ez', athleteId: 'roma', weight: 7.5, reps: 12, sets: 5 },
  { id: 'log_w1_bi_petya', date: '2026-06-24', workoutId: 'workout_1', exerciseId: 'ex_bicep_ez', athleteId: 'petya', weight: 6.25, reps: 12, sets: 5 },

  // Workout 2:
  { id: 'log_w2_bench_petya', date: '2026-06-24', workoutId: 'workout_2', exerciseId: 'ex_bench_press', athleteId: 'petya', weight: 45, reps: 14, sets: 6 },
  { id: 'log_w2_bench_roma', date: '2026-06-24', workoutId: 'workout_2', exerciseId: 'ex_bench_press', athleteId: 'roma', weight: 60, reps: 14, sets: 3 },
  
  { id: 'log_w2_fem_roma', date: '2026-06-24', workoutId: 'workout_2', exerciseId: 'ex_bicep_femoralis', athleteId: 'roma', weight: 70, reps: 14, sets: 6 },
  { id: 'log_w2_fem_petya', date: '2026-06-24', workoutId: 'workout_2', exerciseId: 'ex_bicep_femoralis', athleteId: 'petya', weight: 70, reps: 14, sets: 6 },
  
  { id: 'log_w2_dips_petya', date: '2026-06-24', workoutId: 'workout_2', exerciseId: 'ex_dips', athleteId: 'petya', weight: 2, reps: 14, sets: 6 },
  { id: 'log_w2_dips_roma', date: '2026-06-24', workoutId: 'workout_2', exerciseId: 'ex_dips', athleteId: 'roma', weight: 0, reps: 14, sets: 6 },
];

export const SEED_CLOSED: ClosedExercise[] = [
  { athleteId: 'roma', exerciseId: 'ex_lateral_raise', closedAt: '2026-06-24' },
  { athleteId: 'petya', exerciseId: 'ex_dumbbell_press', closedAt: '2026-06-24' },
];

const STORAGE_KEYS = {
  ATHLETES: 'gym_tracker_athletes_v2',
  EXERCISES: 'gym_tracker_exercises_v2',
  WORKOUTS: 'gym_tracker_workouts_v2',
  LOGS: 'gym_tracker_logs_v2',
  CLOSED: 'gym_tracker_closed_v2',
};

export function loadInitialData() {
  const getOrSet = <T>(key: string, seed: T): T => {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(`Error parsing localStorage for ${key}`, e);
      }
    }
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  };

  return {
    athletes: getOrSet<Athlete[]>(STORAGE_KEYS.ATHLETES, SEED_ATHLETES),
    exercises: getOrSet<Exercise[]>(STORAGE_KEYS.EXERCISES, SEED_EXERCISES),
    workouts: getOrSet<Workout[]>(STORAGE_KEYS.WORKOUTS, SEED_WORKOUTS),
    logs: getOrSet<LogEntry[]>(STORAGE_KEYS.LOGS, SEED_LOGS),
    closed: getOrSet<ClosedExercise[]>(STORAGE_KEYS.CLOSED, SEED_CLOSED),
  };
}

export function saveAllData(data: {
  athletes: Athlete[];
  exercises: Exercise[];
  workouts: Workout[];
  logs: LogEntry[];
  closed: ClosedExercise[];
}) {
  localStorage.setItem(STORAGE_KEYS.ATHLETES, JSON.stringify(data.athletes));
  localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(data.exercises));
  localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(data.workouts));
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs));
  localStorage.setItem(STORAGE_KEYS.CLOSED, JSON.stringify(data.closed));
}

// Helper to find the latest log entry before a certain date for an athlete and exercise
export function findPreviousResult(
  logs: LogEntry[],
  athleteId: string,
  exerciseId: string,
  currentDate: string
): LogEntry | null {
  // Sort logs descending by date to find the latest
  const sorted = [...logs]
    .filter(log => log.athleteId === athleteId && log.exerciseId === exerciseId && log.date < currentDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  
  return sorted[0] || null;
}

// Convert data to CSV formatted as Sheets rows
export function generateSheetCSV(sheetName: string, data: any[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const rows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        let cell = row[header];
        if (cell === undefined || cell === null) return '';
        if (Array.isArray(cell)) {
          // Join arrays (like exerciseIds) with commas, wrap in quotes
          return `"${cell.join(',')}"`;
        }
        // If string contains comma, quote it
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('\n') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
  ];
  
  return rows.join('\n');
}
