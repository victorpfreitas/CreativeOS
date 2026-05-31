// ============================================================
// Made by Human — Server-side Firestore (Firebase Admin SDK)
// ============================================================
//
// The API runs server-side and must bypass Firestore security rules so the
// client rules can require authentication without breaking automations.
// We use the Admin SDK (service account) here.
//
// To keep the call sites in run.ts / source-capture.ts unchanged, this module
// re-exports thin wrappers that mimic the modular client SDK surface
// (collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, Timestamp).
//
// Credentials are read from FIREBASE_SERVICE_ACCOUNT (a JSON string or a
// base64-encoded JSON). Falls back to Application Default Credentials.

import { initializeApp, getApps, getApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp as AdminTimestamp, type Firestore, type Query, type DocumentReference, type CollectionReference } from 'firebase-admin/firestore';

function loadCredential() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return applicationDefault();
  // Support both raw JSON and base64-encoded JSON.
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const parsed = JSON.parse(json);
  // Normalize escaped newlines in the private key when provided inline.
  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return cert(parsed);
}

const app: App = getApps().length > 0
  ? getApp()
  : initializeApp({
      credential: loadCredential(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || undefined,
    });

const firestore: Firestore = getFirestore(app);

// ---- Compatibility layer mirroring the modular client SDK ----

export const serverDb = firestore;

export function collection(db: Firestore, path: string): CollectionReference {
  return db.collection(path);
}

export function doc(db: Firestore, path: string, id: string): DocumentReference {
  return db.collection(path).doc(id);
}

type WhereClause = { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown };

export function where(field: string, op: FirebaseFirestore.WhereFilterOp, value: unknown): WhereClause {
  return { field, op, value };
}

export function query(ref: CollectionReference | Query, ...clauses: WhereClause[]): Query {
  return clauses.reduce<Query>((acc, c) => acc.where(c.field, c.op, c.value), ref as Query);
}

export async function getDocs(q: CollectionReference | Query) {
  const snap = await (q as Query).get();
  return { docs: snap.docs };
}

export async function getDoc(ref: DocumentReference) {
  const snap = await ref.get();
  // The modular client SDK exposes exists() as a method; the Admin SDK uses a
  // boolean property. Wrap it so existing call sites (snap.exists()) keep working.
  return {
    id: snap.id,
    exists: () => snap.exists,
    data: () => snap.data(),
  };
}

export async function addDoc(ref: CollectionReference, data: Record<string, unknown>) {
  return ref.add(data);
}

export async function updateDoc(ref: DocumentReference, data: Record<string, unknown>) {
  return ref.update(data);
}

export const Timestamp = AdminTimestamp;
