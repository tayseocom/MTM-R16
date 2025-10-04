import { nanoid } from 'nanoid';

/**
 * Generate a song ID with format: sng_<ulid>
 */
export function generateSongId(): string {
  return `sng_${nanoid()}`;
}

/**
 * Generate a song step ID with format: sst_<ulid>
 */
export function generateStepId(): string {
  return `sst_${nanoid()}`;
}
