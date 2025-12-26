
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// --- TYPES ---
type ExerciseType = 'fill' | 'mcq' | 'tf';

interface Sentence {
  en: string;
  vi: string;
}

interface Question {
  id: number;
  text: string;
  options?: string[];
  answer: string | boolean;
  type: ExerciseType;
  hint?: string;
}

interface Unit {
  id: number;
  title: string;
  reading: Sentence[];
  exercises: {
    fill: Question[];
    mcq: Question[];
    tf: Question[];
  };
}

type AppState = 'welcome' | 'selector' | 'reading' | 'exercise' | 'result';

// --- DATA GENERATOR ---
const generateUnits = (): Unit[] => {
  const titles = [
    "Hello & Friends", "Our Names", "Our School Garden", "My Busy Family", "Fun Hobbies",
    "My Dream House", "Classroom Objects", "My Wonderful Body", "Colors Around Us", "My Lovely Pets",
    "Yummy Food", "Favorite Drinks", "My Clothes", "My Daily Routine", "The Weather",
    "My Toy Box", "At The Zoo", "Transportation", "My Feelings", "The Four Seasons"
  ];

  const readingContent = [
    [
      { en: "Hello! My name is Mai.", vi: "Xin chào! Tên tớ là Mai." },
      { en: "I am eight years old.", vi: "Tớ tám tuổi." },
      { en: "This is my friend, Nam.", vi: "Đây là bạn của tớ, Nam." },
      { en: "He is nine years old.", vi: "Cậu ấy chín tuổi." },
      { en: "We go to school together every morning.", vi: "Chúng tớ cùng nhau đi học mỗi sáng." }
    ],
    // Add more specialized reading if needed, but for size we'll use a varied template for the rest
  ];

  return titles.map((title, i) => {
    const id = i + 1;
    const reading = readingContent[i] || [
      { en: `Welcome to Unit ${id}: ${title}.`, vi: `Chào mừng đến với Bài ${id}: ${title}.` },
      { en: "Today we will learn many interesting things.", vi: "Hôm nay chúng ta sẽ học nhiều điều thú vị." },
      { en: "English is easy and fun to learn.", vi: "Tiếng Anh thật dễ và vui khi học." },
      { en: "I love practicing my English every day.", vi: "Tớ yêu việc luyện tập tiếng Anh mỗi ngày." },
      { en: "Let's start our lesson now!", vi: "Hãy bắt đầu bài học của chúng ta ngay bây giờ!" }
    ];

    return {
      id,
      title: `UNIT ${id}. ${title.toUpperCase()}`,
      reading,
      exercises: {
        fill: Array.from({ length: 5 }, (_, j) => ({
          id: id * 1000 + j,
          text: j === 0 ? "My (1) ______ is Mai." : j === 1 ? "I am (2) ______ years old." : `English is (3) ______.`,
          answer: j === 0 ? "name" : j === 1 ? "eight" : "fun",
          type: 'fill' as ExerciseType,
          hint: "name, eight, fun, school, happy"
        })),
        mcq: Array.from({ length: 5 }, (_, j) => ({
          id: id * 1000 + j + 10,
          text: `Question ${j + 1}: What is the main topic?`,
          options: [title, "Math", "Music", "Science"],
          answer: title,
          type: 'mcq' as ExerciseType
        })),
        tf: Array.from({ length: 5 }, (_, j) => ({
          id: id * 1000 + j + 20,
          text: `Unit ${id} is about ${title}.`,
          answer: true,
          type: 'tf' as ExerciseType
        }))
      }
    };
  });
};

const UNITS = generateUnits();

// --- COMPONENTS ---

const App: React.FC = () => {
  const [userName, setUserName] = useState<string>(localStorage.getItem('kid_name') || "");
  const [screen, setScreen] = useState<AppState>('welcome');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const [showTranslation, setShowTranslation] = useState<boolean>(true);
  const [userAnswers, setUserAnswers] = useState<Record<number, string | boolean>>({});
  const [score, setScore] = useState<number>(0);
  const [readRate, setReadRate] = useState<number>(0.9);
  
  const synth = window.speechSynthesis;

  useEffect(() => {
    const loadVoices = () => {
      const vList = synth.getVoices();
      const englishVoices = vList.filter(v => v.lang.toLowerCase().includes('en'));
      setVoices(englishVoices.length > 0 ? englishVoices : vList);
      const pref = englishVoices.find(v => v.name.includes('Google') && v.lang.includes('US')) || englishVoices[0] || vList[0];
      if (pref) setSelectedVoice(pref.name);
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }, []);

  const handleStart = (name: string) => {
    if (name.trim()) {
      localStorage.setItem('kid_name', name);
      setUserName(name);
      setScreen('selector');
    }
  };

  const speak = (index: number) => {
    if (!selectedUnit) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(selectedUnit.reading[index].en);
    const voice = voices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    utterance.rate = readRate;
    utterance.onstart = () => setCurrentSentenceIndex(index);
    utterance.onend = () => setCurrentSentenceIndex(-1);
    synth.speak(utterance);
  };

  const readAll = async () => {
    if (!selectedUnit) return;
    synth.cancel();
    for (let i = 0; i < selectedUnit.reading.length; i++) {
      speak(i);
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!synth.speaking) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }
  };

  const checkResults = () => {
    if (!selectedUnit) return;
    let correct = 0;
    const all = [
      ...selectedUnit.exercises.fill, 
      ...selectedUnit.exercises.mcq, 
      ...selectedUnit.exercises.tf
    ];
    all.forEach(q => {
      const uAns = userAnswers[q.id];
      if (typeof q.answer === 'string' && uAns?.toString().toLowerCase().trim() === q.answer.toLowerCase()) correct++;
      if (typeof q.answer === 'boolean' && uAns === q.answer) correct++;
    });
    setScore(Math.round((correct / all.length) * 100));
    setScreen('result');
  };

  const feedback = useMemo(() => {
    if (score < 50) return {
      emoji: "😕",
      title: "Cố lên nào!",
      msg: "Bạn cần cố gắng hơn! Hãy làm lại bài nhé để đạt kết quả tốt hơn.",
      color: "text-red-500",
      canProceed: false
    };
    if (score < 80) return {
      emoji: "👏",
      title: "Làm tốt lắm!",
      msg: "Bạn đã vượt qua bài tập rồi đấy. Cố gắng thêm chút nữa để đạt 100% nhé!",
      color: "text-blue-500",
      canProceed: true
    };
    return {
      emoji: "🏆",
      title: "Tuyệt vời!",
      msg: "Bạn là một ngôi sao tiếng Anh! Kết quả thật ấn tượng.",
      color: "text-green-500",
      canProceed: true
    };
  }, [score]);

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col font-medium select-none overflow-x-hidden">
      {/* Welcome Screen */}
      {screen === 'welcome' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-blue-900 border-b-8 border-blue-200 animate-bounce-slow">
            <h2 className="text-3xl font-black mb-2 text-center text-blue-600">English Star!</h2>
            <p className="text-center mb-6 font-bold text-gray-400 italic">Vừa học vừa chơi, giỏi tiếng Anh!</p>
            <input 
              type="text" 
              placeholder="Nhập tên của em..."
              className="w-full p-4 border-4 border-sky-50 rounded-2xl mb-6 focus:border-blue-400 outline-none text-xl font-bold text-center"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStart(userName)}
            />
            <button 
              onClick={() => handleStart(userName)}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition text-xl border-b-4 border-orange-700"
            >
              BẮT ĐẦU NGAY 🚀
            </button>
          </div>
        </div>
      )}

      {/* Main Header */}
      {screen !== 'welcome' && (
        <header className="bg-blue-600 text-white p-4 shadow-xl flex justify-between items-center sticky top-0 z-50 rounded-b-3xl border-b-4 border-blue-700">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { synth.cancel(); setScreen('selector'); }} 
              className="bg-white text-blue-600 p-2 rounded-2xl font-bold hover:bg-yellow-200 transition shadow-lg active:scale-90"
            >
              🏠 <span className="hidden sm:inline ml-1 text-sm">Trang chủ</span>
            </button>
            <div>
              <h1 className="text-sm sm:text-lg font-black truncate max-w-[120px] sm:max-w-none">
                {selectedUnit ? selectedUnit.title : "Chọn bài học"}
              </h1>
              <p className="text-[10px] font-bold opacity-80">Học sinh: {userName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] font-black uppercase tracking-widest">Tiến độ: {selectedUnit ? "15 câu" : "0"}</div>
            <div className="w-20 sm:w-32 h-2 bg-blue-800 rounded-full border border-white/20 overflow-hidden">
               <div className="h-full bg-yellow-400 transition-all w-1/3 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
        {screen === 'selector' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-10">
            {UNITS.map((u, i) => (
              <button 
                key={u.id}
                onClick={() => { setSelectedUnit(u); setScreen('reading'); setUserAnswers({}); synth.cancel(); }}
                className={`group bg-white p-5 rounded-3xl shadow-md border-b-8 hover:-translate-y-2 transition-all text-left overflow-hidden relative ${i % 3 === 0 ? 'border-blue-500' : i % 3 === 1 ? 'border-purple-500' : 'border-green-500'}`}
              >
                <div className="text-[10px] font-black opacity-30 uppercase mb-1">Unit {u.id}</div>
                <h3 className="text-sm font-black text-gray-700 uppercase leading-tight">{u.title.split('. ')[1]}</h3>
              </button>
            ))}
          </div>
        )}

        {screen === 'reading' && selectedUnit && (
          <div className="space-y-6 pb-10">
            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl border-4 border-white relative">
              <div className="flex flex-col gap-4 mb-6 border-b-2 border-dashed border-blue-50 pb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-blue-600">Bài đọc hiểu</h2>
                    <button 
                      onClick={() => setShowTranslation(!showTranslation)} 
                      className={`text-[10px] font-black px-3 py-1 rounded-full ${showTranslation ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {showTranslation ? 'TẮT DỊCH' : 'BẬT DỊCH'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={readAll} 
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg active:scale-95 transition border-b-2 border-green-700"
                    >
                      🔊 ĐỌC HẾT
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-xl">
                  <span className="text-[10px] font-black text-blue-400 uppercase ml-2">Giọng:</span>
                  <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="flex-1 bg-white border border-blue-200 rounded-lg px-2 py-1 text-xs font-bold text-blue-700"
                  >
                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                {selectedUnit.reading.map((s, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => speak(idx)} 
                    className={`p-4 rounded-2xl cursor-pointer transition-all ${currentSentenceIndex === idx ? 'bg-yellow-400 text-blue-900 shadow-lg ring-4 ring-yellow-200 translate-x-1' : 'hover:bg-blue-50'}`}
                  >
                    <div className="text-lg font-black leading-tight">{s.en}</div>
                    {showTranslation && <div className={`text-xs mt-1 font-bold ${currentSentenceIndex === idx ? 'text-blue-800' : 'text-gray-400'}`}>{s.vi}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setScreen('exercise')} 
                className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition text-xl border-b-4 border-indigo-800"
              >
                LÀM BÀI TẬP (15 CÂU) ✏️
              </button>
              <button 
                onClick={() => setScreen('selector')} 
                className="flex-1 bg-white text-gray-400 font-black py-5 rounded-3xl border-2 border-gray-100"
              >
                Đổi bài khác
              </button>
            </div>
          </div>
        )}

        {screen === 'exercise' && selectedUnit && (
          <div className="space-y-8 pb-32">
            <div className="bg-white p-6 rounded-[2rem] shadow-lg border-b-8 border-orange-100">
              <h3 className="text-lg font-black text-orange-500 mb-6 uppercase flex items-center gap-2">
                <span className="bg-orange-100 w-8 h-8 rounded-lg flex items-center justify-center text-sm">A</span> Điền từ (5 câu)
              </h3>
              <div className="space-y-6">
                {selectedUnit.exercises.fill.map((q, idx) => (
                  <div key={q.id} className="text-lg font-bold text-gray-700 flex flex-wrap items-center gap-2">
                    <span>{idx+1}. {q.text.split('______')[0]}</span>
                    <input 
                      type="text" 
                      className="border-b-4 border-orange-200 outline-none px-2 w-32 text-center text-orange-600 bg-orange-50 rounded-t-lg"
                      onChange={(e) => setUserAnswers({...userAnswers, [q.id]: e.target.value})}
                      value={userAnswers[q.id] || ""}
                    />
                    <span>{q.text.split('______')[1]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-lg border-b-8 border-purple-100">
              <h3 className="text-lg font-black text-purple-600 mb-6 uppercase flex items-center gap-2">
                <span className="bg-purple-100 w-8 h-8 rounded-lg flex items-center justify-center text-sm">B</span> Trắc nghiệm (5 câu)
              </h3>
              {selectedUnit.exercises.mcq.map((q, idx) => (
                <div key={q.id} className="mb-8 last:mb-0">
                  <p className="font-black text-gray-800 mb-3">{idx+1}. {q.text}</p>
                  <div className="grid grid-cols-2 gap-2 pl-4">
                    {q.options?.map(opt => (
                      <button 
                        key={opt}
                        onClick={() => setUserAnswers({...userAnswers, [q.id]: opt})}
                        className={`p-3 rounded-xl font-bold text-sm border-2 transition ${userAnswers[q.id] === opt ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white border-purple-50 text-gray-500'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-lg border-b-8 border-green-100">
              <h3 className="text-lg font-black text-green-600 mb-6 uppercase flex items-center gap-2">
                <span className="bg-green-100 w-8 h-8 rounded-lg flex items-center justify-center text-sm">C</span> Đúng/Sai (5 câu)
              </h3>
              <div className="space-y-4">
                {selectedUnit.exercises.tf.map((q, idx) => (
                  <div key={q.id} className="flex items-center justify-between p-4 border-2 border-green-50 rounded-2xl">
                    <p className="font-bold text-gray-700">{idx+1}. {q.text}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setUserAnswers({...userAnswers, [q.id]: true})} 
                        className={`w-12 h-10 rounded-xl font-black ${userAnswers[q.id] === true ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                      >T</button>
                      <button 
                        onClick={() => setUserAnswers({...userAnswers, [q.id]: false})} 
                        className={`w-12 h-10 rounded-xl font-black ${userAnswers[q.id] === false ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                      >F</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-6">
              <button 
                onClick={checkResults} 
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-black py-4 rounded-2xl shadow-2xl active:scale-95 transition text-xl border-b-4 border-orange-600"
              >
                NỘP BÀI ✅
              </button>
            </div>
          </div>
        )}

        {screen === 'result' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[3rem] shadow-2xl text-center border-b-[12px] border-sky-100 relative overflow-hidden">
            <div className="text-7xl mb-4">{feedback.emoji}</div>
            <h2 className={`text-3xl font-black mb-2 ${feedback.color}`}>{feedback.title}</h2>
            <p className="text-gray-500 font-bold mb-6 italic">{feedback.msg}</p>
            <div className="inline-block p-8 rounded-full bg-sky-50 border-4 border-white shadow-inner mb-8">
               <span className={`text-6xl font-black ${feedback.color}`}>{score}%</span>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setScreen('exercise')} 
                className="bg-sky-100 hover:bg-sky-200 text-sky-700 font-black py-4 rounded-2xl transition"
              >
                Làm lại bài học ↺
              </button>
              {feedback.canProceed && (
                <button 
                  onClick={() => setScreen('selector')} 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition"
                >
                  Chọn bài khác ➔
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="p-6 text-center text-blue-300 text-[10px] font-black uppercase tracking-widest opacity-60">
        English Learning App for Kids • 20 Units
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
