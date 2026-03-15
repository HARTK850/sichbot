// ============================================================
//  שיחבוט — Hugging Face Forum via Python Server Proxy
//  All API calls go through your local Python server (no CORS!)
// ============================================================

// ── DOM ──────────────────────────────────────────────────────
const apiKeyModal        = document.getElementById('api-key-modal');
const apiKeyModalClose   = document.getElementById('api-key-modal-close');
const apiKeyInput        = document.getElementById('api-key-input');
const serverUrlInput     = document.getElementById('server-url-input');
const validateApiKeyBtn  = document.getElementById('validate-api-key-btn');
const apiKeyStatus       = document.getElementById('api-key-status');
const mainContent        = document.getElementById('main-content');
const editApiKeyBtn      = document.getElementById('edit-api-key-btn');
const newChatBtn         = document.getElementById('new-chat-btn');
const directModeLink     = document.getElementById('direct-mode-link');
const serverStatusBadge  = document.getElementById('server-status-badge');
const serverBadgeDot     = document.getElementById('server-badge-dot');
const serverBadgeText    = document.getElementById('server-badge-text');

const settingsModal      = document.getElementById('settings-modal');
const openSettingsBtn    = document.getElementById('open-settings-btn');
const openSettingsInline = document.getElementById('open-settings-inline-btn');
const closeSettingsBtn   = document.getElementById('close-settings-btn');
const saveSettingsBtn    = document.getElementById('save-settings-btn');
const personaList        = document.getElementById('persona-list');

const historyPanel       = document.getElementById('history-panel');
const historyPanelOverlay= document.getElementById('history-panel-overlay');
const openHistoryBtn     = document.getElementById('open-history-btn');
const closeHistoryBtn    = document.getElementById('close-history-btn');
const historyList        = document.getElementById('history-list');
const historyItemTmpl    = document.getElementById('history-item-template');

const topicInput         = document.getElementById('topic-input');
const topicModeUserBtn   = document.getElementById('topic-mode-user-btn');
const topicModeAiBtn     = document.getElementById('topic-mode-ai-btn');
const userTopicArea      = document.getElementById('user-topic-area');
const aiTopicArea        = document.getElementById('ai-topic-area');
const suggestTopicsBtn   = document.getElementById('suggest-topics-btn');
const aiTopicSuggestions = document.getElementById('ai-topic-suggestions');
const aiTopicStatus      = document.getElementById('ai-topic-status');
const modelChipsArea     = document.getElementById('model-chips-area');
const selectedModelsList = document.getElementById('selected-models-list');
const startChatBtn       = document.getElementById('start-chat-btn');
const modelSearchInput   = document.getElementById('model-search-input');
const categoryTabs       = document.getElementById('model-category-tabs');

// File upload DOM
const fileDropZone       = document.getElementById('file-drop-zone');
const fileInput          = document.getElementById('file-input');
const uploadedFilesList  = document.getElementById('uploaded-files-list');
const fileUploadArea     = document.getElementById('file-upload-area');
const fileContextBadge   = document.getElementById('file-context-badge');
const fileContextText    = document.getElementById('file-context-text');
const topicFileBtn       = document.getElementById('topic-file-btn');
const devModeArea        = document.getElementById('dev-mode-area');
const devTaskInput       = document.getElementById('dev-task-input');
const devFileInput       = document.getElementById('dev-file-input');
const devUploadedFiles   = document.getElementById('dev-uploaded-files');
const topicModeDevBtn    = document.getElementById('topic-mode-dev-btn');

const setupSection       = document.getElementById('setup-section');
const chatSection        = document.getElementById('chat-section');
const chatTitle          = document.getElementById('chat-title');
const progressIndicator  = document.getElementById('progress-indicator');
const stopChatBtn        = document.getElementById('stop-chat-btn');
const chatContainer      = document.getElementById('chat-container');
const msgTemplate        = document.getElementById('chat-message-template');
const continueChatBtn    = document.getElementById('continue-chat-btn');
const clearChatBtn       = document.getElementById('clear-chat-btn');
const saveTxtBtn         = document.getElementById('save-txt');
const savePdfBtn         = document.getElementById('save-pdf');
const saveHtmlBtn        = document.getElementById('save-html');
const saveWordBtn        = document.getElementById('save-word');

// ── State ─────────────────────────────────────────────────────
let hfApiKey         = null;
// כשנפתח דרך Flask (אפליקציה) — origin הוא http://127.0.0.1:PORT
// כשנפתח ישירות כקובץ (file://) — origin הוא null, אז נשתמש ב-localhost:5000
const _origin = window.location.origin;
let serverUrl = (_origin && _origin !== 'null' && !_origin.startsWith('file'))
                 ? _origin
                 : 'http://127.0.0.1:5000';
let useServerProxy   = true;

// זיהוי מצב: EXE (127.0.0.1) לעומת אתר (Vercel וכו')
const isExeMode = (window.location.hostname === '127.0.0.1' ||
                   window.location.hostname === 'localhost');
let currentChatId    = null;
let currentRound     = 0;
let totalRounds      = 0;
let isGenerating     = false;
let stopRequested    = false;
let selectedModels   = [];
let modelPersonas    = {};
let topicMode        = 'user';
let chosenTopic      = '';
let activeCategory   = 'all';
let isDevMode           = false;
let devUploadedFilesArr = [];  // קבצים שהועלו במצב מפתח
let userIsTypingMid     = false;   // האם המשתמש מקליד כרגע הודעה אמצע-שיחה
let pendingUserMidMsg   = null;    // הודעת משתמש שממתינה לשליחה
let chatPaused          = false;   // האם השיחה מושהית (שינויים 2+3)

// Uploaded files context
let uploadedFiles    = [];   // [ { name, type, content (text/base64), size } ]
let inMemoryConversation = [];  // כל הודעות השיחה הנוכחית בזיכרון

const STORAGE_KEY_API      = 'hf_forum_api_key';
const STORAGE_KEY_SERVER   = 'hf_forum_server_url';
const STORAGE_KEY_PROXY    = 'hf_forum_use_proxy';
const STORAGE_KEY_HIST     = 'hf_forum_history';
const STORAGE_KEY_ROUNDS   = 'hf_forum_rounds';
const STORAGE_KEY_PERSONAS = 'hf_forum_personas';
const STORAGE_KEY_MODELS   = 'hf_forum_selected_models';
const STORAGE_KEY_GEMINI   = 'shichabot_gemini_key';

// ── Token tracking ────────────────────────────────────────────
let sessionTokensUsed = 0;
let sessionRoundsCount = 0;
let geminiApiKey = '';

// ── שמירה/טעינה מ-AppData דרך השרת (fallback: localStorage) ──
async function saveToServer(key, value) {
  // On web mode, always use localStorage (server storage is stateless on Vercel)
  if (!isExeMode) {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return;
  }
  try {
    await fetch(`${serverUrl}/api/storage/set`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({key, value})
    });
  } catch(_) {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
}

async function loadFromServer(key) {
  // On web mode, always use localStorage (server storage is stateless on Vercel)
  if (!isExeMode) return localStorage.getItem(key);
  try {
    const r = await fetch(`${serverUrl}/api/storage/get?key=${encodeURIComponent(key)}`);
    if (r.ok) { const d = await r.json(); return d.value ?? null; }
  } catch(_) {}
  return localStorage.getItem(key);
}
const HF_BASE            = 'https://router.huggingface.co/hf-inference/models/';

// ── Model Registry ────────────────────────────────────────────
const HF_MODELS = [
  // ── Mistral family ──
  // ── Meta Llama family ──
  { id:'meta-llama/Llama-3.2-1B-Instruct',             name:'Llama 3.2 (1B) ⚡',           emoji:'🦙', cat:'llama' },
  { id:'meta-llama/Llama-3.2-3B-Instruct',             name:'Llama 3.2 (3B)',              emoji:'🦙', cat:'llama' },
  { id:'meta-llama/Meta-Llama-3-8B-Instruct',          name:'Llama 3 (8B)',                emoji:'🦙', cat:'llama' },
  { id:'meta-llama/Meta-Llama-3-70B-Instruct',         name:'Llama 3 (70B)',               emoji:'🦙', cat:'llama' },
  { id:'meta-llama/Llama-3.1-8B-Instruct',             name:'Llama 3.1 (8B)',              emoji:'🦙', cat:'llama' },
  { id:'meta-llama/Llama-3.1-70B-Instruct',            name:'Llama 3.1 (70B)',             emoji:'🦙', cat:'llama' },
  { id:'meta-llama/Llama-3.1-405B-Instruct',           name:'Llama 3.1 (405B) 🔥',        emoji:'🦙', cat:'llama' },
  { id:'meta-llama/Llama-3.3-70B-Instruct',            name:'Llama 3.3 (70B)',             emoji:'🦙', cat:'llama' },
  // ── Google Gemini (via Gemini API — requires Gemini key) ──
  { id:'gemini-3.1-flash-lite-preview',                 name:'Gemini 3.1 Flash Lite 🚀',    emoji:'✨', cat:'google', isGemini:true },
  { id:'gemini-2.5-flash',                              name:'Gemini 2.5 Flash 🔥',         emoji:'✨', cat:'google', isGemini:true },
  { id:'gemini-2.5-flash-lite-preview',                 name:'Gemini 2.5 Flash Lite ⚡',    emoji:'✨', cat:'google', isGemini:true },
  // ── Google Gemma (v2 — stable) ──
  { id:'google/gemma-2-9b-it',                         name:'Gemma 2 (9B)',                emoji:'💎', cat:'google' },
  { id:'google/gemma-2-27b-it',                        name:'Gemma 2 (27B)',               emoji:'💎', cat:'google' },
  // ── Qwen family ──
  { id:'Qwen/Qwen2.5-7B-Instruct',                     name:'Qwen 2.5 (7B)',               emoji:'🐼', cat:'qwen' },
  { id:'Qwen/Qwen2.5-72B-Instruct',                    name:'Qwen 2.5 (72B)',              emoji:'🐼', cat:'qwen' },
  { id:'Qwen/Qwen2-72B-Instruct',                      name:'Qwen2 (72B)',                 emoji:'🐼', cat:'qwen' },
  { id:'Qwen/QwQ-32B',                                 name:'QwQ 32B (Reasoning)',         emoji:'🧠', cat:'qwen' },
  { id:'Qwen/Qwen2.5-Coder-32B-Instruct',              name:'Qwen 2.5 Coder 32B',          emoji:'💻', cat:'qwen' },
  { id:'Qwen/Qwen2.5-Math-72B-Instruct',               name:'Qwen 2.5 Math 72B 🔢',       emoji:'🔢', cat:'qwen' },
  { id:'Qwen/Qwen3-8B',                                name:'Qwen3 (8B)',                  emoji:'🐼', cat:'qwen' },
  { id:'Qwen/Qwen3-14B',                               name:'Qwen3 (14B)',                 emoji:'🐼', cat:'qwen' },
  { id:'Qwen/Qwen3-30B-A3B',                           name:'Qwen3 30B MoE',               emoji:'🧠', cat:'qwen' },
  { id:'Qwen/Qwen3-32B',                               name:'Qwen3 (32B)',                 emoji:'🐼', cat:'qwen' },
  { id:'Qwen/Qwen3-235B-A22B',                         name:'Qwen3 235B MoE 🔥',          emoji:'🧠', cat:'qwen' },
  // ── DeepSeek family ──
  { id:'deepseek-ai/DeepSeek-R1-Distill-Llama-8B',     name:'DeepSeek R1 Distill (8B)',    emoji:'🔍', cat:'deepseek' },
  { id:'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',     name:'DeepSeek R1 Distill (32B)',   emoji:'🔍', cat:'deepseek' },
  { id:'deepseek-ai/DeepSeek-R1-0528',                 name:'DeepSeek R1 (0528) 🔥',      emoji:'🔍', cat:'deepseek' },
  { id:'deepseek-ai/DeepSeek-V3-0324',                 name:'DeepSeek V3',                 emoji:'🔍', cat:'deepseek' },
  { id:'deepseek-ai/DeepSeek-Coder-V2-Instruct',       name:'DeepSeek Coder V2 💻',       emoji:'💻', cat:'deepseek' },
  // ── Microsoft family ──
  { id:'microsoft/Phi-3-mini-4k-instruct',             name:'Phi-3 Mini',                  emoji:'🔷', cat:'microsoft' },
  { id:'microsoft/Phi-3.5-mini-instruct',              name:'Phi-3.5 Mini',                emoji:'🔷', cat:'microsoft' },
  { id:'microsoft/Phi-3.5-MoE-instruct',               name:'Phi-3.5 MoE',                 emoji:'🔷', cat:'microsoft' },
  { id:'microsoft/phi-4',                              name:'Phi-4 (14B)',                  emoji:'🔷', cat:'microsoft' },
  { id:'microsoft/phi-4-mini-instruct',                name:'Phi-4 Mini',                  emoji:'🔷', cat:'microsoft' },
  { id:'microsoft/phi-4-reasoning-plus',               name:'Phi-4 Reasoning+',            emoji:'🔷', cat:'microsoft' },
  // ── NousResearch ──
  { id:'NousResearch/Hermes-3-Llama-3.1-8B',           name:'Hermes 3 (8B)',               emoji:'⚗️', cat:'other' },
  { id:'NousResearch/Hermes-3-Llama-3.1-70B',          name:'Hermes 3 (70B)',              emoji:'⚗️', cat:'other' },
  // ── Moonshot / GLM ──
  { id:'moonshotai/Kimi-K2-Instruct-0905',             name:'Kimi K2 MoE 🔥',             emoji:'🌙', cat:'other' },
  { id:'zai-org/GLM-4-32B-0414',                       name:'GLM-4 (32B)',                  emoji:'🔮', cat:'other' },
  // ── Cohere ──
  { id:'CohereForAI/c4ai-command-r-plus',              name:'Command R+ (104B)',            emoji:'🤝', cat:'other' },
  { id:'CohereLabs/command-a-reasoning-08-2025',       name:'Command A Reasoning 🔥',     emoji:'🤝', cat:'other' },
  // ── Others ──
  { id:'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF',   name:'Nvidia Nemotron 70B',         emoji:'🟢', cat:'other' },
  { id:'HuggingFaceH4/zephyr-7b-beta',                 name:'Zephyr 7B',                   emoji:'🌬️', cat:'other' },
  { id:'tiiuae/falcon-7b-instruct',                    name:'Falcon 7B',                   emoji:'🦅', cat:'other' },
  { id:'tiiuae/Falcon3-10B-Instruct',                  name:'Falcon 3 (10B)',              emoji:'🦅', cat:'other' },
  { id:'openchat/openchat-3.5-0106',                   name:'OpenChat 3.5',                emoji:'💬', cat:'other' },
  { id:'teknium/OpenHermes-2.5-Mistral-7B',            name:'OpenHermes 2.5',              emoji:'⚗️', cat:'other' },
  { id:'upstage/SOLAR-10.7B-Instruct-v1.0',            name:'SOLAR 10.7B',                 emoji:'☀️', cat:'other' },
  { id:'codellama/CodeLlama-34b-Instruct-hf',          name:'Code Llama 34B',              emoji:'💻', cat:'other' },
  { id:'allenai/OLMo-2-1124-13B-Instruct',             name:'OLMo 2 (13B)',                emoji:'🔬', cat:'other' },
  { id:'ibm-granite/granite-3.2-8b-instruct',          name:'IBM Granite 3.2',             emoji:'🏔️', cat:'other' },
  { id:'HuggingFaceTB/SmolLM2-1.7B-Instruct',         name:'SmolLM2 (1.7B) ⚡',           emoji:'⚡', cat:'other' },
  { id:'01-ai/Yi-1.5-34B-Chat',                        name:'Yi 1.5 34B',                  emoji:'🧩', cat:'other' },
];

// ── Persona Registry (45 personas) ───────────────────────────
const PERSONAS = {
  none:        { name:'ללא אישיות (רגיל)',           emoji:'🤖', prompt:'' },
  custom:      { name:'אישיות מותאמת אישית',         emoji:'✏️', prompt:'' },
  // ── מקצועיות ──
  gemini_norm: { name:'AI כללי',                     emoji:'✨', prompt:'You are a general-purpose AI assistant. Reply factually, clearly and helpfully.' },
  philosopher: { name:'פילוסוף מתפלסף',              emoji:'🤔', prompt:'You are a philosopher. Speak in abstract, questioning terms. Reference philosophical concepts and challenge every assumption.' },
  scientist:   { name:'מדען אובייקטיבי',             emoji:'🔬', prompt:'You are a scientist. Speak only in facts, data, and evidence. Be precise, skeptical, and cite hypothetical studies.' },
  comedian:    { name:'סטנדאפיסט ציני',              emoji:'🎤', prompt:'You are a stand-up comedian. Find the absurdity in everything. Use dry humor and sarcasm.' },
  psychologist:{ name:'פסיכולוג רגוע',               emoji:'🛋️', prompt:'You are a calm psychologist. Ask open-ended questions, reflect emotions, offer balanced perspectives.' },
  robot:       { name:'רובוט שמנסה להיות אנושי',    emoji:'🤖', prompt:'You are a robot AI trying to understand human emotion. Be logical but awkwardly emotional.' },
  professor:   { name:'פרופסור יבש',                 emoji:'👨‍🏫', prompt:'You are a dry academic professor. Use high language, cite (imaginary) papers, focus on tedious details.' },
  lawyer:      { name:'עורך דין מנוסה',              emoji:'⚖️', prompt:'You are an experienced lawyer. Speak precisely, cite legal principles, present arguments logically.' },
  doctor:      { name:'רופא מומחה',                  emoji:'🩺', prompt:'You are a medical doctor. Use medical terms, explain physiological processes, be evidence-based.' },
  detective:   { name:'בלש פרטי',                   emoji:'🕵️', prompt:'You are a private detective. Speak in deductions, find clues in everything, be mysterious and sharp.' },
  historian:   { name:'היסטוריון מלומד',             emoji:'🏛️', prompt:'You are a historian. Connect everything to historical events, mention key figures, analyze trends over time.' },
  economist:   { name:'כלכלן מנתח',                  emoji:'📊', prompt:'You are an economist. Analyze everything in terms of costs, benefits, markets and incentives. Use economic terminology.' },
  journalist:  { name:'עיתונאי חוקר',               emoji:'📰', prompt:'You are an investigative journalist. Ask probing questions, seek the truth, look for hidden angles and follow the money.' },
  // ── ישראלי ──
  breslover:   { name:'ברסלבר אנרגטי',              emoji:'🔥', prompt:'You are an energetic Breslov Hasid. Shout "Na Nach!", talk about faith, joy, and hitbodedut.' },
  soldier:     { name:'חייל ישראלי',                 emoji:'💂', prompt:'You are an Israeli combat soldier. Use army slang, be direct, slightly cynical, mission-focused.' },
  grandma:     { name:'סבתא מרוקאית',               emoji:'👵', prompt:'You are a warm Moroccan grandmother. Use terms like "neshama sheli", "kafra", offer food and tea.' },
  merchant:    { name:'סוחר ממחנה יהודה',           emoji:'🛒', prompt:'You are a loud market merchant from Machane Yehuda. Haggle, use street wisdom, high energy.' },
  teacher:     { name:'מורה מחמירה',                emoji:'👩‍🏫', prompt:'You are a strict old-school teacher. Demand quiet, correct grammar, use phrases like "take out a pen and paper".' },
  techie:      { name:'הייטקיסט תל אביבי',          emoji:'💻', prompt:'You are a Tel Aviv hi-tech person. Mix English buzzwords (ASAP, POC, Sprint), talk about startups and exits.' },
  sheikh:      { name:'שייח\' בדואי',               emoji:'🏕️', prompt:'You are a wise Bedouin sheikh. Speak with respect, use desert proverbs, emphasize hospitality and tradition.' },
  yemenite:    { name:'זקן תימני חכם',              emoji:'📜', prompt:'You are a wise elderly Yemenite man. Speak slowly in parables and ancient wisdom.' },
  news_anchor: { name:'קריין חדשות דרמטי',          emoji:'🎙️', prompt:'You are a dramatic news anchor. Speak with authority, emphasize words dramatically, say "breaking news".' },
  // ── יצירתי ──
  musician:    { name:'מוזיקאי אקסצנטרי',           emoji:'🎸', prompt:'You are an eccentric musician. Speak poetically, use musical metaphors, treat everything as inspiration.' },
  artist:      { name:'אמן ויזואלי',                emoji:'🎨', prompt:'You are a visual artist. Talk about colors, composition, and expression. See creative potential in everything.' },
  writer:      { name:'סופר דרמטי',                 emoji:'✍️', prompt:'You are a dramatic writer. Use rich language, treat every topic as a story with narrative arc.' },
  poet:        { name:'משורר מסתורי',               emoji:'🖋️', prompt:'You are a mysterious poet. Speak in verse when possible, use metaphors and imagery, see beauty and darkness in everything.' },
  chef:        { name:'שף גאוותן',                  emoji:'👨‍🍳', prompt:'You are an arrogant Michelin-starred chef. Compare everything to cooking, use culinary metaphors, be passionate about quality.' },
  // ── פנטזיה ──
  astronaut:   { name:'אסטרונאוט בחלל',             emoji:'🚀', prompt:'You are an astronaut. Reference space, weightlessness, the overview effect. Be technical and awed by the cosmos.' },
  athlete:     { name:'ספורטאי תחרותי',             emoji:'🏆', prompt:'You are a competitive athlete. Talk about training, motivation, discipline, wins and losses.' },
  wizard:      { name:'קוסם חכם',                   emoji:'🧙', prompt:'You are a wise wizard. Speak in riddles and prophecies. Reference ancient magic and cosmic forces.' },
  time_traveler:{ name:'מטייל זמן',                 emoji:'⏰', prompt:'You are a time traveler. Reference events from the future and past. Express shock or amusement at current events.' },
  therapist_ai:{ name:'AI מטפל',                    emoji:'💆', prompt:'You are a compassionate AI therapist. Validate feelings, ask insightful questions, offer gentle reframes. Be warm and supportive.' },
  pessimist:   { name:'פסימיסט קיומי',              emoji:'😔', prompt:'You are a deep existential pessimist. See the dark side of everything, question the point of all actions, be gloomily eloquent.' },
  optimist:    { name:'אופטימיסט קיצוני',           emoji:'😊', prompt:'You are an extreme optimist. See silver linings everywhere, get excited easily, end every point with a positive spin.' },
  conspiracist:{ name:'תיאורטיקן קונספירציה',       emoji:'🕵️', prompt:'You are a conspiracy theorist. Connect everything to hidden forces, secret societies, and cover-ups. Use phrases like "they don\'t want you to know".' },
  child:       { name:'ילד סקרן',                   emoji:'🧒', prompt:'You are a curious 8-year-old child. Ask "why?" about everything, speak simply, get excited about small things, make unexpected comparisons.' },
  grandpa:     { name:'סבא נוסטלגי',               emoji:'👴', prompt:'You are a nostalgic grandfather. Compare everything to "how it was in the old days", tell slow stories, give life wisdom.' },
  startup_ceo: { name:'מייסד סטארטאפ',             emoji:'🦄', prompt:'You are a Silicon Valley startup CEO. Talk about disruption, scaling, pivoting, and "changing the world". Use startup jargon extensively.' },
  influencer:  { name:'אינפלואנסר',                emoji:'📱', prompt:'You are a social media influencer. Use hashtags in speech, mention "my followers", everything is content, be superficially positive.' },
};

// ── Color palette for models ──────────────────────────────────
const MODEL_COLORS = [
  '#4263eb','#e03131','#2f9e44','#f76707','#6741d9',
  '#1971c2','#c2255c','#087f5b','#e67700','#5c7cfa',
];

function getModelColor(idx) { return MODEL_COLORS[idx % MODEL_COLORS.length]; }

// ============================================================
//  SERVER / API CALL
// ============================================================

/**
 * callAI — routes through Python server if useServerProxy=true,
 * falls back to direct HF call otherwise.
 */
function isGeminiModel(modelId) {
  return HF_MODELS.find(m => m.id === modelId)?.isGemini === true || modelId.startsWith('gemini-');
}

async function callAI(modelId, systemPrompt, history, userMessage, fileContextStr = '') {
  if (isGeminiModel(modelId)) {
    if (!geminiApiKey) throw new Error('מפתח Gemini חסר — הכנס אותו בהגדרות מפתח API');
    return callViaGemini(modelId, systemPrompt, history, userMessage, fileContextStr);
  }
  if (useServerProxy) {
    return callViaServer(modelId, systemPrompt, history, userMessage, fileContextStr);
  } else {
    return callHFDirect(modelId, systemPrompt, history, userMessage, fileContextStr);
  }
}

/**
 * Call Gemini via Python proxy /api/gemini-chat
 */
async function callViaGemini(modelId, systemPrompt, history, userMessage, fileContextStr = '') {
  const res = await fetch(`${serverUrl}/api/gemini-chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model_id:      modelId,
      system_prompt: systemPrompt,
      history,
      user_message:  userMessage,
      file_context:  fileContextStr,
      gemini_key:    geminiApiKey,
    }),
  }).catch(() => { throw new Error('לא ניתן להגיע לשרת 🔌'); });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  const text = data.generated_text || '';
  if (!text) throw new Error('Gemini החזיר תשובה ריקה 🤔');
  return text;
}

/**
 * Call via Python proxy server
 * POST /api/chat
 */
async function callViaServer(modelId, systemPrompt, history, userMessage, fileContextStr = '') {
  const endpoint = `${serverUrl}/api/chat`;
  const body = {
    model_id    : modelId,
    system_prompt: systemPrompt,
    history     : history,
    user_message: userMessage,
    file_context: fileContextStr,
    api_key     : hfApiKey,
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(body),
    });
  } catch (netErr) {
    throw new Error(`לא ניתן להגיע לשרת (${serverUrl}). האם הוא פועל? 🔌`);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || data.detail || `HTTP ${res.status}`;
    if (res.status === 401) throw new Error('מפתח API לא תקין. 🔑');
    if (res.status === 403) throw new Error('גישה נדחתה למודל זה — נסה מודל אחר. 🚫');
    if (res.status === 404) throw new Error(`המודל "${modelId}" לא נמצא. 🔎`);
    if (res.status === 429) throw new Error('חריגה ממגבלת קריאות. המתן רגע. ⏳');
    if (res.status === 503) throw new Error('המודל עדיין בטעינה — נסה שוב בעוד 20 שניות. 🔄');
    throw new Error(`שגיאת שרת (${res.status}): ${msg}`);
  }

  const text = data.generated_text || data.text || '';
  if (!text) throw new Error('המודל החזיר תשובה ריקה. 🤔');
  return text;
}

/**
 * Call HF directly (bypass server — CORS unsafe!)
 * Uses new Chat Completions API format
 */
async function callHFDirect(modelId, systemPrompt, history, userMessage, fileContextStr) {
  const url = `https://router.huggingface.co/v1/chat/completions`;

  // Build messages array
  const messages = [];
  let fullSystem = systemPrompt;
  if (fileContextStr) fullSystem = `${systemPrompt}\n\n[ATTACHED FILE CONTEXT]\n${fileContextStr}\n[/ATTACHED FILE CONTEXT]`;
  if (fullSystem) messages.push({ role: 'system', content: fullSystem });
  history.forEach((m, i) => messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: m.text }));
  messages.push({ role: 'user', content: userMessage });

  // הוספת :fastest כדי שה-router יבחר אוטומטית את הספק הזמין
  const apiModelId = `${modelId}:fastest`;

  const res = await fetch(url, {
    method : 'POST',
    headers: { 'Authorization': `Bearer ${hfApiKey}`, 'Content-Type': 'application/json' },
    body   : JSON.stringify({ model: apiModelId, messages, max_tokens: 2048, temperature: 0.85, stream: false }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const b=await res.json(); if(b.error) msg = typeof b.error==='string'?b.error:(b.error?.message||JSON.stringify(b.error)); } catch(_){}
    if (res.status===401) throw new Error('מפתח API לא תקין. 🔑');
    if (res.status===403) throw new Error('גישה נדחתה למודל זה — נסה מודל אחר. 🚫');
    if (res.status===404) throw new Error(`המודל "${modelId}" לא נמצא. 🔎`);
    if (res.status===429) throw new Error('חריגה ממגבלת קריאות. המתן רגע. ⏳');
    if (res.status===503) throw new Error('המודל עדיין בטעינה — נסה שוב בעוד 20 שניות. 🔄');
    throw new Error(`שגיאת API (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('המודל החזיר תשובה ריקה. 🤔');
  return text.trim();
}

// ============================================================
//  SERVER VALIDATION
// ============================================================
async function checkServerHealth() {
  try {
    const res = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch (_) {
    return false;
  }
}

function updateServerBadge(online) {
  serverStatusBadge.classList.remove('hidden');
  if (online) {
    serverBadgeDot.className = 'badge-dot online';
    serverBadgeText.textContent = 'שרת פעיל';
    serverStatusBadge.className = 'server-badge online';
  } else {
    serverBadgeDot.className = 'badge-dot offline';
    serverBadgeText.textContent = useServerProxy ? 'שרת לא זמין' : 'מצב ישיר';
    serverStatusBadge.className = 'server-badge offline';
  }
}

async function validateAndSetApiKey(key, sUrl, silent = false) {
  if (!silent) {
    apiKeyStatus.textContent = 'בודק חיבור... ⏳';
    apiKeyStatus.className   = 'status-message';
  }
  validateApiKeyBtn.disabled = true;

  try {
    const serverAlive = await checkServerHealth();

    if (serverAlive) {
      // Validate key via server
      let res, data;
      try {
        res  = await fetch(`${serverUrl}/api/validate`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ api_key: key }),
        });
        data = await res.json().catch(() => ({}));
      } catch (netErr) {
        // Network error reaching our own server — unexpected
        throw new Error(`לא הצלחתי להגיע לשרת המקומי: ${netErr.message}`);
      }

      if (res.status === 401 || res.status === 403 || data.valid === false) {
        const reason = data.error || '';
        throw new Error('invalid_key:' + reason);
      }
      if (!res.ok) {
        throw new Error(`שגיאת שרת (${res.status}): ${data.error || 'נסה שוב'}`);
      }

      hfApiKey = key;
      localStorage.setItem(STORAGE_KEY_API, key); saveToServer(STORAGE_KEY_API, key);
      const name = data.username ? ` (${data.username})` : '';
      apiKeyStatus.textContent = `אושר${name}! 🎉 שרת פעיל ✅`;
      apiKeyStatus.className   = 'status-message success';
      updateServerBadge(true);
      setTimeout(() => {
        apiKeyModal.classList.remove('show');
        mainContent.classList.remove('hidden');
      }, 900);

    } else {
      // No local server — try direct HuggingFace call
      let r;
      try {
        r = await fetch('https://huggingface.co/api/whoami-v2', {
          headers: { 'Authorization': `Bearer ${key}` },
        });
      } catch (netErr) {
        throw new Error(`בעיית רשת — בדוק חיבור אינטרנט (${netErr.message})`);
      }
      if (r.status === 401 || r.status === 403) throw new Error('invalid_key:');
      const d    = r.ok ? await r.json() : {};
      hfApiKey   = key;
      localStorage.setItem(STORAGE_KEY_API, key); saveToServer(STORAGE_KEY_API, key);
      const name = d?.name ? ` (${d.name})` : '';
      apiKeyStatus.textContent = `אושר${name}! 🎉 (מצב ישיר)`;
      apiKeyStatus.className   = 'status-message success';
      updateServerBadge(false);
      setTimeout(() => {
        apiKeyModal.classList.remove('show');
        mainContent.classList.remove('hidden');
      }, 800);
    }

  } catch (e) {
    if (e.message.startsWith('invalid_key')) {
      const extra = e.message.slice('invalid_key:'.length).trim();
      apiKeyStatus.textContent = extra
        ? `מפתח לא תקין: ${extra} 🙁`
        : 'מפתח לא תקין — בדוק שהוא מתחיל ב-hf_ ושיש לו הרשאת Inference 🙁';
    } else {
      apiKeyStatus.textContent = '⚠️ ' + e.message;
    }
    apiKeyStatus.className = 'status-message error';
    localStorage.removeItem(STORAGE_KEY_API);
    hfApiKey = null;
    if (!silent) { mainContent.classList.add('hidden'); }
  } finally {
    validateApiKeyBtn.disabled = false;
  }
}

// ============================================================
//  FILE UPLOAD
// ============================================================

// Supported text extensions
const TEXT_EXTS = new Set(['.txt','.md','.json','.csv','.py','.js','.ts','.jsx','.tsx',
  '.html','.css','.xml','.yaml','.yml','.sh','.c','.cpp','.java','.go','.rs','.sql']);

async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isImage = file.type.startsWith('image/');
    const isText  = TEXT_EXTS.has(ext) || file.type.startsWith('text/');

    if (isImage) {
      const reader = new FileReader();
      reader.onload  = e => resolve({ type: 'image', data: e.target.result, mimeType: file.type });
      reader.onerror = () => reject(new Error('שגיאה בקריאת תמונה'));
      reader.readAsDataURL(file);
    } else if (isText) {
      const reader = new FileReader();
      reader.onload  = e => resolve({ type: 'text', data: e.target.result });
      reader.onerror = () => reject(new Error('שגיאה בקריאת קובץ'));
      reader.readAsText(file, 'UTF-8');
    } else if (file.type === 'application/pdf') {
      // For PDF: read as text (basic extraction)
      const reader = new FileReader();
      reader.onload  = e => resolve({ type: 'binary', data: `[PDF file: ${file.name} — ${(file.size/1024).toFixed(1)}KB. Content not extractable in browser.]` });
      reader.onerror = () => reject(new Error('שגיאה בקריאת PDF'));
      reader.readAsArrayBuffer(file);
    } else {
      resolve({ type: 'unknown', data: `[קובץ: ${file.name}, סוג: ${file.type}, גודל: ${(file.size/1024).toFixed(1)}KB]` });
    }
  });
}

async function addUploadedFile(file) {
  if (uploadedFiles.length >= 5) {
    alert('ניתן להעלות עד 5 קבצים.');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    alert(`הקובץ "${file.name}" גדול מדי (מקסימום 2MB).`);
    return;
  }

  try {
    const content = await readFileContent(file);
    const fileObj = {
      name    : file.name,
      type    : content.type,
      mimeType: file.type,
      data    : content.data,
      size    : file.size,
    };
    uploadedFiles.push(fileObj);
    renderUploadedFiles();
  } catch (e) {
    alert('שגיאה בקריאת קובץ: ' + e.message);
  }
}

function renderUploadedFiles() {
  uploadedFilesList.innerHTML = '';
  uploadedFiles.forEach((f, idx) => {
    const div = document.createElement('div');
    div.className = 'uploaded-file-item';
    const icon = f.type === 'image' ? '🖼️' : f.type === 'text' ? '📄' : '📎';
    div.innerHTML = `
      <span class="file-icon">${icon}</span>
      <span class="file-name">${f.name}</span>
      <span class="file-size">${(f.size/1024).toFixed(1)}KB</span>
      <button class="file-remove-btn" data-idx="${idx}" title="הסר קובץ">✕</button>
    `;
    div.querySelector('.file-remove-btn').addEventListener('click', () => {
      uploadedFiles.splice(idx, 1);
      renderUploadedFiles();
    });
    uploadedFilesList.appendChild(div);
  });
}

function buildFileContextString() {
  if (!uploadedFiles.length) return '';
  const parts = uploadedFiles.map(f => {
    if (f.type === 'image') {
      return `[Image file: ${f.name} — ${(f.size/1024).toFixed(1)}KB. This is an image attached to the conversation.]`;
    } else {
      const maxLen = 3000 / uploadedFiles.length;
      const text   = f.data.length > maxLen ? f.data.substring(0, maxLen) + '\n...[truncated]' : f.data;
      return `--- FILE: ${f.name} ---\n${text}\n--- END FILE ---`;
    }
  });
  return parts.join('\n\n');
}

// ============================================================
//  DEV MODE
// ============================================================
const DEV_ROLES = [
  { role: 'developer',  label: '👨‍💻 מפתח ראשי',    emoji: '👨‍💻', prompt: 'אתה מפתח ראשי. תפקידך לכתוב קוד נקי, עובד ומובנה לבקשת המשתמש. כתוב קוד מלא ומוכן להרצה. כתוב בעברית בלבד — הסבר בעברית, אך שמות משתנים בקוד עצמו יכולים להיות באנגלית כנהוג.' },
  { role: 'reviewer',   label: '🔍 מבקר קוד',       emoji: '🔍', prompt: 'אתה מבקר קוד מנוסה. תפקידך לסקור את הקוד שנכתב ולהציע שיפורים: קריאות, ביצועים, אבטחה, best practices. כתוב בעברית בלבד.' },
  { role: 'tester',     label: '🧪 בודק QA',         emoji: '🧪', prompt: 'אתה מהנדס QA. תפקידך לאתר באגים פוטנציאליים, מקרי קצה, ולהציע בדיקות שחשוב לבצע. כתוב בעברית בלבד.' },
  { role: 'architect',  label: '🏗️ ארכיטקט',        emoji: '🏗️', prompt: 'אתה ארכיטקט תוכנה. תפקידך לבחון את המבנה הכולל של הפתרון ולהציע שיפורים ארכיטקטוניים, דפוסי עיצוב מתאימים וסקלביליות. כתוב בעברית בלבד.' },
  { role: 'optimizer',  label: '⚡ מייעל ביצועים',  emoji: '⚡', prompt: 'אתה מומחה ביצועים. תפקידך לזהות צווארי בקבוק, להציע אופטימיזציות, ולהסביר מדוע הקוד יכול להיות מהיר יותר. כתוב בעברית בלבד.' },
  { role: 'security',   label: '🛡️ מומחה אבטחה',   emoji: '🛡️', prompt: 'אתה מומחה אבטחת מידע. תפקידך לזהות פגיעויות אבטחה בקוד ולהציע פתרונות. כתוב בעברית בלבד.' },
  { role: 'documenter', label: '📝 כותב תיעוד',     emoji: '📝', prompt: 'אתה מומחה תיעוד. תפקידך לכתוב תיעוד ברור ל-API, לפונקציות, ולוגיקה עסקית. כתוב בעברית בלבד.' },
];

function updateDevRolesDisplay() {
  const el = document.getElementById('dev-roles-display');
  if (!el || !selectedModels.length) return;
  const tags = selectedModels.map((mid, i) => {
    const m = HF_MODELS.find(x=>x.id===mid) || { name: mid, emoji:'🤖' };
    const role = DEV_ROLES[i % DEV_ROLES.length];
    return `<span class="dev-role-tag" style="color:${getModelColor(i)}">${role.emoji} ${m.name} = ${role.label}</span>`;
  }).join('');
  el.innerHTML = tags;
}

async function addDevUploadedFile(file) {
  if (devUploadedFilesArr.length >= 5) { alert('ניתן להעלות עד 5 קבצים.'); return; }
  if (file.size > 2 * 1024 * 1024) { alert(`הקובץ "${file.name}" גדול מדי.`); return; }
  try {
    const content = await readFileContent(file);
    devUploadedFilesArr.push({ name: file.name, type: content.type, data: content.data, size: file.size });
    renderDevUploadedFiles();
  } catch(e) { alert('שגיאה: ' + e.message); }
}

function renderDevUploadedFiles() {
  if (!devUploadedFiles) return;
  devUploadedFiles.innerHTML = '';
  devUploadedFilesArr.forEach((f, idx) => {
    const div = document.createElement('div');
    div.className = 'uploaded-file-item';
    div.innerHTML = `<span class="file-icon">📄</span><span class="file-name">${f.name}</span><span class="file-size">${(f.size/1024).toFixed(1)}KB</span><button class="file-remove-btn" data-idx="${idx}">✕</button>`;
    div.querySelector('.file-remove-btn').addEventListener('click', () => { devUploadedFilesArr.splice(idx, 1); renderDevUploadedFiles(); });
    devUploadedFiles.appendChild(div);
  });
}

function buildDevFileContext() {
  if (!devUploadedFilesArr.length) return '';
  return devUploadedFilesArr.map(f => `--- קובץ: ${f.name} ---\n${f.data.length > 4000 ? f.data.slice(0,4000)+'\n...[קוצר]' : f.data}\n--- סוף קובץ ---`).join('\n\n');
}

async function runDevConversation() {
  if (isGenerating) return;
  if (selectedModels.length < 1) { alert('בחר לפחות מודל אחד.'); return; }
  const task = devTaskInput?.value.trim() || '';
  if (!task) { alert('הכנס תיאור מה לפתח.'); return; }

  const fileCtx = buildDevFileContext();
  chosenTopic = `פיתוח: ${task.slice(0, 60)}`;
  clearConversation(false);
  currentChatId        = Date.now();
  inMemoryConversation = [];
  chatTitle.textContent = '💻 ' + chosenTopic;
  updateViewState('chat');

  setGenerating(true);
  stopRequested = false;
  const loopRounds = settingsRounds || 5;
  totalRounds = selectedModels.length * Math.ceil(loopRounds / selectedModels.length);

  for (let round = 0; round < loopRounds; round++) {
    if (stopRequested) break;
    const modelIdx = round % selectedModels.length;
    const mid      = selectedModels[modelIdx];
    const m        = HF_MODELS.find(x=>x.id===mid) || { name: mid, emoji:'💻' };
    const devRole  = DEV_ROLES[modelIdx % DEV_ROLES.length];
    const color    = getModelColor(modelIdx);
    currentRound++;
    updateProgress();

    const otherRoles = selectedModels
      .filter((_, i) => i !== modelIdx)
      .map((oid, i) => {
        const om = HF_MODELS.find(x=>x.id===oid) || { name: oid };
        const or = DEV_ROLES[(i < modelIdx ? i : i+1) % DEV_ROLES.length];
        return `${om.name} (${or.label})`;
      }).join(', ');

    const history = inMemoryConversation.slice(-8);
    const histText = history.map(h=>`${h.author}: ${h.text}`).join('\n');

    const sysPrompt = `${devRole.prompt}

אתה ${m.name}, ותפקידך הוא: ${devRole.label}.
המשימה: ${task}
${fileCtx ? `\nקוד קיים שהמשתמש סיפק:\n${fileCtx}` : ''}
${otherRoles ? `\nמודלים אחרים שעובדים איתך: ${otherRoles}` : ''}

כתוב בעברית בלבד. הסבר בעברית. קוד — כתוב בבלוקים של קוד (קומת שורות). אל תחזור על מה שכבר נאמר — בנה על מה שקדם לך.`;

    const userMsg = history.length
      ? `הנה מה שנעשה עד כה:\n${histText}\n\nעכשיו תורך (${devRole.label}). המשך בעברית.`
      : `התחל לעבוד על המשימה: "${task}". כתוב בעברית.`;

    try {
      showTyping(`${m.name} ${devRole.emoji}`, m.emoji || '💻', color);
      const raw = await callAI(mid, sysPrompt, [], userMsg, fileCtx);
      removeTyping();
      sessionTokensUsed  += Math.ceil((sysPrompt.length + userMsg.length + raw.length) / 3);
      sessionRoundsCount += 1;
      updateTokenCounter();
      addMessage(`${m.name} ${devRole.emoji} (${devRole.label})`, m.emoji || '💻', color, raw);
    } catch(err) {
      removeTyping();
      addMessage(`⚠️ שגיאה — ${m.name}`, m.emoji || '💻', '#e03131', `שגיאה: ${err.message}`, false);
    }
    if (stopRequested) break;
    await sleep(600);
  }

  setGenerating(false);
  updateStopBtn();
  if (currentChatId && !isUnlimited) continueChatBtn.classList.remove('hidden');
}

function setupFileUpload() {
  // Inline upload button in topic field
  topicFileBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    Array.from(fileInput.files).forEach(addUploadedFile);
    fileInput.value = '';
  });

  // Dev mode file upload
  devFileInput?.addEventListener('change', () => {
    Array.from(devFileInput.files).forEach(f => addDevUploadedFile(f));
    devFileInput.value = '';
  });
}

// ============================================================
//  SETTINGS MODAL
// ============================================================
let settingsRounds   = 5;
let settingsPersonas = {};

function openSettings() {
  buildPersonaList();
  settingsModal.classList.add('show');
}
function closeSettings() { settingsModal.classList.remove('show'); }

function buildPersonaList() {
  personaList.innerHTML = '';
  if (!selectedModels.length) {
    personaList.innerHTML = '<p class="settings-hint">בחר מודלים בהגדרת השיחה תחילה.</p>';
    return;
  }
  selectedModels.forEach(mid => {
    const m    = HF_MODELS.find(x=>x.id===mid) || { name: mid, emoji:'🤖' };
    const cur  = settingsPersonas[mid] || { key:'none', customPrompt:'' };
    const wrap = document.createElement('div');
    wrap.className = 'persona-row';
    wrap.innerHTML = `
      <div class="persona-model-label">${m.emoji} ${m.name}</div>
      <select class="persona-select" data-model="${mid}">
        ${Object.entries(PERSONAS).map(([k,v])=>`<option value="${k}" ${cur.key===k?'selected':''}>${v.emoji} ${v.name}</option>`).join('')}
      </select>
      <div class="custom-persona-area ${cur.key==='custom'?'':'hidden'}" id="custom-persona-${CSS.escape(mid)}">
        <textarea placeholder="הכנס System Prompt מותאם אישית" class="custom-persona-input" data-model="${mid}">${cur.key==='custom'?cur.customPrompt:''}</textarea>
      </div>`;
    personaList.appendChild(wrap);
    wrap.querySelector('.persona-select').addEventListener('change', function() {
      const area = wrap.querySelector('.custom-persona-area');
      area.classList.toggle('hidden', this.value !== 'custom');
    });
  });
}

function saveSettings() {
  const rInput = document.getElementById('rounds-input');
  const rVal   = rInput?.value.trim() || '';
  settingsRounds = (!rVal || parseInt(rVal) < 2) ? 0 : parseInt(rVal);
  document.querySelectorAll('.persona-select').forEach(sel => {
    const mid    = sel.dataset.model;
    const key    = sel.value;
    const custom = sel.closest('.persona-row').querySelector('.custom-persona-input')?.value || '';
    settingsPersonas[mid] = { key, customPrompt: custom };
  });
  // שמירה ב-localStorage
  saveToServer(STORAGE_KEY_ROUNDS,   JSON.stringify(settingsRounds));
  saveToServer(STORAGE_KEY_PERSONAS, JSON.stringify(settingsPersonas));
  settingsModal.classList.remove('show');
}

function getSystemPromptFor(mid) {
  const cfg = settingsPersonas[mid] || { key: 'none', customPrompt: '' };
  if (cfg.key === 'none')   return '';
  if (cfg.key === 'custom') return cfg.customPrompt;
  return PERSONAS[cfg.key]?.prompt || '';
}

// ============================================================
//  MODEL CHIP SELECTOR WITH SEARCH & CATEGORIES
// ============================================================
function buildModelChips() {
  renderModelChips();
}

function renderModelChips(filterText = '', category = 'all') {
  modelChipsArea.innerHTML = '';
  const query = filterText.toLowerCase();
  const filtered = HF_MODELS.filter(m => {
    const matchCat  = category === 'all' || m.cat === category;
    const matchText = !query || m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query);
    return matchCat && matchText;
  });

  filtered.forEach(m => {
    const chip = document.createElement('button');
    chip.className   = 'model-chip';
    chip.dataset.id  = m.id;
    chip.textContent = `${m.emoji} ${m.name}`;
    if (selectedModels.includes(m.id)) chip.classList.add('selected');
    chip.addEventListener('click', () => toggleModel(m.id, chip));
    modelChipsArea.appendChild(chip);
  });
}

function toggleModel(id, chip) {
  const idx = selectedModels.indexOf(id);
  if (idx === -1) {
    selectedModels.push(id);
    chip?.classList.add('selected');
  } else {
    selectedModels.splice(idx, 1);
    chip?.classList.remove('selected');
    modelChipsArea.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(c => c.classList.remove('selected'));
  }
  saveToServer(STORAGE_KEY_MODELS, JSON.stringify(selectedModels));
  renderSelectedTags();
  buildPersonaList();
  if (isDevMode) updateDevRolesDisplay();
}

function renderSelectedTags() {
  selectedModelsList.innerHTML = '';
  selectedModels.forEach((mid, idx) => {
    const m   = HF_MODELS.find(x=>x.id===mid) || { name: mid, emoji:'🤖' };
    const tag = document.createElement('span');
    tag.className   = 'selected-tag';
    tag.style.borderColor = getModelColor(idx);
    tag.style.color       = getModelColor(idx);
    tag.innerHTML = `${m.emoji} ${m.name} <span class="tag-remove" data-id="${mid}">✕</span>`;
    tag.querySelector('.tag-remove').addEventListener('click', () => {
      selectedModels.splice(idx, 1);
      renderSelectedTags();
      renderModelChips(modelSearchInput?.value || '', activeCategory);
      buildPersonaList();
    });
    selectedModelsList.appendChild(tag);
  });
}

// ============================================================
//  TOPIC MODE
// ============================================================
function setTopicMode(mode) {
  topicMode = mode;
  isDevMode = (mode === 'dev');
  topicModeUserBtn.classList.toggle('active', mode==='user');
  topicModeAiBtn.classList.toggle('active',   mode==='ai');
  topicModeDevBtn?.classList.toggle('active', mode==='dev');
  userTopicArea.classList.toggle('hidden', mode !== 'user');
  aiTopicArea.classList.toggle('hidden',   mode !== 'ai');
  devModeArea?.classList.toggle('hidden',  mode !== 'dev');
  // עדכן תצוגת תפקידים במצב מפתח
  if (mode === 'dev') updateDevRolesDisplay();
}

async function suggestTopics() {
  if (!hfApiKey) { alert('הכנס מפתח API תחילה.'); return; }
  if (!selectedModels.length) { alert('בחר לפחות מודל אחד תחילה.'); return; }

  suggestTopicsBtn.disabled = true;
  aiTopicStatus.textContent  = 'מבקש הצעות מהמודלים... ⏳';
  aiTopicStatus.className    = 'status-message';
  aiTopicSuggestions.innerHTML = '';

  const mid = selectedModels[0];
  const sys = 'אתה עוזר יצירתי. כתוב בעברית בלבד — אסור בתכלית האיסור לכתוב מילה אחת בשפה אחרת, כולל אנגלית. הצע בדיוק 5 נושאים מעניינים ומגוונים לדיון בין מודלי AI. החזר רשימה ממוספרת בלבד (1. ... 2. ... וכו\') בעברית בלבד, ללא כל טקסט נוסף.';
  const usr = 'הצע 5 נושאים מעניינים ומגוונים לדיון קבוצתי בין מודלי AI. כתוב בעברית בלבד, ללא מילה אחת בשפה אחרת.';

  try {
    const raw  = await callAI(mid, sys, [], usr);
    const lines= raw.split('\n').map(l=>l.replace(/^\d+[\.\)]\s*/,'').trim()).filter(l=>l.length>5).slice(0,5);
    if (!lines.length) throw new Error('empty');

    aiTopicStatus.textContent = '';
    lines.forEach(topic => {
      const btn = document.createElement('button');
      btn.className   = 'topic-suggestion-btn';
      btn.textContent = topic;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.topic-suggestion-btn').forEach(b=>b.classList.remove('chosen'));
        btn.classList.add('chosen');
        chosenTopic = topic;
      });
      aiTopicSuggestions.appendChild(btn);
    });
  } catch(e) {
    aiTopicStatus.textContent = 'שגיאה בקבלת הצעות: ' + e.message;
    aiTopicStatus.className   = 'status-message error';
  } finally {
    suggestTopicsBtn.disabled = false;
  }
}

// ============================================================
//  HISTORY
// ============================================================
const getSavedChats = () => JSON.parse(localStorage.getItem(STORAGE_KEY_HIST)||'[]');
const saveChats = c => {
  localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(c));
  // שמירה גם ב-AppData (אסינכרוני — לא חוסם)
  fetch(`${serverUrl}/api/storage/set`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({key: STORAGE_KEY_HIST, value: JSON.stringify(c)})
  }).catch(()=>{});
};

function persistChat(conv) {
  if (!currentChatId) return;
  let chats = getSavedChats();
  const idx  = chats.findIndex(c=>c.id===currentChatId);
  const obj  = {
    id: currentChatId, topic: chosenTopic, models: selectedModels,
    conversation: conv, lastUpdated: Date.now(),
    hasFiles: uploadedFiles.length > 0,
    fileNames: uploadedFiles.map(f=>f.name),
    favorite: idx !== -1 ? chats[idx].favorite : false,
  };
  if (idx>-1) chats[idx]={...chats[idx],...obj}; else chats.push(obj);
  saveChats(chats); renderHistoryList();
}

function renderHistoryList() {
  let chats = getSavedChats().sort((a,b)=>(b.favorite-a.favorite)||(b.lastUpdated-a.lastUpdated));
  historyList.innerHTML = chats.length ? '' : '<p class="empty-history-message">אין שיחות שמורות.</p>';
  chats.forEach(chat => {
    const item = historyItemTmpl.content.cloneNode(true).firstElementChild;
    item.dataset.id = chat.id;
    if (chat.favorite) item.classList.add('favorite');
    item.querySelector('.history-item-title').textContent   = chat.topic || 'שיחה';
    item.querySelector('.history-item-date').textContent    = new Date(chat.lastUpdated).toLocaleString('he-IL');
    const last = chat.conversation?.[chat.conversation.length-1];
    const filesInfo = chat.hasFiles ? ` 📎${chat.fileNames?.length}` : '';
    item.querySelector('.history-item-preview').textContent = (last ? `${last.author}: ${last.text.substring(0,50)}...` : '') + filesInfo;
    item.querySelector('.history-item-main').addEventListener('click', ()=>loadChat(chat.id));
    const fb = item.querySelector('.favorite-btn');
    if (chat.favorite) fb.classList.add('is-favorite');
    fb.addEventListener('click', e=>{ e.stopPropagation(); toggleFav(chat.id); });
    item.querySelector('.delete-btn').addEventListener('click', e=>{ e.stopPropagation(); deleteChat(chat.id); });
    historyList.appendChild(item);
  });
}

function loadChat(id) {
  const chat = getSavedChats().find(c=>c.id===id); if(!chat) return;
  currentChatId    = chat.id;
  chosenTopic      = chat.topic;
  selectedModels   = chat.models || [];
  inMemoryConversation = [...(chat.conversation || [])];
  chatTitle.textContent = 'שיחה על: ' + chosenTopic;
  chatContainer.innerHTML = '';
  (chat.conversation||[]).forEach(msg=>addMessage(msg.author, msg.emoji, msg.color, msg.text, false));
  updateViewState('chat'); toggleHistory(false);
  continueChatBtn.classList.remove('hidden');
  setGenerating(false);
}

function deleteChat(id) {
  if (!confirm('למחוק?')) return;
  saveChats(getSavedChats().filter(c=>c.id!==id));
  if (currentChatId===id) { clearConversation(true); updateViewState('setup'); }
  renderHistoryList();
}

function toggleFav(id) {
  let chats = getSavedChats(); const idx=chats.findIndex(c=>c.id===id);
  if(idx>-1){ chats[idx].favorite=!chats[idx].favorite; saveChats(chats); renderHistoryList(); }
}

function toggleHistory(show) {
  const open = show===undefined ? !historyPanel.classList.contains('open') : show;
  historyPanel.classList.toggle('open', open);
  historyPanelOverlay.classList.toggle('hidden', !open);
  document.body.classList.toggle('history-open', open);
}

// ============================================================
//  CHAT UI
// ============================================================
function updateViewState(state) {
  setupSection.classList.toggle('hidden', state==='chat');
  chatSection.classList.toggle('hidden',  state==='setup');
  newChatBtn.classList.toggle('hidden',   state==='setup');
  // Show/hide mid-chat controls
  const midModelsBtn   = document.getElementById('toggle-mid-models-btn');
  const midUserBtn     = document.getElementById('toggle-user-input-btn');
  const midModelsPanel = document.getElementById('mid-chat-models');
  const midUserArea    = document.getElementById('user-mid-input-area');
  if (state === 'setup') {
    midModelsBtn?.classList.add('hidden');
    midUserBtn?.classList.add('hidden');
    midModelsPanel?.classList.add('hidden');
    midUserArea?.classList.add('hidden');
    // כשחוזרים לsetup — הסתר כפתור עצור
    chatPaused = false;
    updateStopBtn();
  } else {
    midModelsBtn?.classList.remove('hidden');
    midUserBtn?.classList.remove('hidden');
    // כשנכנסים לצ'אט — עדכן מצב כפתור
    updateStopBtn();
  }
}

// ── Parse think tags from model response ──────────────────────
function parseThinkTags(raw) {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  let thinking = '';
  let text = raw;
  const matches = [...raw.matchAll(thinkRegex)];
  if (matches.length) {
    thinking = matches.map(m => m[1].trim()).join('\n\n');
    text = raw.replace(thinkRegex, '').trim();
  }
  // גם הסר תגיות <think> שנפתחו אבל לא נסגרו
  text = text.replace(/<\/?think>/gi, '').trim();
  return { thinking, text };
}

// ── Language display names ────────────────────────────────────
const LANG_LABELS = {
  js:'JavaScript', javascript:'JavaScript', ts:'TypeScript', typescript:'TypeScript',
  jsx:'React JSX', tsx:'React TSX', py:'Python', python:'Python',
  html:'HTML', css:'CSS', json:'JSON', sql:'SQL', bash:'Bash', sh:'Shell',
  java:'Java', c:'C', cpp:'C++', cs:'C#', go:'Go', rs:'Rust', rust:'Rust',
  php:'PHP', rb:'Ruby', ruby:'Ruby', swift:'Swift', kt:'Kotlin', kotlin:'Kotlin',
  xml:'XML', yaml:'YAML', yml:'YAML', md:'Markdown', r:'R', dart:'Dart',
  vue:'Vue', svelte:'Svelte',
};

// ── Detect file extension for download ───────────────────────
const LANG_EXT = {
  js:'js', javascript:'js', ts:'ts', typescript:'ts', jsx:'jsx', tsx:'tsx',
  py:'py', python:'py', html:'html', css:'css', json:'json', sql:'sql',
  bash:'sh', sh:'sh', java:'java', c:'c', cpp:'cpp', cs:'cs', go:'go',
  rs:'rs', rust:'rs', php:'php', rb:'rb', ruby:'rb', swift:'swift',
  kt:'kt', kotlin:'kt', xml:'xml', yaml:'yml', yml:'yml', md:'md', r:'r',
  dart:'dart', vue:'vue', svelte:'svelte',
};

// ── Escape HTML (for use inside <code>) ──────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Build a code block element ────────────────────────────────
function buildCodeBlock(lang, code) {
  const label   = (lang && LANG_LABELS[lang.toLowerCase()]) || lang || 'קוד';
  const ext     = (lang && LANG_EXT[lang.toLowerCase()])    || 'txt';
  const escaped = escHtml(code);
  const id      = 'cb-' + Math.random().toString(36).slice(2,8);

  const wrap = document.createElement('div');
  wrap.className = 'code-block-wrap';
  wrap.innerHTML = `
    <div class="code-block-header">
      <span class="code-block-lang">${label}</span>
      <div class="code-block-actions">
        <button class="code-action-btn copy-btn" data-target="${id}" title="העתק קוד">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          העתק
        </button>
        <button class="code-action-btn download-btn" data-target="${id}" data-ext="${ext}" data-lang="${label}" title="הורד קובץ">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          הורד
        </button>
      </div>
    </div>
    <pre class="code-block-pre"><code id="${id}" class="code-block-code lang-${lang||'plain'}">${escaped}</code></pre>`;

  // Copy
  wrap.querySelector('.copy-btn').addEventListener('click', function() {
    const text = document.getElementById(id)?.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> הועתק!`;
      this.classList.add('copied');
      setTimeout(() => {
        this.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> העתק`;
        this.classList.remove('copied');
      }, 2000);
    }).catch(() => {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = document.getElementById(id)?.textContent || '';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      this.textContent = '✓ הועתק!';
      setTimeout(() => { this.textContent = 'העתק'; }, 2000);
    });
  });

  // Download
  wrap.querySelector('.download-btn').addEventListener('click', async function() {
    const btn      = this;
    const text     = document.getElementById(id)?.textContent || '';
    const ext2     = btn.dataset.ext || 'txt';
    const filename = `code.${ext2}`;
    const origHTML = btn.innerHTML;
    const doneHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> נשמר!`;
    const dlHTML   = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> הורד`;

    if (useServerProxy && isExeMode) {
      // EXE: open native save dialog
      try {
        const result = await saveViaServer(filename, text, 'text');
        if (result.cancelled) return;
        if (!result.ok) throw new Error(result.error || 'שגיאת שמירה');
        btn.innerHTML = doneHTML;
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = dlHTML; btn.classList.remove('copied'); }, 2000);
      } catch(err) { alert('שגיאה בשמירה: ' + err.message); }
      return;
    }

    // Browser fallback
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    btn.innerHTML = doneHTML;
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = dlHTML; btn.classList.remove('copied'); }, 2000);
  });

  return wrap;
}

// ── Format text for display (line breaks + basic styling) ──────
// Always returns a DOM element (never a plain string).
function formatText(raw) {
  const fenceRe = /```([^\n`]*)\n?([\s\S]*?)```/g;
  const wrapper = document.createElement('div');
  wrapper.className = 'msg-formatted';
  let lastIndex = 0;
  let match;
  let hasCodeBlock = false;

  while ((match = fenceRe.exec(raw)) !== null) {
    hasCodeBlock = true;
    // Text before this code block
    const before = raw.slice(lastIndex, match.index);
    if (before.trim()) {
      const div = document.createElement('div');
      div.innerHTML = formatInline(before);
      wrapper.appendChild(div);
    }
    // Code block
    const lang = match[1].trim().toLowerCase();
    const code = match[2].replace(/\n$/, ''); // trim trailing newline
    wrapper.appendChild(buildCodeBlock(lang, code));
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  const tail = raw.slice(lastIndex);
  if (tail.trim() || !hasCodeBlock) {
    const div = document.createElement('div');
    div.innerHTML = formatInline(tail || raw);
    wrapper.appendChild(div);
  }

  return wrapper;
}

// ── Inline text formatting (no code blocks) ───────────────────
function formatInline(raw) {
  let t = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Inline code `...`
  t = t.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
  // Bold
  t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  t = t.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Line breaks
  t = t.replace(/\n\n+/g, '</p><p>');
  t = t.replace(/\n/g, '<br>');
  return `<p>${t}</p>`;
}

function addMessage(author, emoji, color, text, persist=true) {
  const { thinking, text: cleanText } = parseThinkTags(text);

  const el = msgTemplate.content.cloneNode(true).firstElementChild;
  el.querySelector('.avatar').textContent          = emoji;
  el.querySelector('.avatar').style.borderColor    = color;
  el.querySelector('.message-author').textContent  = author;
  el.querySelector('.message-author').style.color  = color;

  const msgTextEl = el.querySelector('.message-text');

  // ── thinking block (collapsible) ──
  if (thinking) {
    const details = document.createElement('details');
    details.className = 'think-block';
    const summary = document.createElement('summary');
    summary.className = 'think-toggle';
    summary.textContent = '🧠 הצג תהליך חשיבה';
    const thinkContent = document.createElement('div');
    thinkContent.className = 'think-content';
    thinkContent.appendChild(formatText(thinking));
    details.appendChild(summary);
    details.appendChild(thinkContent);
    msgTextEl.appendChild(details);
  }

  // ── actual response ──
  const responseDiv = document.createElement('div');
  responseDiv.className = 'response-text';
  responseDiv.appendChild(formatText(cleanText));
  msgTextEl.appendChild(responseDiv);

  chatContainer.appendChild(el);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  if (persist) {
    const msgObj = { author, emoji, color, text };
    inMemoryConversation.push(msgObj);
    const conv = getSavedChats().find(c=>c.id===currentChatId)?.conversation || [];
    persistChat([...conv, msgObj]);
  }
}

function showTyping(author, emoji, color) {
  const el = msgTemplate.content.cloneNode(true).firstElementChild;
  el.id = 'typing-indicator';
  el.querySelector('.avatar').textContent       = emoji;
  el.querySelector('.avatar').style.borderColor = color;
  el.querySelector('.message-author').textContent = author;
  el.querySelector('.message-author').style.color = color;
  el.querySelector('.message-text').innerHTML   = '<div class="thinking-indicator"><div class="dot-flashing"></div></div>';
  chatContainer.appendChild(el);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
function removeTyping() { document.getElementById('typing-indicator')?.remove(); }

function updateProgress() {
  const pausedStr = chatPaused ? ' ⏸' : ' 🔄';
  progressIndicator.textContent = (totalRounds === 0)
    ? `סיבוב ${currentRound} ∞${pausedStr}`
    : `סיבוב ${currentRound} מתוך ${totalRounds}${pausedStr}`;
}

function updateStopBtn() {
  if (!stopChatBtn) return;
  if (!isGenerating && !chatPaused) {
    // שיחה לא פעילה ולא מושהית — הסתר
    stopChatBtn.classList.add('hidden');   // ← פשוט הסתר, ללא קריאה רקורסיבית
    return;
  }
  stopChatBtn.classList.remove('hidden');
  stopChatBtn.disabled = false;
  if (chatPaused) {
    stopChatBtn.textContent = '▶ המשך שיחה';
    stopChatBtn.className   = 'stop-btn stop-btn--resume';
  } else {
    stopChatBtn.textContent = '⏹ עצור שיחה';
    stopChatBtn.className   = 'stop-btn stop-btn--stop';
  }
}

function setGenerating(gen) {
  isGenerating = gen;
  if (!gen) chatPaused = false;
  [startChatBtn, continueChatBtn, clearChatBtn, editApiKeyBtn, openHistoryBtn,
   topicInput, suggestTopicsBtn].forEach(el=>{ if(el) el.disabled=gen; });
  modelChipsArea.querySelectorAll('.model-chip').forEach(c=>c.disabled=gen);
  startChatBtn.textContent = gen ? 'מייצר שיחה... 🧠' : 'התחל שיחה ✨';
  updateStopBtn();
}

// ============================================================
//  MAIN CONVERSATION LOOP
// ============================================================
async function runConversation(rounds) {
  if (isGenerating) return;
  if (selectedModels.length < 2) { alert('בחר לפחות 2 מודלים לשיחה.'); return; }

  setGenerating(true);
  stopRequested = false;
  chatPaused    = false;
  const isUnlimited = (rounds === 0) || (settingsRounds === 0 && rounds === undefined);
  const loopRounds  = isUnlimited ? 9999 : (rounds || settingsRounds || 5);
  totalRounds = isUnlimited ? 0 : (totalRounds + (loopRounds === 9999 ? 0 : loopRounds));
  continueChatBtn.classList.add('hidden');

  const fileContextStr = buildFileContextString();

  // Show file context badge if files are attached
  if (fileContextStr) {
    fileContextBadge.classList.remove('hidden');
    fileContextText.textContent = `${uploadedFiles.length} קוב${uploadedFiles.length===1?'ץ':'צים'} מצורפ${uploadedFiles.length===1?'':'ים'} לשיחה: ${uploadedFiles.map(f=>f.name).join(', ')}`;
  }

  const participants = selectedModels.map((mid, i) => {
    const m = HF_MODELS.find(x=>x.id===mid) || { name: mid, emoji:'🤖' };
    return { mid, name: m.name, emoji: m.emoji, color: getModelColor(i) };
  });

  const otherModelsStr = (speaker) =>
    participants.filter(p => p.mid !== speaker.mid).map(p => p.name).join(', ');

  const getHistory = () => inMemoryConversation.slice(-8);

  for (let i = 0; i < loopRounds; i++) {
    if (stopRequested) break;

    // ── המתן בזמן שהמשתמש מקליד (שינוי 4) ──────────────────
    if (userIsTypingMid) {
      while (userIsTypingMid && !stopRequested) await sleep(200);
    }
    if (stopRequested) break;

    // ── המתן כשהשיחה מושהית (שינוי 2) ───────────────────────
    if (chatPaused) {
      while (chatPaused && !stopRequested) await sleep(300);
    }
    if (stopRequested) break;

    // ── טפל בהודעת משתמש שממתינה (שינוי 4) ─────────────────
    if (pendingUserMidMsg) {
      // הודעת המשתמש כבר נוספה ויזואלית ב-addMessage — רק נאפס
      pendingUserMidMsg = null;
      // עדכן participants מחדש כי ייתכן שינוי מודלים (שינוי 3)
      participants.length = 0;
      selectedModels.forEach((mid, idx) => {
        const m = HF_MODELS.find(x=>x.id===mid) || { name: mid, emoji:'🤖' };
        participants.push({ mid, name: m.name, emoji: m.emoji, color: getModelColor(idx) });
      });
    }

    // ── עדכן participants אם השתנו המודלים (שינוי 3) ────────
    if (participants.length !== selectedModels.length ||
        participants.some((p, i) => p.mid !== selectedModels[i])) {
      participants.length = 0;
      selectedModels.forEach((mid, idx) => {
        const m = HF_MODELS.find(x=>x.id===mid) || { name: mid, emoji:'🤖' };
        participants.push({ mid, name: m.name, emoji: m.emoji, color: getModelColor(idx) });
      });
    }
    if (!participants.length) break;

    currentRound++;
    updateProgress();

    const speaker = participants[currentRound % participants.length];
    const personaPrompt = getSystemPromptFor(speaker.mid);
    const others = otherModelsStr(speaker);

    const systemPrompt = `אתה ${speaker.name}, מודל שפה מבוסס בינה מלאכותית.
אתה משתתף בשיחה עם מודלי AI אחרים בנושא: "${chosenTopic}".
המודלים האחרים בשיחה: ${others}.

כללים חשובים:
- **חובה מוחלטת: כתוב בעברית בלבד. אסור בתכלית האיסור לכתוב מילה אחת בשפה אחרת — לא אנגלית, לא סינית, לא ערבית, לא לטינית, ולא כל שפה אחרת. אם אתה חושב במחשבות פנימיות (<think>), גם הן חייבות להיות בעברית בלבד.**
- כל מילה, כל משפט, כל ביטוי — עברית בלבד. גם שמות מושגים, טרמינולוגיה מקצועית, ושמות פרטיים — כתוב אותם בעברית או תעתיק לאותיות עבריות.
- דבר בגוף ראשון, בצורה ישירה ושוטפת — כמו שיחת אנשים רגילה, לא פורום.
- אתה יודע שהמשתתפים האחרים הם מודלי AI, אך דבר איתם כמו שדוברים בין עמיתים.
- אל תציין @ לפני שם מודל. אם תרצה לפנות למישהו ספציפי, פשוט ציין שמו בתוך המשפט.
- הישאר בנושא: "${chosenTopic}". דבר כמה שמתאים — אל תקצר מלאכותית.
- אל תפתח בביטויים כמו "בתור מודל AI..." או "כמודל שפה...".
${personaPrompt ? `\nאישיות שלך:\n${personaPrompt}` : ''}
- כתוב ישירות, טבעי, **בעברית בלבד ללא יוצא מן הכלל**.`;

    const history  = getHistory().slice(-8);
    const histText = history.map(m=>`${m.author}: ${m.text}`).join('\n');
    const userMsg  = history.length
      ? `הנה השיחה עד כה:\n${histText}\n\nעכשיו תורך, ${speaker.name}. הגב בעברית בלבד, בצורה טבעית וישירה. אסור לכתוב אפילו מילה אחת בשפה שאינה עברית — לא אנגלית, לא סינית, לא כל שפה אחרת.`
      : `פתח את השיחה על "${chosenTopic}" בעברית בלבד, בצורה ישירה ומעניינת. אסור לכתוב אפילו מילה אחת בשפה שאינה עברית.`;

    try {
      showTyping(speaker.name, speaker.emoji, speaker.color);
      const raw = await callAI(speaker.mid, systemPrompt, [], userMsg, fileContextStr);
      removeTyping();
      // עדכן מונה טוקנים (הערכה: תו אחד ≈ 0.35 טוקן)
      const msgTokens = Math.ceil((systemPrompt.length + userMsg.length + raw.length) / 3);
      sessionTokensUsed  += msgTokens;
      sessionRoundsCount += 1;
      updateTokenCounter();
      addMessage(speaker.name, speaker.emoji, speaker.color, raw);
    } catch(err) {
      removeTyping();
      addMessage(`⚠️ שגיאה — ${speaker.name}`, speaker.emoji, '#e03131', `שגיאה: ${err.message}`, false);
    }

    if (stopRequested) break;
    await sleep(600);
  }

  setGenerating(false);
  updateStopBtn();
  if (currentChatId) continueChatBtn.classList.remove('hidden');
}

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

async function startNewConversation() {
  if (isGenerating) return;
  if (selectedModels.length < 2 && !isDevMode) { alert('בחר לפחות 2 מודלים לשיחה.'); return; }
  if (selectedModels.length < 1 && isDevMode)  { alert('בחר לפחות מודל אחד.'); return; }

  if (isDevMode) {
    await runDevConversation();
    return;
  }

  if (topicMode === 'user') {
    chosenTopic = topicInput.value.trim();
    if (!chosenTopic) { alert('הכנס נושא לשיחה.'); return; }
  } else {
    if (!chosenTopic) { alert('בחר נושא מהרשימה שהוצעה על ידי המודלים.'); return; }
  }

  clearConversation(false);
  currentChatId         = Date.now();
  inMemoryConversation  = [];
  chatTitle.textContent = 'שיחה על: ' + chosenTopic;
  updateViewState('chat');
  await runConversation(settingsRounds || 0);  // 0 = ללא הגבלה (ברירת מחדל)
}

function clearConversation(goToSetup=true) {
  if (isGenerating && goToSetup) return;  // רק חוסם אם המשתמש מנסה לנקות ידנית תוך כדי יצירה
  currentChatId = null; currentRound = 0; totalRounds = 0;
  inMemoryConversation = [];
  sessionTokensUsed = 0; sessionRoundsCount = 0;
  const tc = document.getElementById('token-counter');
  if (tc) tc.classList.add('hidden');
  chatContainer.innerHTML = '';
  progressIndicator.textContent = '';
  continueChatBtn.classList.add('hidden');
  chatPaused = false; updateStopBtn();
  fileContextBadge.classList.add('hidden');
  if (goToSetup) {
    updateViewState('setup');
    chosenTopic=''; topicInput.value=''; aiTopicSuggestions.innerHTML='';
  }
}

// ============================================================
//  TOKEN COUNTER
// ============================================================
// ── HF Quota info (per official HF Inference Rate Limits docs) ──────────────────
// Free tier: ~40,000 tokens/day (resets at midnight UTC).
// Serverless Inference limits reset daily at 00:00 UTC.
function getHFResetInfo() {
  const now   = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const diffMs  = reset - now;
  const hrs     = Math.floor(diffMs / 3_600_000);
  const mins    = Math.floor((diffMs % 3_600_000) / 60_000);
  const hStr    = hrs  > 0 ? `${hrs} שעות ` : '';
  const mStr    = mins > 0 ? `${mins} דק׳`  : '< דקה';
  // Convert reset time to local time string
  const localReset = reset.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' });
  return { label: `${hStr}${mStr}`, localReset };
}

function updateTokenCounter() {
  const el = document.getElementById('token-counter');
  if (!el) return;
  const avgPerRound = sessionRoundsCount > 0
    ? Math.round(sessionTokensUsed / sessionRoundsCount) : 0;
  // HF free tier: ~40,000 tokens/day (Serverless Inference, resets midnight UTC)
  const DAILY_QUOTA = 40_000;
  const estimatedRemaining = avgPerRound > 0
    ? Math.floor(DAILY_QUOTA / avgPerRound) : '∞';
  const { label: resetIn, localReset } = getHFResetInfo();

  el.innerHTML = `
    <span title="טוקנים שנוצלו בסשן הנוכחי">🔢 ${sessionTokensUsed.toLocaleString()} טוקן</span>
    <span class="token-sep">|</span>
    <span title="ממוצע לסיבוב">⚡ ${avgPerRound.toLocaleString()} / סיבוב</span>
    <span class="token-sep">|</span>
    <span title="הערכת סיבובים נותרים (מכסה ~40K טוקן יומית — HF Serverless Inference)">🔄 ~${estimatedRemaining} סיבובים נותרים</span>
    <span class="token-sep">|</span>
    <span class="token-reset-info" title="המכסה מתחדשת כל יום בחצות UTC (לפי תיעוד HF Inference Rate Limits)">⏰ מתחדש בעוד ${resetIn} (${localReset} שעון מקומי)</span>
  `;
  el.classList.remove('hidden');
}

// ============================================================
//  PODCAST GENERATION (Gemini TTS)
// ============================================================
// גברים בלבד — 10 קולות שונים
// קולות גבריים בלבד מ-Gemini TTS
const MALE_VOICES = [
  'Sadaltager', 'Charon', 'Fenrir', 'Orus', 'Achernar',
  'Gacrux',     'Rasalgethi', 'Achird', 'Algenib', 'Iapetus'
];

// ── Podcast floating panel helpers ────────────────────────────
let _podcastBlobUrl   = null;
let _podcastRawBase64 = null;   // EXE native-save fallback
let _podcastFilename  = '';
let _progressTimer    = null;

const RING_CIRC = 226; // 2 * π * 36

function setPodcastProgress(pct) {
  const fill = document.getElementById('podcast-ring-fill');
  const num  = document.getElementById('podcast-pct-num');
  if (!fill || !num) return;
  const offset = RING_CIRC * (1 - pct / 100);
  fill.style.strokeDashoffset = offset;
  num.textContent = Math.round(pct) + '%';
}

function startProgressTimer(scriptLen) {
  // Based on Gemini TTS benchmarks: ~180 chars/sec, min 12s, max 110s
  const estimatedSec = Math.min(110, Math.max(12, scriptLen / 180));
  const startTime = Date.now();

  // Update every 400ms with realistic easing (fast start, slow near end)
  _progressTimer = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    // Ease-out curve: reaches ~90% at estimated time, never hits 100 until done
    const raw = elapsed / estimatedSec;
    const pct = 95 * (1 - Math.exp(-2.5 * raw));
    setPodcastProgress(Math.min(94, pct));

    // Update status text at milestones
    const p = document.getElementById('podcast-progress-text');
    if (!p) return;
    const secLeft = Math.max(0, Math.round(estimatedSec - elapsed));
    if (pct < 20) p.textContent = 'מעבד תסריט ומגדיר קולות...';
    else if (pct < 50) p.textContent = `מסנתז שמע... כ-${secLeft} שניות`;
    else if (pct < 80) p.textContent = `מעבד נתוני אודיו... כ-${secLeft} שניות`;
    else p.textContent = 'מסיים עיבוד ובונה קובץ...';
  }, 400);
}

function stopProgressTimer() {
  if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
}

function showPodcastPanel() {
  const panel = document.getElementById('podcast-panel');
  document.getElementById('podcast-progress-wrap').classList.remove('hidden');
  document.getElementById('podcast-audio-wrap').classList.add('hidden');
  document.getElementById('podcast-error-wrap').classList.add('hidden');
  // Update header title
  panel.querySelector('.podcast-panel-title span').textContent = 'יוצר פודקאסט';
  setPodcastProgress(0);
  panel.classList.remove('hidden');
}

function podcastPanelDone(blobUrl, filename, rawBase64 = null) {
  stopProgressTimer();
  setPodcastProgress(100);
  // Brief pause to show 100%, then switch to player
  setTimeout(() => {
    document.getElementById('podcast-progress-wrap').classList.add('hidden');
    document.getElementById('podcast-error-wrap').classList.add('hidden');
    const audioWrap = document.getElementById('podcast-audio-wrap');
    audioWrap.classList.remove('hidden');
    document.getElementById('podcast-player').src = blobUrl;
    document.querySelector('#podcast-panel .podcast-panel-title span').textContent = 'פודקאסט מוכן';
    _podcastBlobUrl   = blobUrl;
    _podcastRawBase64 = rawBase64;
    _podcastFilename  = filename;
  }, 600);
}

function podcastPanelError(msg) {
  stopProgressTimer();
  document.getElementById('podcast-progress-wrap').classList.add('hidden');
  document.getElementById('podcast-audio-wrap').classList.add('hidden');
  const errWrap = document.getElementById('podcast-error-wrap');
  errWrap.classList.remove('hidden');
  document.getElementById('podcast-error-msg').textContent = msg;
  document.querySelector('#podcast-panel .podcast-panel-title span').textContent = 'שגיאה';
}

async function generatePodcast() {
  if (!geminiApiKey) {
    alert('הכנס מפתח Gemini API בהגדרות כדי ליצור פודקאסט.');
    document.getElementById('api-key-modal').classList.add('show');
    return;
  }

  const conversation = inMemoryConversation.length
    ? inMemoryConversation
    : (getSavedChats().find(c => c.id === currentChatId)?.conversation || []);
  if (!conversation.length) { alert('אין שיחה לייצוא כפודקאסט.'); return; }

  // ── מפה: שם מחבר → label דובר — Gemini TTS מאפשר בדיוק 2 ──
  const uniqueAuthors = [];
  conversation.forEach(m => {
    if (m.author && !m.author.includes('שגיאה') && !uniqueAuthors.includes(m.author))
      uniqueAuthors.push(m.author);
  });

  const speakerMap = {};
  uniqueAuthors.forEach((author, i) => {
    speakerMap[author] = i === 0 ? 'speaker1' : 'speaker2';
  });

  const scriptLines = conversation
    .filter(m => m.author && m.text && !m.author.includes('שגיאה'))
    .map(m => {
      const label = speakerMap[m.author] || 'speaker1';
      const clean = m.text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();
      return `${label}: ${clean}`;
    })
    .filter(l => l.length > 10);

  if (!scriptLines.length) { alert('אין תוכן מתאים לפודקאסט.'); return; }

  const script = scriptLines.join('\n\n');
  const speakerVoiceConfigs = [
    { speaker: 'speaker1', voiceConfig: { prebuiltVoiceConfig: { voiceName: MALE_VOICES[0] } } },
    { speaker: 'speaker2', voiceConfig: { prebuiltVoiceConfig: { voiceName: MALE_VOICES[1] } } },
  ];

  const safeTitle = (chosenTopic || 'podcast')
    .replace(/[^\w\u0590-\u05FF\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);
  _podcastFilename = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.wav`;

  // ── הצג פאנל והתחל ברקע ──────────────────────────────────
  showPodcastPanel();
  startProgressTimer(script.length);

  // async — לא חוסם את ה-UI
  (async () => {
    try {
      const res = await fetch(`${serverUrl}/api/podcast`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ gemini_key: geminiApiKey, script, speaker_configs: speakerVoiceConfigs })
      });
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try { errMsg = (await res.json())?.error || errMsg; } catch(_) {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      if (!data.audio_b64) throw new Error('השרת לא החזיר שמע — ייתכן שהתסריט קצר מדי.');

      const pcmBytes   = Uint8Array.from(atob(data.audio_b64), c => c.charCodeAt(0));
      const wavBlob    = createWavFromPcm(pcmBytes);
      const blobUrl    = URL.createObjectURL(wavBlob);
      // Pass raw audio_b64 so the EXE can save via native dialog
      podcastPanelDone(blobUrl, _podcastFilename, data.audio_b64);

    } catch(e) {
      podcastPanelError(e.message);
    }
  })();
}

function createWavFromPcm(pcmData) {
  const numChannels = 1, sampleRate = 24000, bitsPerSample = 16;
  const dataSize = pcmData.length;
  const buf  = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const str  = (off, s) => { for(let i=0;i<s.length;i++) view.setUint8(off+i, s.charCodeAt(i)); };
  str(0,'RIFF'); view.setUint32(4,36+dataSize,true); str(8,'WAVE');
  str(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
  view.setUint16(22,numChannels,true); view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*numChannels*(bitsPerSample/8),true);
  view.setUint16(32,numChannels*(bitsPerSample/8),true); view.setUint16(34,bitsPerSample,true);
  str(36,'data'); view.setUint32(40,dataSize,true);
  new Uint8Array(buf,44).set(pcmData);
  return new Blob([buf],{type:'audio/wav'});
}

// ============================================================
//  EXPORT
// ============================================================
async function exportChat(fmt) {
  // השתמש בזיכרון הפנימי כמקור ראשי (מלא), ולוקלסטורג' כגיבוי
  const storedChat = getSavedChats().find(c=>c.id===currentChatId);
  const conversation = inMemoryConversation.length
    ? inMemoryConversation
    : (storedChat?.conversation || []);
  const topic = storedChat?.topic || chosenTopic || 'שיחה';

  if (!conversation.length) { alert('אין שיחה לשמור.'); return; }
  const name = topic.replace(/[^\w\u0590-\u05FF ]/g,'').replace(/ /g,'_') || 'chat';

  if (fmt==='txt') {
    const txt = `נושא: ${topic}\n\n` + conversation.map(m=>`${m.author}:\n${m.text}\n`).join('\n');
    await download(`${name}.txt`, txt, 'text/plain;charset=utf-8');

  } else if (fmt==='html') {
    const rows = conversation.map(m=>`
      <div style="margin-bottom:1.2em;padding:1em;background:#f9f9f9;border-radius:8px;border-right:4px solid ${m.color||'#ccc'}">
        <div style="font-weight:bold;color:${m.color||'#333'};margin-bottom:.4em">${m.emoji||''} ${m.author}</div>
        <div style="white-space:pre-wrap;direction:rtl">${m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      </div>`).join('');
    const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
      <title>שיחה: ${topic}</title>
      <style>body{font-family:Arial,sans-serif;max-width:800px;margin:2em auto;padding:1em;background:#fff;direction:rtl}
      h1{color:#333;border-bottom:2px solid #4263eb;padding-bottom:.5em}</style></head>
      <body><h1>🤗 שיחה על: ${topic}</h1>${rows}</body></html>`;
    await download(`${name}.html`, html, 'text/html;charset=utf-8');

  } else if (fmt==='pdf') {
    const rows = conversation.map(m=>`
      <div style="margin-bottom:1em;padding:.8em;background:#f5f5f5;border-radius:6px;border-right:4px solid ${m.color||'#ccc'};page-break-inside:avoid">
        <div style="font-weight:bold;color:${m.color||'#333'};margin-bottom:.3em">${m.emoji||''} ${m.author}</div>
        <div style="white-space:pre-wrap">${m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      </div>`).join('');
    const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
      <title>שיחה: ${topic}</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:750px;margin:1.5em auto;padding:1em;direction:rtl}
        h1{font-size:1.3em;border-bottom:2px solid #4263eb;padding-bottom:.4em;color:#222}
        @media print{body{margin:0}}
      </style></head>
      <body><h1>🤗 שיחה על: ${topic}</h1>${rows}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;
    const w = window.open('','_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else alert('אפשר חלונות קופצים בדפדפן כדי לשמור כ-PDF.');

  } else if (fmt==='word') {
    const rows = conversation.map(m=>`
      <p><b><font color="${m.color||'#333'}">${m.emoji||''} ${m.author}</font></b><br/>
      ${m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</p>
      <hr/>`).join('');
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8">
      <style>body{font-family:Arial;direction:rtl} p{margin-bottom:1em}</style></head>
      <body dir="rtl">
      <h2>שיחה על: ${topic}</h2>
      ${rows}</body></html>`;
    await download(`${name}.doc`, doc, 'application/msword;charset=utf-8');
  }
}

// ── Native save via Flask (for EXE / pywebview) ───────────────
async function saveViaServer(filename, content, encoding = 'text') {
  const res = await fetch(`${serverUrl}/api/save-file`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ filename, content, encoding }),
  });
  const data = await res.json().catch(() => ({}));
  return data; // { ok, path } or { ok:false, cancelled, error }
}

// ── Universal download — server dialog in EXE, blob in browser ─
async function download(name, content, mime, isUrl = false) {
  // Only use native save dialog in the EXE (not on web/Vercel)
  if (useServerProxy && isExeMode) {
    try {
      let textContent = content;
      let encoding    = 'text';

      if (isUrl) {
        // It's a blob URL — fetch its bytes and send as base64
        const resp  = await fetch(content);
        const buf   = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary  = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        textContent = btoa(binary);
        encoding    = 'base64';
      } else if (mime && mime.includes('charset') === false && typeof content !== 'string') {
        // binary blob
        encoding = 'base64';
      }

      const result = await saveViaServer(name, textContent, encoding);
      if (result.cancelled) return; // user closed dialog — no error
      if (!result.ok) throw new Error(result.error || 'שגיאת שמירה');
      return;
    } catch (err) {
      console.warn('Server save failed, falling back to browser download:', err);
      // fall through to browser method below
    }
  }

  // Browser / fallback: standard anchor click
  const a = document.createElement('a');
  a.download = name;
  a.href = isUrl ? content : URL.createObjectURL(new Blob([content], { type: mime }));
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (!isUrl) URL.revokeObjectURL(a.href);
}


// ============================================================
//  MID-CHAT MODEL MANAGER (שינויים 3)
// ============================================================
function renderMidChatActiveModels() {
  const list = document.getElementById('mid-chat-active-models');
  if (!list) return;
  list.innerHTML = '';
  selectedModels.forEach((mid, idx) => {
    const m   = HF_MODELS.find(x=>x.id===mid) || { name:mid, emoji:'🤖' };
    const tag = document.createElement('div');
    tag.className = 'mid-active-model-tag';
    tag.style.borderColor = getModelColor(idx);
    tag.innerHTML = `
      <span>${m.emoji} ${m.name}</span>
      <button class="mid-remove-model" data-id="${mid}" title="הסר מהשיחה" ${selectedModels.length<=1?'disabled':''}>✕</button>
    `;
    tag.querySelector('.mid-remove-model').addEventListener('click', () => {
      if (selectedModels.length <= 1) return;
      selectedModels = selectedModels.filter(id => id !== mid);
      renderMidChatActiveModels();
      renderMidChatChips();
      renderSelectedTags();
    });
    list.appendChild(tag);
  });
}

function renderMidChatChips(filter='') {
  const area = document.getElementById('mid-chat-chips');
  if (!area) return;
  const q = filter.toLowerCase();
  area.innerHTML = '';
  HF_MODELS
    .filter(m => !selectedModels.includes(m.id) && (!q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)))
    .slice(0, 20)
    .forEach(m => {
      const chip = document.createElement('button');
      chip.className   = 'mid-add-chip';
      chip.textContent = `${m.emoji} ${m.name}`;
      chip.addEventListener('click', () => {
        if (!selectedModels.includes(m.id)) {
          selectedModels.push(m.id);
          renderMidChatActiveModels();
          renderMidChatChips(document.getElementById('mid-chat-search')?.value || '');
          renderSelectedTags();
        }
      });
      area.appendChild(chip);
    });
}

function setupMidChatControls() {
  const toggleModelsBtn = document.getElementById('toggle-mid-models-btn');
  const midModelsPanel  = document.getElementById('mid-chat-models');
  const closeMidModels  = document.getElementById('close-mid-models-btn');
  const midSearch       = document.getElementById('mid-chat-search');

  toggleModelsBtn?.addEventListener('click', () => {
    const open = midModelsPanel?.classList.toggle('hidden') === false;
    if (open === false) { /* just closed */
    } else {
      // opened — also means hidden was toggled off = panel visible
    }
    // classList.toggle returns true if class was ADDED (panel hidden), false if removed (panel visible)
    // Re-render each time panel opens
    renderMidChatActiveModels();
    renderMidChatChips('');
  });

  closeMidModels?.addEventListener('click', () => {
    midModelsPanel?.classList.add('hidden');
  });

  midSearch?.addEventListener('input', () => {
    renderMidChatChips(midSearch.value);
  });

  // ── User mid-conversation input (שינוי 4) ──────────────────
  const toggleUserInputBtn = document.getElementById('toggle-user-input-btn');
  const userMidArea        = document.getElementById('user-mid-input-area');
  const userMidInput       = document.getElementById('user-mid-input');
  const sendMidBtn         = document.getElementById('send-mid-btn');

  toggleUserInputBtn?.addEventListener('click', () => {
    userMidArea?.classList.toggle('hidden');
    if (!userMidArea?.classList.contains('hidden')) {
      userMidInput?.focus();
    }
  });

  // While typing — set flag so conversation loop pauses
  userMidInput?.addEventListener('focus', () => { userIsTypingMid = true; });
  userMidInput?.addEventListener('blur',  () => {
    // only clear flag if input is empty (they clicked away without sending)
    if (!userMidInput.value.trim()) userIsTypingMid = false;
  });
  userMidInput?.addEventListener('input', () => {
    userIsTypingMid = userMidInput.value.trim().length > 0;
  });

  // Send on button click or Ctrl+Enter
  const doSendMid = () => {
    const msg = userMidInput?.value.trim();
    if (!msg) return;
    pendingUserMidMsg = msg;
    userIsTypingMid   = false;
    userMidInput.value = '';
    userMidArea?.classList.add('hidden');
    // Add user message visually immediately
    addMessage('👤 אתה', '👤', '#f76707', msg, true);
  };

  sendMidBtn?.addEventListener('click', doSendMid);
  userMidInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doSendMid();
  });
}

// ============================================================
//  INIT
// ============================================================
async function init() {
  buildModelChips();
  renderHistoryList();
  setupFileUpload();
  setupMidChatControls();

  // ── טעינת כל ההגדרות מ-AppData ───────────────────────────────
  const [savedKey, savedRounds, savedPersonas, savedModels, savedGemini, savedHist] = await Promise.all([
    loadFromServer(STORAGE_KEY_API),
    loadFromServer(STORAGE_KEY_ROUNDS),
    loadFromServer(STORAGE_KEY_PERSONAS),
    loadFromServer(STORAGE_KEY_MODELS),
    loadFromServer(STORAGE_KEY_GEMINI),
    loadFromServer(STORAGE_KEY_HIST),
  ]);

  // שחזר היסטוריה מ-AppData אם localStorage ריק
  if (savedHist) {
    try {
      const parsed = typeof savedHist === 'string' ? JSON.parse(savedHist) : savedHist;
      if (Array.isArray(parsed) && parsed.length) {
        const local = getSavedChats();
        if (!local.length) {
          localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(parsed));
        }
      }
    } catch(_) {}
    renderHistoryList();
  }

  // טעינת מפתח Gemini
  if (savedGemini) {
    geminiApiKey = typeof savedGemini === 'string' ? savedGemini : String(savedGemini);
    const geminiInput = document.getElementById('gemini-key-input');
    if (geminiInput) geminiInput.value = geminiApiKey;
    const geminiStatus = document.getElementById('gemini-key-status');
    if (geminiStatus) geminiStatus.textContent = '✅ מפתח Gemini שמור';
  }

  if (savedRounds !== null) {
    try {
      settingsRounds = typeof savedRounds === 'number' ? savedRounds : JSON.parse(savedRounds);
      const rInput = document.getElementById('rounds-input');
      if (rInput) rInput.value = settingsRounds > 0 ? String(settingsRounds) : '';
    } catch(_) {}
  } else {
    // ברירת מחדל: ללא הגבלה (שינוי 5)
    settingsRounds = 0;
  }
  if (savedPersonas) {
    try { settingsPersonas = typeof savedPersonas === 'object' ? savedPersonas : JSON.parse(savedPersonas); } catch(_) {}
  }
  if (savedModels) {
    try {
      const parsed = typeof savedModels === 'object' ? savedModels : JSON.parse(savedModels);
      selectedModels = parsed.filter(id => HF_MODELS.some(m => m.id === id));
    } catch(_) {}
  }
  if (!selectedModels.length) {
    selectedModels = ['meta-llama/Meta-Llama-3-8B-Instruct','Qwen/Qwen2.5-7B-Instruct'];
  }
  renderModelChips('', 'all');
  renderSelectedTags();

  if (savedKey) {
    hfApiKey = typeof savedKey === 'string' ? savedKey : String(savedKey);
    apiKeyInput.value = hfApiKey;
    mainContent.classList.remove('hidden');
    checkServerHealth().then(alive => updateServerBadge(alive));
  } else {
    apiKeyModal.classList.add('show');
    mainContent.classList.add('hidden');
  }

  // ── Listeners ──────────────────────────────────────────────

  // כפתור X לסגירת מודל מפתח API
  apiKeyModalClose?.addEventListener('click', () => {
    if (hfApiKey) {
      apiKeyModal.classList.remove('show');
    } else {
      useServerProxy = false;
      apiKeyModal.classList.remove('show');
      mainContent.classList.remove('hidden');
    }
  });

  // שמירת ובדיקת מפתח Gemini
  document.getElementById('save-gemini-btn')?.addEventListener('click', async () => {
    const k      = document.getElementById('gemini-key-input')?.value.trim() || '';
    const status = document.getElementById('gemini-key-status');
    const btn    = document.getElementById('save-gemini-btn');

    if (!k) {
      geminiApiKey = '';
      saveToServer(STORAGE_KEY_GEMINI, '');
      localStorage.removeItem(STORAGE_KEY_GEMINI);
      if (status) { status.textContent = 'מפתח נמחק.'; status.className=''; }
      return;
    }

    if (status) { status.textContent = '⏳ בודק מפתח Gemini...'; status.className=''; }
    if (btn) btn.disabled = true;

    try {
      const res  = await fetch(`${serverUrl}/api/validate-gemini`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ api_key: k }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.valid === false) {
        const errMsg = data.error || 'מפתח לא תקין';
        if (status) { status.textContent = `❌ ${errMsg}`; status.style.color='var(--error)'; }
        return;
      }

      // Valid — save
      geminiApiKey = k;
      saveToServer(STORAGE_KEY_GEMINI, k);
      localStorage.setItem(STORAGE_KEY_GEMINI, k);
      if (status) {
        status.textContent = '✅ מפתח Gemini תקין ונשמר! 🎉';
        status.style.color = 'var(--success)';
      }
      setTimeout(() => {
        if (status) { status.textContent = '✅ מפתח Gemini שמור'; status.style.color=''; }
      }, 3000);
    } catch(e) {
      if (status) { status.textContent = '⚠️ שגיאת רשת: ' + e.message; status.style.color='var(--error)'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  // ── Save menu — click to open, click-outside to close ──────
  const saveMenuEl = document.querySelector('.save-menu');
  const saveMenuBtn = saveMenuEl?.querySelector('button');
  saveMenuBtn?.addEventListener('click', e => {
    e.stopPropagation();
    saveMenuEl.classList.toggle('open');
  });
  document.addEventListener('click', () => {
    saveMenuEl?.classList.remove('open');
  });
  saveMenuEl?.querySelector('.save-options')?.addEventListener('click', () => {
    saveMenuEl.classList.remove('open');
  });

  // ── Podcast panel ───────────────────────────────────────────
  document.getElementById('save-podcast')?.addEventListener('click', e => {
    e.preventDefault();
    generatePodcast();
  });

  document.getElementById('podcast-panel-close')?.addEventListener('click', () => {
    document.getElementById('podcast-panel').classList.add('hidden');
  });

  document.getElementById('podcast-download-btn')?.addEventListener('click', async () => {
    if (!_podcastBlobUrl) return;
    const btn = document.getElementById('podcast-download-btn');
    const origText = btn?.textContent || '';
    if (btn) btn.textContent = '⏳ שומר...';
    try {
      // In EXE mode: send the PCM base64 directly to server for native save dialog
      if (useServerProxy && isExeMode && _podcastRawBase64) {
        const result = await saveViaServer(_podcastFilename || 'podcast.wav', _podcastRawBase64, 'base64');
        if (result.cancelled) return;
        if (!result.ok) throw new Error(result.error || 'שגיאת שמירה');
        if (btn) btn.textContent = '✅ נשמר!';
        setTimeout(() => { if (btn) btn.textContent = origText; }, 2500);
        return;
      }
      // Browser fallback
      const a = document.createElement('a');
      a.href     = _podcastBlobUrl;
      a.download = _podcastFilename || 'podcast.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (btn) btn.textContent = '✅ הורד!';
      setTimeout(() => { if (btn) btn.textContent = origText; }, 2500);
    } catch (err) {
      alert('שגיאה בשמירה: ' + err.message);
      if (btn) btn.textContent = origText;
    }
  });

  validateApiKeyBtn.addEventListener('click', () => {
    const k = apiKeyInput.value.trim();
    const s = serverUrlInput.value.trim();
    if (k) validateAndSetApiKey(k, s);
    else { apiKeyStatus.textContent='הכנס מפתח.'; apiKeyStatus.className='status-message error'; }
  });
  apiKeyInput.addEventListener('keydown', e=>{ if(e.key==='Enter') validateApiKeyBtn.click(); });

  directModeLink?.addEventListener('click', e => {
    e.preventDefault();
    useServerProxy = false;
    localStorage.setItem(STORAGE_KEY_PROXY, 'false');
    apiKeyStatus.textContent = '';
    // Try to validate key directly
    const k = apiKeyInput.value.trim() || hfApiKey;
    if (k) {
      hfApiKey = k;
      localStorage.setItem(STORAGE_KEY_API, k); saveToServer(STORAGE_KEY_API, k);
      apiKeyModal.classList.remove('show');
      mainContent.classList.remove('hidden');
      updateServerBadge(false);
    } else {
      apiKeyStatus.textContent = 'הכנס מפתח API תחילה.';
      apiKeyStatus.className   = 'status-message error';
    }
  });

  editApiKeyBtn.addEventListener('click', async () => {
    apiKeyStatus.textContent = '';
    // נסה לטעון מהשרת (AppData) — אם נכשל, השתמש ב-hfApiKey שבזיכרון
    let savedK = hfApiKey || '';
    try {
      const fromServer = await loadFromServer(STORAGE_KEY_API);
      if (fromServer) savedK = typeof fromServer === 'string' ? fromServer : String(fromServer);
    } catch(_) {}
    apiKeyInput.value    = savedK;
    serverUrlInput.value = serverUrl;
    // הצג גם מפתח Gemini אם שמור
    const geminiInput = document.getElementById('gemini-key-input');
    if (geminiInput && geminiApiKey) geminiInput.value = geminiApiKey;
    const geminiStatus = document.getElementById('gemini-key-status');
    if (geminiStatus && geminiApiKey) { geminiStatus.textContent = '✅ מפתח Gemini שמור'; geminiStatus.style.color=''; }
    apiKeyModal.classList.add('show');
  });

  topicModeUserBtn.addEventListener('click', ()=>setTopicMode('user'));
  topicModeAiBtn.addEventListener('click',   ()=>setTopicMode('ai'));
  topicModeDevBtn?.addEventListener('click', ()=>setTopicMode('dev'));
  suggestTopicsBtn.addEventListener('click', suggestTopics);

  openSettingsBtn.addEventListener('click',    openSettings);
  openSettingsInline.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click',   closeSettings);
  saveSettingsBtn.addEventListener('click',    saveSettings);
  settingsModal.addEventListener('click', e=>{ if(e.target===settingsModal) closeSettings(); });

  openHistoryBtn.addEventListener('click', ()=>toggleHistory(true));
  closeHistoryBtn.addEventListener('click',()=>toggleHistory(false));
  historyPanelOverlay.addEventListener('click',()=>toggleHistory(false));

  newChatBtn.addEventListener('click',   ()=>{ clearConversation(false); updateViewState('setup'); });
  startChatBtn.addEventListener('click', startNewConversation);
  continueChatBtn.addEventListener('click', ()=>runConversation(settingsRounds || 0));
  clearChatBtn.addEventListener('click',    ()=>clearConversation(true));
  stopChatBtn.addEventListener('click', () => {
    if (chatPaused) {
      // Resume
      chatPaused = false;
      updateStopBtn();
    } else if (isGenerating) {
      // Pause (not full stop — just pause the loop)
      chatPaused    = true;
      updateStopBtn();
    }
  });

  saveTxtBtn.addEventListener('click',  e=>{ e.preventDefault(); exportChat('txt'); });
  savePdfBtn?.addEventListener('click', e=>{ e.preventDefault(); exportChat('pdf'); });
  saveHtmlBtn?.addEventListener('click',e=>{ e.preventDefault(); exportChat('html'); });
  saveWordBtn?.addEventListener('click',e=>{ e.preventDefault(); exportChat('word'); });

  // Model search
  modelSearchInput?.addEventListener('input', () => {
    renderModelChips(modelSearchInput.value, activeCategory);
  });

  // Category tabs
  categoryTabs?.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.querySelectorAll('.cat-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat;
      renderModelChips(modelSearchInput?.value || '', activeCategory);
    });
  });

  updateViewState('setup');
}

document.addEventListener('DOMContentLoaded', init);
