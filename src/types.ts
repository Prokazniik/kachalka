/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Athlete {
  id: string;
  name: string;
}

export interface Exercise {
  id: string;
  name: string;
  defaultWeight: number;
  defaultReps: number;
  defaultSets: number;
  unit: string;
}

export interface Workout {
  id: string;
  name: string;
  exerciseIds: string[]; // Ordered list of exercise IDs
}

export interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  workoutId: string;
  exerciseId: string;
  athleteId: string;
  weight: number;
  reps: number;
  sets: number; // Sub-sets are stored as a single integer (e.g. 5) representing rounds/sets
}

export interface ClosedExercise {
  athleteId: string;
  exerciseId: string;
  closedAt: string; // YYYY-MM-DD
}
