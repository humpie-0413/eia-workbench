import { customAlphabet } from 'nanoid';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export const newProjectId = customAlphabet(ALPHABET, 12);
export const newUploadId = customAlphabet(ALPHABET, 12);
export const newR2Suffix = customAlphabet(ALPHABET, 16);
export const newJti = customAlphabet(ALPHABET, 21);
