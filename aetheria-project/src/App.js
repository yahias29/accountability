import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, where, doc, deleteDoc, serverTimestamp, setDoc, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { CheckCircle2, Plus, Trash2, Zap, BookOpen, Heart, BrainCircuit, Briefcase, Star, MessageSquare, Sun, Moon, BarChart2, Book, ChevronLeft, ChevronRight, ListChecks, CalendarDays, Search, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, CartesianGrid } from 'recharts';

// --- Firebase Configuration ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-aetheria-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Helper Functions ---
const formatDate = (date) => date.toISOString().split('T')[0];
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

// --- Initial Data ---
const initialChecklistItems = [
    "5 prayers", "Pushup", "Take daily supplements", "S.C", "Gym / exercise", "20 min sunlight",
    "3 breath work", "Morning Water chug", "Daily luc lesson", "Sleep 7-9 hours",
    "Respect food regime 7-7", "N8n demo building freelance", "Regressive pushup",
    "Social media free", "Sugar free", "Posture exercises", "Plan your next day",
    "Daily tate success primer motivation", "Learn something new"
];

// --- Category Configuration ---
const categoryConfig = {
    'Task': { icon: CheckCircle2, color: '#38bdf8' }, 'Habit': { icon: Zap, color: '#f59e0b' }, 'Learning': { icon: BookOpen, color: '#818cf8' }, 'Health': { icon: Heart, color: '#f43f5e' }, 'Insight': { icon: BrainCircuit, color: '#2dd4bf' }, 'Work': { icon: Briefcase, color: '#94a3b8' }, 'Reflection': { icon: MessageSquare, color: '#a78bfa' }
};

// --- Child Components ---
const StarRating = React.memo(({ rating, setRating, isInteractive = true }) => (
    <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`w-5 h-5 transition-all duration-200 ${star <= rating ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'} ${isInteractive ? 'cursor-pointer hover:text-yellow-300 hover:scale-110' : ''}`} fill={star <= rating ? 'currentColor' : 'none'} onClick={() => isInteractive && setRating(star)} />)}
    </div>
));

const CalendarModal = React.memo(({ isOpen, onClose, setSelectedDate, loggedDays }) => {
    if (!isOpen) return null;
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const today = new Date();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });

    const changeMonth = (offset) => {
        const newDate = new Date(currentYear, currentMonth + offset);
        setCurrentMonth(newDate.getMonth());
        setCurrentYear(newDate.getFullYear());
    };

    const handleDateClick = (day) => {
        const newDate = new Date(currentYear, currentMonth, day);
        if (newDate > today) return;
        setSelectedDate(newDate);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft /></button>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{monthName} {currentYear}</h3>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight /></button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
                    {Array.from({ length: daysInMonth }).map((_, day) => {
                        const date = day + 1;
                        const fullDate = new Date(currentYear, currentMonth, date);
                        const isToday = formatDate(fullDate) === formatDate(today);
                        const hasLog = loggedDays.has(formatDate(fullDate));
                        const isFuture = fullDate > today;
                        return (
                            <button key={date} onClick={() => handleDateClick(date)} disabled={isFuture} className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${isToday ? 'border-2 border-sky-500' : ''} ${hasLog ? 'bg-sky-100 dark:bg-sky-800/50 font-bold text-sky-600 dark:text-sky-300' : ''} ${isFuture ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                {date}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

const EntryItem = React.memo(({ entry, handleDeleteEntry }) => {
    const config = categoryConfig[entry.category] || { icon: CheckCircle2, color: '#94a3b8' };
    return (<div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-lg p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50 flex items-start space-x-4"><div className="mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${config.color}20` }}><config.icon className="w-5 h-5" style={{ color: config.color }} /></div><div className="flex-grow"><p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{entry.text}</p><div className="flex items-center justify-between mt-2 text-sm text-slate-500 dark:text-slate-400"><div className="flex items-center space-x-2"><span className="font-medium">{entry.category}</span><span>&middot;</span><StarRating rating={entry.rating} isInteractive={false} /></div><span className="text-xs">{entry.timestamp ? new Date(entry.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : formatDate(new Date(entry.date))}</span></div></div><button onClick={() => handleDeleteEntry(entry.id)} className="flex-shrink-0 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="Delete entry"><Trash2 className="w-4 h-4" /></button></div>);
});

const EntryForm = React.memo(({ handleAddEntry, newEntryText, setNewEntryText, newEntryCategory, setNewEntryCategory, newEntryRating, setNewEntryRating, setShowForm }) => (
    <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 mb-8">
        <form onSubmit={handleAddEntry}>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Log a New Entry</h2>
            <textarea className="w-full p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none transition" rows="3" placeholder="What did you accomplish? Use #tags to organize..." value={newEntryText} onChange={(e) => setNewEntryText(e.target.value)} required></textarea>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div><label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Category</label><select value={newEntryCategory} onChange={(e) => setNewEntryCategory(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none transition">{Object.keys(categoryConfig).map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Rating / Impact</label><StarRating rating={newEntryRating} setRating={setNewEntryRating} /></div>
            </div>
            <div className="mt-6 flex items-center justify-end space-x-3"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancel</button><button type="submit" className="flex items-center justify-center px-6 py-2 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-slate-900 transition-transform transform hover:scale-105"><Plus className="w-5 h-5 mr-2" /> Add Entry</button></div>
        </form>
    </div>
));

// --- Main App Component ---
export default function App() {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    const [entries, setEntries] = useState([]);
    const [allTimeEntries, setAllTimeEntries] = useState([]);
    const [checklistItems, setChecklistItems] = useState([]);
    const [checklistHistory, setChecklistHistory] = useState({});
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    const [newEntryText, setNewEntryText] = useState('');
    const [newEntryCategory, setNewEntryCategory] = useState('Task');
    const [newEntryRating, setNewEntryRating] = useState(3);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [currentView, setCurrentView] = useState('checklist');
    const [theme, setTheme] = useState('dark');
    const [isCalendarOpen, setCalendarOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const loggedDays = useMemo(() => new Set(allTimeEntries.map(e => e.date)), [allTimeEntries]);

    useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);

    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            setDb(getFirestore(app));
            const unsubAuth = onAuthStateChanged(authInstance, async (user) => {
                if (user) { setUserId(user.uid); } 
                else { try { if (initialAuthToken) await signInWithCustomToken(authInstance, initialAuthToken); else await signInAnonymously(authInstance); } catch (e) { setError("Auth failed."); } }
                setIsAuthReady(true);
            });
            return () => unsubAuth();
        } catch (e) { setError("Service connection failed."); setIsLoading(false); }
    }, []);

    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        
        const setupInitialChecklist = async () => {
            const checklistCollection = collection(db, `/artifacts/${appId}/users/${userId}/checklist_items`);
            const snapshot = await getDocs(checklistCollection);
            if (snapshot.empty) {
                for (const itemText of initialChecklistItems) {
                    await addDoc(checklistCollection, { text: itemText, createdAt: serverTimestamp() });
                }
            }
        };
        setupInitialChecklist();

        const q = query(collection(db, `/artifacts/${appId}/users/${userId}/entries`), where("date", "==", formatDate(selectedDate)));
        const unsubEntries = onSnapshot(q, (snap) => { setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp?.toMillis() - a.timestamp?.toMillis())); setIsLoading(false); }, () => setError("Failed to load log entries."));
        const unsubAllEntries = onSnapshot(collection(db, `/artifacts/${appId}/users/${userId}/entries`), (snap) => setAllTimeEntries(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubChecklistItems = onSnapshot(query(collection(db, `/artifacts/${appId}/users/${userId}/checklist_items`)), (snap) => setChecklistItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.createdAt?.toMillis() - b.createdAt?.toMillis())));
        const unsubChecklistHistory = onSnapshot(collection(db, `/artifacts/${appId}/users/${userId}/checklist_history`), (snap) => { const history = {}; snap.forEach(d => { history[d.id] = d.data().completedItems || []; }); setChecklistHistory(history); });

        return () => { unsubEntries(); unsubAllEntries(); unsubChecklistItems(); unsubChecklistHistory(); };
    }, [isAuthReady, db, userId, selectedDate]);

    // --- Handlers ---
    const handleAddEntry = async (e) => { e.preventDefault(); if (!db || !userId || !newEntryText.trim()) return; try { await addDoc(collection(db, `/artifacts/${appId}/users/${userId}/entries`), { text: newEntryText.trim(), category: newEntryCategory, rating: newEntryRating, date: formatDate(new Date()), timestamp: serverTimestamp() }); setNewEntryText(''); setNewEntryRating(3); setNewEntryCategory('Task'); setShowForm(false); setSelectedDate(new Date()); } catch (err) { setError("Could not save entry."); } };
    const handleDeleteEntry = async (id) => { if (!db || !userId) return; try { await deleteDoc(doc(db, `/artifacts/${appId}/users/${userId}/entries`, id)); } catch (err) { setError("Could not delete entry."); } };
    const handleAddChecklistItem = async (text) => { if (!db || !userId) return; try { await addDoc(collection(db, `/artifacts/${appId}/users/${userId}/checklist_items`), { text, createdAt: serverTimestamp() }); } catch (err) { setError("Could not add item."); } };
    const handleDeleteChecklistItem = async (id) => { if (!db || !userId) return; try { await deleteDoc(doc(db, `/artifacts/${appId}/users/${userId}/checklist_items`, id)); } catch (err) { setError("Could not delete item."); } };
    const handleToggleChecklistItem = async (itemId, isCompleted) => { if (!db || !userId) return; const dateStr = formatDate(selectedDate); const docRef = doc(db, `/artifacts/${appId}/users/${userId}/checklist_history`, dateStr); try { await updateDoc(docRef, { completedItems: isCompleted ? arrayUnion(itemId) : arrayRemove(itemId) }); } catch (e) { if (e.code === 'not-found') await setDoc(docRef, { completedItems: [itemId] }); else setError("Could not update checklist."); } };

    // --- Views ---
    const LogView = () => {
        const filteredEntries = useMemo(() => {
            if (!searchTerm) return entries;
            return allTimeEntries.filter(entry => entry.text.toLowerCase().includes(searchTerm.toLowerCase())).sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        }, [searchTerm, entries, allTimeEntries]);

        return (
            <>
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder="Search all entries by keyword or #tag..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3 pl-10 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-full shadow-inner border border-slate-200/50 dark:border-slate-700/50 focus:ring-2 focus:ring-sky-500 focus:outline-none transition" />
                </div>
                { !searchTerm && !showForm && (<div className="text-center mb-8"><button onClick={() => setShowForm(true)} className="inline-flex items-center justify-center px-8 py-3 bg-sky-500 text-white font-bold rounded-full shadow-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-slate-800 transition-transform transform hover:scale-105"><Plus className="w-6 h-6 mr-2" /> Log Today's Progress</button></div>)}
                { showForm && <EntryForm {...{handleAddEntry, newEntryText, setNewEntryText, newEntryCategory, setNewEntryCategory, newEntryRating, setNewEntryRating, setShowForm}} /> }
                <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{searchTerm ? `Search Results for "${searchTerm}"` : "Log for Selected Date"}</h2>
                    {isLoading ? (<div className="text-center p-8 text-slate-500">Loading...</div>) : filteredEntries.length > 0 ? (<div className="space-y-4">{filteredEntries.map(entry => <EntryItem key={entry.id} entry={entry} handleDeleteEntry={handleDeleteEntry} />)}</div>) : (<div className="text-center p-8"><p className="text-slate-500 dark:text-slate-400">No entries found.</p></div>)}
                </div>
            </>
        );
    };

    const ChecklistView = () => {
        const [newItemText, setNewItemText] = useState('');
        const dailyChecklistStatus = checklistHistory[formatDate(selectedDate)] || [];
        const progress = checklistItems.length > 0 ? (dailyChecklistStatus.length / checklistItems.length) * 100 : 0;
        const onAddItem = (e) => { e.preventDefault(); if (newItemText.trim()) { handleAddChecklistItem(newItemText.trim()); setNewItemText(''); } };
        return (
            <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-1"><span className="text-sm font-medium text-slate-600 dark:text-slate-400">Daily Progress</span><span className="text-sm font-bold text-sky-600 dark:text-sky-400">{Math.round(progress)}%</span></div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5"><div className="bg-sky-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div></div>
                </div>
                <div className="space-y-3 mb-6">
                    {checklistItems.map(item => (<div key={item.id} className="flex items-center justify-between p-3 bg-slate-100/50 dark:bg-slate-900/20 rounded-lg"><label className="flex items-center space-x-3 cursor-pointer w-full"><input type="checkbox" checked={dailyChecklistStatus.includes(item.id)} onChange={(e) => handleToggleChecklistItem(item.id, e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-sky-500 focus:ring-sky-500" /><span className={`text-slate-700 dark:text-slate-200 ${dailyChecklistStatus.includes(item.id) ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>{item.text}</span></label><button onClick={() => handleDeleteChecklistItem(item.id)} className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1 rounded-full flex-shrink-0"><Trash2 className="w-4 h-4" /></button></div>))}
                </div>
                <form onSubmit={onAddItem} className="flex items-center gap-2"><input type="text" value={newItemText} onChange={(e) => setNewItemText(e.target.value)} placeholder="Add a new daily task..." className="flex-grow p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none transition" /><button type="submit" className="flex-shrink-0 p-2 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-slate-900"><Plus className="w-5 h-5" /></button></form>
            </div>
        );
    };

    const DashboardView = () => {
        const checklistProgressData = useMemo(() => {
            const data = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = formatDate(d);
                const completed = checklistHistory[dateStr]?.length || 0;
                const total = checklistItems.length;
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                data.push({ name: d.toLocaleDateString('default', { month: 'short', day: 'numeric' }), 'Completion %': percentage });
            }
            return data;
        }, [checklistHistory, checklistItems]);

        return (
            <div className="space-y-8">
                <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Checklist Progress (Last 30 Days)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={checklistProgressData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                            <XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                            <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} unit="%" domain={[0, 100]} />
                            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff' , border: '1px solid #334155'}} />
                            <Legend />
                            <Line type="monotone" dataKey="Completion %" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const WeeklyReviewView = () => {
        const last7Days = useMemo(() => Array.from({ length: 7 }).map((_, i) => formatDate(new Date(Date.now() - i * 86400000))), []);
        
        const reviewData = useMemo(() => {
            let completedCount = 0;
            let totalCount = 0;
            const categoryCounts = {};
            let totalRating = 0;
            let ratedEntries = 0;

            last7Days.forEach(date => {
                const completed = checklistHistory[date]?.length || 0;
                completedCount += completed;
                totalCount += checklistItems.length;
                
                allTimeEntries.filter(e => e.date === date).forEach(e => {
                    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
                    if (e.rating) { totalRating += e.rating; ratedEntries++; }
                });
            });

            const consistency = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
            const avgRating = ratedEntries > 0 ? (totalRating / ratedEntries).toFixed(1) : 'N/A';
            
            return { consistency, topCategory, avgRating };
        }, [last7Days, checklistHistory, checklistItems, allTimeEntries]);

        const motivationalQuote = useMemo(() => {
            const quotes = ["The secret of getting ahead is getting started.", "Well done is better than well said.", "You don't have to be great to start, but you have to start to be great.", "A year from now you may wish you had started today."];
            return quotes[new Date().getDay() % quotes.length];
        }, []);

        return (
            <div className="bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Your Weekly Review</h2>
                    <p className="text-slate-500 dark:text-slate-400">Insights from the last 7 days of your journey.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <div className="bg-slate-100/50 dark:bg-slate-800/50 p-6 rounded-xl"><h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">Checklist Consistency</h3><p className="text-4xl font-extrabold text-sky-500 mt-2">{reviewData.consistency}%</p></div>
                    <div className="bg-slate-100/50 dark:bg-slate-800/50 p-6 rounded-xl"><h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">Top Activity</h3><p className="text-4xl font-extrabold text-amber-500 mt-2">{reviewData.topCategory}</p></div>
                    <div className="bg-slate-100/50 dark:bg-slate-800/50 p-6 rounded-xl"><h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">Average Impact</h3><p className="text-4xl font-extrabold text-rose-500 mt-2 flex items-center justify-center gap-1">{reviewData.avgRating} <Star className="w-8 h-8 -mt-1"/></p></div>
                </div>
                <div className="text-center border-t border-slate-200/80 dark:border-slate-700/80 pt-6"><p className="text-lg italic text-slate-600 dark:text-slate-400">"{motivationalQuote}"</p></div>
            </div>
        );
    };

    // --- Render ---
    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen font-sans text-slate-700 dark:text-slate-300 transition-colors duration-500">
            <div className="fixed inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] dark:bg-slate-900 dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)]"></div>
            <CalendarModal isOpen={isCalendarOpen} onClose={() => setCalendarOpen(false)} setSelectedDate={setSelectedDate} loggedDays={loggedDays} />
            <div className="container mx-auto max-w-3xl p-4 sm:p-6">
                <header className="flex justify-between items-center my-8">
                    <div className="text-left"><h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight">Aetheria</h1><p className="mt-1 text-md text-slate-600 dark:text-slate-400">Your Daily Compass</p></div>
                    <div className="flex items-center space-x-1 sm:space-x-2 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-full">
                        <button onClick={() => setCurrentView('log')} className={`px-3 py-1.5 sm:px-4 rounded-full text-sm font-semibold flex items-center gap-2 ${currentView === 'log' ? 'bg-white dark:bg-slate-700 shadow' : 'hover:bg-white/50 dark:hover:bg-slate-700/50'} transition-all`}><Book className="w-4 h-4" /> Log</button>
                        <button onClick={() => setCurrentView('checklist')} className={`px-3 py-1.5 sm:px-4 rounded-full text-sm font-semibold flex items-center gap-2 ${currentView === 'checklist' ? 'bg-white dark:bg-slate-700 shadow' : 'hover:bg-white/50 dark:hover:bg-slate-700/50'} transition-all`}><ListChecks className="w-4 h-4" /> Checklist</button>
                        <button onClick={() => setCurrentView('dashboard')} className={`px-3 py-1.5 sm:px-4 rounded-full text-sm font-semibold flex items-center gap-2 ${currentView === 'dashboard' ? 'bg-white dark:bg-slate-700 shadow' : 'hover:bg-white/50 dark:hover:bg-slate-700/50'} transition-all`}><BarChart2 className="w-4 h-4" /> Dashboard</button>
                        <button onClick={() => setCurrentView('review')} className={`px-3 py-1.5 sm:px-4 rounded-full text-sm font-semibold flex items-center gap-2 ${currentView === 'review' ? 'bg-white dark:bg-slate-700 shadow' : 'hover:bg-white/50 dark:hover:bg-slate-700/50'} transition-all`}><Award className="w-4 h-4" /> Review</button>
                        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">{theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</button>
                    </div>
                </header>
                
                {error && <div className="bg-rose-100 dark:bg-rose-500/20 border-l-4 border-rose-500 text-rose-700 dark:text-rose-200 p-4 rounded-lg mb-6" role="alert">{error}</div>}

                { currentView !== 'review' && (
                    <div className="text-center mb-6">
                        <button onClick={() => setCalendarOpen(true)} className="font-bold text-xl text-slate-800 dark:text-white inline-flex items-center gap-2 group">
                            <CalendarDays className="w-6 h-6 text-slate-400 group-hover:text-sky-500 transition-colors" />
                            {selectedDate.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </button>
                    </div>
                )}

                <main>
                    {currentView === 'log' && <LogView />}
                    {currentView === 'dashboard' && <DashboardView />}
                    {currentView === 'checklist' && <ChecklistView />}
                    {currentView === 'review' && <WeeklyReviewView />}
                </main>

                <footer className="text-center mt-12 py-4 border-t border-slate-200/80 dark:border-slate-700/80"><p className="text-xs text-slate-400 dark:text-slate-500">{isAuthReady && userId ? `User ID: ${userId}` : 'Initializing...'}</p></footer>
            </div>
        </div>
    );
}
