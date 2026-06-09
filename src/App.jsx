import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Trash2, 
  Settings, 
  Key, 
  Globe, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  Bot, 
  User, 
  Copy, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Plus, 
  MessageSquare, 
  HelpCircle, 
  Terminal,
  BookOpen,
  Cpu
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Fallbacks pulling from Vite Environment variables (configured in Vercel/Render)
const DEFAULT_URL = import.meta.env.VITE_BACKEND_URL || "https://meu-rag-backend-akg7aza8chb3hfez.brazilsouth-01.azurewebsites.net/api";
const DEFAULT_TOKEN = import.meta.env.VITE_APP_API_KEY || "s6B8eo2M6RCyEmJVt9qeVr99Dq4wUNBmt5tVWSCmM8DA52Ls5K";

function App() {
  // App States
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('rag_theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const backendUrl = DEFAULT_URL;
  const authToken = DEFAULT_TOKEN;
  
  // Chat Session States
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('rag_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  // UI Utilities
  const [copiedId, setCopiedId] = useState(null);
  const [apiStatus, setApiStatus] = useState('unknown'); // 'unknown', 'checking', 'online', 'offline'
  
  const messagesEndRef = useRef(null);

  // Apply Dark Theme Class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('rag_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('rag_theme', 'light');
    }
  }, [darkMode]);



  // Persist Sessions
  useEffect(() => {
    localStorage.setItem('rag_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Test API status on mount
  const checkApiStatus = async () => {
    setApiStatus('checking');
    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: "Status check" })
      });
      if (response.ok) {
        setApiStatus('online');
      } else {
        setApiStatus('offline');
      }
    } catch (e) {
      setApiStatus('offline');
    }
  };

  useEffect(() => {
    checkApiStatus();
  }, []);

  // Prompts targeted to the 30 dataset entries
  const suggestions = [
    "Como o RAG pode ser aplicado no ensino?",
    "A IA pode ser usada para escrever ou ajudar no TCC?",
    "O que é o desafio da alucinação de IA na educação?",
    "Como a IA melhora a acessibilidade para alunos cegos ou surdos?"
  ];

  // Start a new chat session
  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSidebarOpen(false);
  };

  // Select a past session
  const handleSelectSession = (session) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setSidebarOpen(false);
  };

  // Delete a session
  const handleDeleteSession = (e, sessionId) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    if (currentSessionId === sessionId) {
      handleNewChat();
    }
  };

  // Send Message Logic
  const handleSendMessage = async (textToSend) => {
    const queryText = textToSend || input;
    if (!queryText.trim()) return;

    const userMsgId = Date.now().toString();
    const newUserMessage = {
      id: userMsgId,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: queryText })
      });

      if (!response.ok) {
        throw new Error(`Erro do servidor: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const assistantContent = data.mensagem || data.message || "Sem resposta retornada pelo servidor.";

      const assistantMsgId = (Date.now() + 1).toString();
      const newAssistantMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...updatedMessages, newAssistantMessage];
      setMessages(finalMessages);
      saveOrUpdateSession(finalMessages, queryText);
      setApiStatus('online');
    } catch (error) {
      console.error(error);
      const errorMsgId = (Date.now() + 1).toString();
      const errorMsg = {
        id: errorMsgId,
        role: 'assistant',
        isError: true,
        content: `⚠️ **Erro de Conexão**: Não foi possível comunicar com o backend do RAG.\n\n*Detalhes: ${error.message}*\n\nCertifique-se de que o backend está online e que configurou as variáveis de ambiente corretas no painel da Vercel ou Render (\`VITE_BACKEND_URL\` e \`VITE_APP_API_KEY\`).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);
      saveOrUpdateSession(finalMessages, queryText);
      setApiStatus('offline');
    } finally {
      setIsLoading(false);
    }
  };

  // Manage Sessions in LocalStorage
  const saveOrUpdateSession = (currentMessages, firstPrompt) => {
    if (currentSessionId) {
      const updated = sessions.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: currentMessages };
        }
        return s;
      });
      setSessions(updated);
    } else {
      const newId = Date.now().toString();
      const newSession = {
        id: newId,
        title: firstPrompt.length > 25 ? firstPrompt.substring(0, 25) + '...' : firstPrompt,
        messages: currentMessages,
        timestamp: new Date().toLocaleDateString()
      };
      setCurrentSessionId(newId);
      setSessions([newSession, ...sessions]);
    }
  };



  // Copy Message to Clipboard
  const handleCopyText = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-dark-bg font-sans">
      
      {/* MOBILE SIDEBAR BACKDROP */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR PANEL */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col w-72 border-r border-slate-200 dark:border-dark-border
        bg-white/95 dark:bg-dark-panel/95 backdrop-blur-md transition-all duration-300 ease-in-out
        md:static md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-dark-border">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-md shadow-brand-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white leading-tight">
                NeuroBot RAG
              </h1>
              <span className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold uppercase tracking-wider">
                IA na Educação
              </span>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-panel-hover md:hidden transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button: New Chat */}
        <div className="p-3">
          <button 
            onClick={handleNewChat}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200
              bg-brand-600 hover:bg-brand-700 active:scale-98 text-white shadow-md shadow-brand-600/15 hover:shadow-brand-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Conversa
          </button>
        </div>

        {/* Chat Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 text-[9px] font-bold text-slate-400 dark:text-dark-text-muted uppercase tracking-wider mb-2">
            Conversas Recentes
          </div>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-slate-200 dark:border-dark-border rounded-xl">
              <MessageSquare className="w-5 h-5 text-slate-300 dark:text-dark-text-muted mb-2" />
              <p className="text-xs text-slate-400 dark:text-dark-text-muted">Nenhum chat salvo localmente</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              return (
                <div 
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 group
                    ${isActive 
                      ? 'bg-brand-500/10 dark:bg-brand-500/15 border-l-2 border-brand-500 text-brand-600 dark:text-brand-300' 
                      : 'hover:bg-slate-100 dark:hover:bg-dark-panel-hover text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand-500' : 'text-slate-400 dark:text-dark-text-muted'}`} />
                    <div className="flex flex-col overflow-hidden text-left">
                      <span className="text-xs font-medium truncate pr-1">
                        {session.title}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-dark-border text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-dark-bg/40 relative overflow-hidden">
        
        {/* HEADER BAR */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-dark-border bg-white/70 dark:bg-dark-panel/60 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-panel-hover md:hidden transition-colors cursor-pointer"
            >
              <Menu className="w-5.5 h-5.5" />
            </button>
            
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full relative">
                <div className={`absolute inset-0 rounded-full opacity-70 ${
                  apiStatus === 'online' ? 'bg-emerald-500 animate-ping' : 
                  apiStatus === 'checking' ? 'bg-amber-500 animate-ping' : 'bg-red-500 animate-ping'
                }`} />
                <div className={`w-2.5 h-2.5 rounded-full relative z-10 ${
                  apiStatus === 'online' ? 'bg-emerald-500' : 
                  apiStatus === 'checking' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
              </div>
              <div className="text-left font-display">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  NeuroBot RAG
                </div>
                <div className="text-[9px] text-slate-400 dark:text-dark-text-muted font-medium">
                  {apiStatus === 'online' ? 'Conectado ao RAG' : 
                   apiStatus === 'checking' ? 'Testando conexão...' : 'Verifique a chave de conexão'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-dark-panel-hover transition cursor-pointer"
              title={darkMode ? "Modo Claro" : "Modo Escuro"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {messages.length > 0 && (
              <button 
                onClick={handleNewChat}
                className="flex items-center gap-1 py-1.5 px-3 text-xs rounded-xl font-semibold text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                title="Limpar conversa"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>
        </header>

        {/* MESSAGES VIEWPORT */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
          {messages.length === 0 ? (
            /* EXPLAINING WHAT THE RAGBOT IS AND WHAT IT ASKS/ANSWERS */
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[75vh] text-left space-y-6 animate-fade-in py-8">
              
              <div className="flex items-center gap-3 w-full border-b border-slate-200 dark:border-dark-border pb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-500 text-white shadow-md">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-display font-extrabold text-xl md:text-2xl text-slate-900 dark:text-white">
                    O que é o NeuroBot RAG?
                  </h2>
                  <p className="text-xs text-slate-400 dark:text-dark-text-muted font-medium">
                    Assistente com Geração Aumentada por Recuperação
                  </p>
                </div>
              </div>

              {/* SECTION: WHAT IS RAGBOT */}
              <div className="space-y-2.5 w-full bg-white dark:bg-dark-panel p-5 rounded-2xl border border-slate-200/80 dark:border-dark-border shadow-sm">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Como o sistema funciona?
                </h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  O <strong>NeuroBot</strong> é um chatbot RAG. Quando você faz uma pergunta, ele gera um embedding numérico da sua mensagem e faz uma busca vetorial no <strong>ChromaDB</strong>. O banco local retorna os trechos mais similares de um dataset estruturado e injeta este contexto no modelo <strong>Gemini 3 Flash</strong>, gerando respostas precisas e livres de alucinações.
                </p>
              </div>

              {/* SECTION: WHAT IT ASKS/ANSWERS */}
              <div className="space-y-3 w-full bg-white dark:bg-dark-panel p-5 rounded-2xl border border-slate-200/80 dark:border-dark-border shadow-sm">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5" />
                  Sobre o que ele responde? (Uso de IA na Educação)
                </h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  A base de conhecimento foi estruturada em um dataset de <strong>30 registros específicos</strong> sobre o impacto da Inteligência Artificial em ambientes escolares e acadêmicos. O bot responde sobre:
                </p>
                
                <div className="grid gap-2.5 md:grid-cols-3 pt-1 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-bg/60 border border-slate-100 dark:border-dark-border/40">
                    <span className="font-bold text-slate-900 dark:text-white block mb-1">Tecnologias de Apoio</span>
                    IA Generativa, Machine Learning, RAG, Tutores Virtuais, Gamificação e Microlearning.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-bg/60 border border-slate-100 dark:border-dark-border/40">
                    <span className="font-bold text-slate-900 dark:text-white block mb-1">Acessibilidade & Gestão</span>
                    Acessibilidade visual/auditiva, correção automática, curadoria de conteúdo e prevenção de evasão.
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-dark-bg/60 border border-slate-100 dark:border-dark-border/40">
                    <span className="font-bold text-slate-900 dark:text-white block mb-1">Desafios & Ética</span>
                    Alucinação de modelos, plágio em trabalhos/TCC, privacidade de dados (LGPD) e o novo papel do professor.
                  </div>
                </div>
              </div>

              {/* SECTION: SUGGESTIONS */}
              <div className="space-y-3 w-full pt-2">
                <div className="text-[10px] font-bold text-slate-400 dark:text-dark-text-muted uppercase tracking-wider text-center">
                  Selecione um tópico para testar a busca vetorial:
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {suggestions.map((sug, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleSendMessage(sug)}
                      className="flex items-start gap-2.5 p-3.5 rounded-xl border border-slate-200/80 dark:border-dark-border bg-white dark:bg-dark-panel hover:bg-brand-50/20 dark:hover:bg-dark-panel-hover/50 hover:border-brand-500/50 dark:hover:border-brand-500/50 hover:shadow-md hover:shadow-brand-500/5 transition-all duration-200 cursor-pointer text-slate-700 dark:text-slate-300 group text-left"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium leading-normal">{sug}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* ACTIVE CHAT SCREEN */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => {
                const isBot = msg.role === 'assistant';
                return (
                  <div 
                    key={msg.id}
                    className={`flex gap-3 md:gap-4 ${isBot ? 'justify-start' : 'justify-end'}`}
                  >
                    {isBot && (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow bg-gradient-to-tr from-brand-600 to-violet-500 text-white">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isBot ? 'items-start' : 'items-end'}`}>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-dark-text-muted mb-1 px-1">
                        {isBot ? 'NeuroBot' : 'Você'} • {msg.timestamp}
                      </span>
                      
                      <div className={`p-4 rounded-2xl relative shadow-sm border group text-left ${
                        msg.isError 
                          ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/25 dark:border-red-500/20 text-red-700 dark:text-red-300' 
                          : isBot 
                            ? 'bg-white dark:bg-dark-panel border-slate-200 dark:border-dark-border text-slate-800 dark:text-slate-200' 
                            : 'bg-gradient-to-r from-brand-600 to-brand-700 border-brand-700 text-white'
                      }`}>
                        
                        <div className={`prose text-xs md:text-sm leading-relaxed ${isBot ? '' : 'text-white'}`}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>

                        {isBot && (
                          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button
                              onClick={() => handleCopyText(msg.content, msg.id)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-dark-border dark:hover:bg-dark-panel-hover text-slate-500 dark:text-slate-300 transition shadow cursor-pointer"
                              title="Copiar resposta"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isBot && (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow bg-slate-200 dark:bg-dark-border text-slate-600 dark:text-slate-300">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bot Shimmer Loader State */}
              {isLoading && (
                <div className="flex gap-3 md:gap-4 justify-start">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-500 text-white">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col items-start max-w-[85%] md:max-w-[75%]">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-dark-text-muted mb-1 px-1">
                      NeuroBot • Recuperando dados da planilha...
                    </span>
                    <div className="p-5 rounded-2xl bg-white dark:bg-dark-panel border border-slate-200 dark:border-dark-border text-left w-72 md:w-96 space-y-3 shimmer">
                      <div className="h-3 bg-slate-200 dark:bg-dark-border rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 dark:bg-dark-border rounded w-5/6"></div>
                      <div className="h-3 bg-slate-200 dark:bg-dark-border rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* INPUT PROMPT PANEL */}
        <div className="p-4 border-t border-slate-200 dark:border-dark-border bg-white/70 dark:bg-dark-panel/60 backdrop-blur-md z-30">
          <div className="max-w-3xl mx-auto">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center"
            >
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Pergunte ao NeuroBot sobre IA na Educação..."
                className="w-full pl-4 pr-14 py-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-panel focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm focus:shadow-md transition disabled:opacity-70 disabled:cursor-not-allowed text-slate-800 dark:text-slate-100"
              />
              
              <div className="absolute right-2.5">
                <button 
                  type="submit" 
                  disabled={!input.trim() || isLoading}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
            
            <div className="flex justify-between items-center px-2 mt-2">
              <span className="text-[9px] text-slate-400 dark:text-dark-text-muted">
                Pressione Enter para enviar a pergunta.
              </span>
              <span className="text-[9px] font-semibold text-slate-400 dark:text-dark-text-muted flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" />
                RAG Educacional • Google AI Studio & ChromaDB
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
