import React, { useState, useEffect, useMemo } from 'react';

// Firebase (modular SDK)
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  deleteDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDocs,
} from 'firebase/firestore';

// Icons and charts (as you had)
import {
  CheckCircle2,
  Plus,
  Trash2,
  Zap,
  BookOpen,
  Heart,
  BrainCircuit,
  Briefcase,
  Star,
  MessageSquare,
  Sun,
  Moon,
  BarChart2,
  Book,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  CalendarDays,
  Search,
  Award,
} from 'lucide-react';

import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from 'recharts';

// =========================
// Firebase Configuration
// =========================

// Strict loader: tries CRA build-time env first, then optional window.__FIREBASE_CONFIG_JSON for local preview
function loadFirebaseConfig() {
  const cfgFromEnv = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  };

  const allPresent =
    cfgFromEnv.apiKey &&
    cfgFromEnv.authDomain &&
    cfgFromEnv.projectId &&
    cfgFromEnv.storageBucket &&
    cfgFromEnv.messagingSenderId &&
    cfgFromEnv.appId;

  if (allPresent) return cfgFromEnv;

  // Optional local preview fallback if you were injecting a JSON string at runtime:
  if (typeof window !== 'undefined' && typeof window.__FIREBASE_CONFIG_JSON === 'string') {
    try {
      const parsed = JSON.parse(window.__FIREBASE_CONFIG_JSON);
      const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
      const missing = required.filter((k) => !parsed[k]);
      if (missing.length) {
        throw new Error('Missing keys in __FIREBASE_CONFIG_JSON: ' + missing.join(', '));
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse window.__FIREBASE_CONFIG_JSON', e);
    }
  }

  // Build explicit error with which env vars are missing
  const requiredMap = {
    REACT_APP_FIREBASE_API_KEY: cfgFromEnv.apiKey,
    REACT_APP_FIREBASE_AUTH_DOMAIN: cfgFromEnv.authDomain,
    REACT_APP_FIREBASE_PROJECT_ID: cfgFromEnv.projectId,
    REACT_APP_FIREBASE_STORAGE_BUCKET: cfgFromEnv.storageBucket,
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: cfgFromEnv.messagingSenderId,
    REACT_APP_FIREBASE_APP_ID: cfgFromEnv.appId,
  };
  const missingEnv = Object.keys(requiredMap).filter((k) => !requiredMap[k]);
  throw new Error(
    'Firebase configuration not found or incomplete. Missing: ' +
      missingEnv.join(', ') +
      '. Define these in Netlify Site settings > Build & deploy > Environment (Production) and redeploy.'
  );
}

let firebaseConfig;
try {
  firebaseConfig = loadFirebaseConfig();
  // Optional debug (remove after confirming once in production):
  // console.log('Firebase projectId:', firebaseConfig.projectId);
} catch (error) {
  console.error('Could not load Firebase configuration:', error);
  // Re-throw to surface the exact missing keys in your existing error boundary/logs
  throw error;
}

// Initialize Firebase once
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================
// Helpers and constants
// =========================

const formatDate = (date) => date.toISOString().split('T');
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const initialChecklistItems = [
  '5 prayers',
  'Pushup',
  'Take daily supplements',
  'S.C',
  'Gym / exercise',
  '20 min sunlight',
  '3 breath work',
  'Morning Water chug',
  'Daily luc lesson',
  'Sleep 7-9 hours',
  'Respect food regime 7-7',
  'N8n demo building freelance',
  'Regressive pushup',
  'Social media free',
  'Sugar free',
  'Posture exercises',
  'Plan your next day',
  'Daily tate success primer motivation',
  'Learn something new',
];

const categoryConfig = {
  Task: { icon: CheckCircle2, color: '#38bdf8' },
  Habit: { icon: Zap, color: '#f59e0b' },
  Learning: { icon: BookOpen, color: '#818cf8' },
  Health: { icon: Heart, color: '#f43f5e' },
  Insight: { icon: BrainCircuit, color: '#2dd4bf' },
  Work: { icon: Briefcase, color: '#94a3b8' },
  Reflection: { icon: MessageSquare, color: '#a78bfa' },
};

// Example: a simple star rating component you had (simplified)
const StarRating = React.memo(({ rating, setRating, isInteractive = true }) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex">
      {stars.map((s) => (
        <button
          key={s}
          onClick={() => isInteractive && setRating(s)}
          className={`mx-0.5 ${s <= rating ? 'text-yellow-400' : 'text-gray-400'}`}
          aria-label={`Set rating to ${s}`}
          type="button"
        >
          <Star size={18} fill={s <= rating ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
});

// =========================
// Main App Component
// =========================

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [todayDate] = useState(formatDate(new Date()));

  // Checklist state
  const [checklistItems, setChecklistItems] = useState(initialChecklistItems);
  const [checkedMap, setCheckedMap] = useState({}); // { itemName: true/false }
  const [newItem, setNewItem] = useState('');

  // Journal entries, ratings, etc.
  const [entries, setEntries] = useState([]);
  const [entryText, setEntryText] = useState('');
  const [entryCategory, setEntryCategory] = useState('Task');
  const [rating, setRating] = useState(0);

  // Theme
  const [theme, setTheme] = useState('light');

  // Date navigation for a calendar-like view
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // -------------------------
  // Anonymous Auth Bootstrap
  // -------------------------
  useEffect(() => {
    let unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setAuthReady(true);
      } else {
        try {
          const res = await signInAnonymously(auth);
          setUser(res.user);
          setAuthReady(true);
        } catch (e) {
          console.error('Anonymous sign-in failed:', e);
          setAuthReady(false);
        }
      }
    });
    return () => unsub && unsub();
  }, []);

  // -------------------------
  // Firestore listeners (examples)
  // -------------------------

  // Example: load today's checklist state for the user
  useEffect(() => {
    if (!authReady || !user) return;
    const colRef = collection(db, 'checklists');
    const q = query(colRef, where('uid', '==', user.uid), where('date', '==', todayDate));
    const unsub = onSnapshot(q, (snap) => {
      let docData = null;
      snap.forEach((d) => {
        docData = { id: d.id, ...d.data() };
      });
      if (docData && docData.items) {
        setChecklistItems((prev) => {
          // Merge known items with saved order (simple approach: prefer saved items if present)
          if (Array.isArray(docData.items) && docData.items.length) return docData.items;
          return prev;
        });
        setCheckedMap(docData.checkedMap || {});
      } else {
        // No doc today; default initial list, unchecked
        setCheckedMap({});
      }
    });
    return () => unsub();
  }, [authReady, user, todayDate]);

  // Example: load journal entries for the user (last 7 days or all, adjust to your needs)
  useEffect(() => {
    if (!authReady || !user) return;
    const colRef = collection(db, 'entries');
    const q = query(colRef, where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      // Sort by timestamp desc if exists
      arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setEntries(arr);
    });
    return () => unsub();
  }, [authReady, user]);

  // -------------------------
  // Actions
  // -------------------------

  const saveChecklist = async () => {
    if (!user) return;
    const colRef = collection(db, 'checklists');
    // find doc for today for this user
    const qry = query(colRef, where('uid', '==', user.uid), where('date', '==', todayDate));
    const snap = await getDocs(qry);
    let existingId = null;
    snap.forEach((d) => {
      existingId = d.id;
    });

    const data = {
      uid: user.uid,
      date: todayDate,
      items: checklistItems,
      checkedMap,
      updatedAt: serverTimestamp(),
    };

    if (existingId) {
      await updateDoc(doc(db, 'checklists', existingId), data);
    } else {
      await addDoc(colRef, { ...data, createdAt: serverTimestamp() });
    }
  };

  const toggleCheck = (item) => {
    setCheckedMap((prev) => {
      const next = { ...prev, [item]: !prev[item] };
      return next;
    });
  };

  const addChecklistItem = () => {
    const name = newItem.trim();
    if (!name) return;
    if (checklistItems.includes(name)) return;
    setChecklistItems((prev) => [...prev, name]);
    setNewItem('');
  };

  const removeChecklistItem = (item) => {
    setChecklistItems((prev) => prev.filter((x) => x !== item));
    setCheckedMap((prev) => {
      const copy = { ...prev };
      delete copy[item];
      return copy;
    });
  };

  const addEntry = async () => {
    if (!user) return;
    const text = entryText.trim();
    if (!text && !rating) return;
    const colRef = collection(db, 'entries');
    await addDoc(colRef, {
      uid: user.uid,
      text,
      category: entryCategory,
      rating: rating || null,
      createdAt: serverTimestamp(),
      day: todayDate,
    });
    setEntryText('');
    setRating(0);
  };

  const deleteEntry = async (id) => {
    if (!id) return;
    await deleteDoc(doc(db, 'entries', id));
  };

  // -------------------------
  // Derived data (examples)
  // -------------------------

  const checkedCount = useMemo(
    () => Object.values(checkedMap).filter(Boolean).length,
    [checkedMap]
  );

  const totalCount = useMemo(() => checklistItems.length, [checklistItems]);

  // Example review data
  const reviewData = useMemo(() => {
    const consistency = totalCount ? Math.round((checkedCount / totalCount) * 100) : 0;
    const topCategory = 'Habit';
    const avgRating =
      entries.length > 0
        ? (
            entries.reduce((acc, e) => acc + (e.rating || 0), 0) /
            Math.max(1, entries.filter((e) => e.rating).length)
          ).toFixed(1)
        : '0.0';
    return { consistency, topCategory, avgRating };
  }, [checkedCount, totalCount, entries]);

  const motivationalQuote = 'Keep going. Small disciplines repeated with consistency lead to great achievements.';

  // Calendar helpers
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIdx = getFirstDayOfMonth(year, month); // 0=Sun

  const prevMonth = () => {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  // Theme switch
  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  // Persist checklist changes when map/items change (optional debounce in real apps)
  useEffect(() => {
    if (!user) return;
    // simple auto-save — you can debounce if you prefer
    saveChecklist().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedMap, checklistItems, user]);

  // =========================
  // UI
  // =========================

  return (
    <div className={theme === 'dark' ? 'bg-gray-900 text-white min-h-screen' : 'bg-gray-50 text-gray-900 min-h-screen'}>
      <header className="p-4 flex items-center justify-between border-b">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ListChecks /> Aetheria — Daily Accountability
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="px-3 py-1 rounded border">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="text-xs opacity-70">
            {user ? `Anon UID: ${user.uid.slice(0, 6)}…` : 'Connecting…'}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 grid md:grid-cols-2 gap-6">
        {/* Checklist Panel */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 /> Today&apos;s Checklist ({checkedCount}/{totalCount})
          </h2>

          <div className="space-y-2">
            {checklistItems.map((item) => (
              <label key={item} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!checkedMap[item]}
                    onChange={() => toggleCheck(item)}
                    className="h-4 w-4"
                  />
                  <span>{item}</span>
                </div>
                <button
                  onClick={() => removeChecklistItem(item)}
                  className="text-red-500 hover:text-red-600"
                  aria-label={`Remove ${item}`}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </label>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add new item"
              className="flex-1 px-3 py-2 border rounded"
            />
            <button onClick={addChecklistItem} className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-1">
              <Plus size={16} /> Add
            </button>
          </div>
        </section>

        {/* Journal Panel */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MessageSquare /> Quick Journal
          </h2>

          <div className="mb-2">
            <select
              className="px-3 py-2 border rounded"
              value={entryCategory}
              onChange={(e) => setEntryCategory(e.target.value)}
            >
              {Object.keys(categoryConfig).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={entryText}
            onChange={(e) => setEntryText(e.target.value)}
            placeholder="What did you do/learn/feel?"
            className="w-full h-24 p-3 border rounded mb-2"
          />

          <div className="flex items-center justify-between">
            <StarRating rating={rating} setRating={setRating} />
            <button onClick={addEntry} className="px-3 py-2 bg-green-600 text-white rounded flex items-center gap-1" type="button">
              <Plus size={16} /> Save
            </button>
          </div>

          <div className="mt-4 divide-y">
            {entries.length === 0 ? (
              <div className="text-sm opacity-70 p-2">No entries yet.</div>
            ) : (
              entries.map((e) => (
                <div key={e.id} className="py-2 flex items-start justify-between">
                  <div>
                    <div className="text-sm">
                      <span className="font-medium">{e.category || 'Entry'}</span>{' '}
                      <span className="opacity-60">· {e.day || 'today'}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{e.text}</div>
                    {e.rating ? (
                      <div className="text-xs mt-1 opacity-70">Rating: {e.rating}/5</div>
                    ) : null}
                  </div>
                  <button
                    onClick={() => deleteEntry(e.id)}
                    className="text-red-500 hover:text-red-600"
                    aria-label="Delete entry"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Calendar/Overview */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays /> Overview
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 rounded border" type="button">
                <ChevronLeft />
              </button>
              <div className="min-w-[120px] text-center">
                {new Date(year, month, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </div>
              <button onClick={nextMonth} className="p-1 rounded border" type="button">
                <ChevronRight />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayIdx }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDate(new Date(year, month, day));
              const isToday = dateStr === todayDate;
              return (
                <div
                  key={dateStr}
                  className={`border rounded p-2 h-20 ${isToday ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}
                >
                  <div className="text-xs opacity-70">{day}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Insights */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow md:col-span-2">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BarChart2 /> Weekly Insights
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-3 rounded border">
              <div className="text-sm opacity-70">Consistency</div>
              <div className="text-2xl font-semibold">{reviewData.consistency}%</div>
            </div>
            <div className="p-3 rounded border">
              <div className="text-sm opacity-70">Top Category</div>
              <div className="text-2xl font-semibold">{reviewData.topCategory}</div>
            </div>
            <div className="p-3 rounded border">
              <div className="text-sm opacity-70">Avg Rating</div>
              <div className="text-2xl font-semibold">{reviewData.avgRating}</div>
            </div>
          </div>

          <div className="mt-4 text-sm italic opacity-80">"{motivationalQuote}"</div>
        </section>
      </main>
    </div>
  );
}
