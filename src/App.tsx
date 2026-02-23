import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  Shield, 
  Code2, 
  MessageSquare, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  Send, 
  X, 
  ChevronRight, 
  Terminal,
  Sparkles,
  Bug,
  FileCode,
  Layout,
  Maximize2,
  RefreshCw,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import confetti from 'canvas-confetti';
import { geminiService } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface File {
  name: string;
  content: string;
  language: string;
}

const INITIAL_FILES: File[] = [
  {
    name: 'main.luau',
    language: 'luau',
    content: `-- BearAI Luau Workspace\nlocal Player = game.Players.LocalPlayer\n\nfunction onInit()\n    print("Sistema iniciado")\nend\n\nonInit()`
  },
  {
    name: 'server.lua',
    language: 'lua',
    content: `-- Lua Script\nlocal http = require("socket.http")\n\nprint("Servidor ativo na porta 8080")`
  },
  {
    name: 'app.js',
    language: 'javascript',
    content: `// BearAI JavaScript Bridge\nconst express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => {\n    res.send('BearAI Connected');\n});\n\napp.listen(3000);`
  }
];

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [files, setFiles] = useState<File[]>(INITIAL_FILES);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'chat' | 'media' | 'settings'>('editor');
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Media state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [mediaPrompt, setMediaPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState('');

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);

  useEffect(() => {
    if (isConnected && !activeFile) {
      setActiveFile(files[0]);
    }
  }, [isConnected]);

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 5) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const validatePin = () => {
    if (pin.every(d => d !== '')) {
      setIsConnected(true);
      setShowPinModal(false);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#78350f']
      });
    }
  };

  const handleAiAction = async (type: 'edit' | 'explain' | 'fix') => {
    if (!activeFile) return;
    setIsAiLoading(true);
    setAiResponse(null);

    try {
      if (type === 'edit') {
        const newCode = await geminiService.editCode(activeFile.content, prompt, activeFile.name);
        const updatedFiles = files.map(f => f.name === activeFile.name ? { ...f, content: newCode } : f);
        setFiles(updatedFiles);
        setActiveFile({ ...activeFile, content: newCode });
        setPrompt('');
      } else if (type === 'explain') {
        const explanation = await geminiService.editCode(activeFile.content, "Explain this code in detail.", activeFile.name);
        setAiResponse(explanation);
      } else if (type === 'fix') {
        const fixedCode = await geminiService.editCode(activeFile.content, "Find and fix any bugs or performance issues.", activeFile.name);
        const updatedFiles = files.map(f => f.name === activeFile.name ? { ...f, content: fixedCode } : f);
        setFiles(updatedFiles);
        setActiveFile({ ...activeFile, content: fixedCode });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsAiLoading(true);

    try {
      const response = await geminiService.chat(userMsg);
      setChatMessages(prev => [...prev, { role: 'ai', content: response.text || 'No response' }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateMedia = async (type: 'image' | 'video') => {
    if (!mediaPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      if (type === 'image') {
        const url = await geminiService.generateImage(mediaPrompt, aspectRatio, imageSize);
        setGeneratedImage(url);
      } else {
        const url = await geminiService.generateVideo(mediaPrompt, aspectRatio as any);
        setGeneratedVideo(url);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setIsAiLoading(true);
      try {
        const analysis = await geminiService.analyzeImage(base64, "Analyze this image and explain its technical content.");
        setAiResponse(analysis || 'No analysis available');
      } catch (error) {
        console.error(error);
      } finally {
        setIsAiLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleLiveVoice = async () => {
    if (isLiveActive) {
      liveSessionRef.current?.close();
      setIsLiveActive(false);
      return;
    }

    setIsLiveActive(true);
    try {
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      const session = await geminiService.connectLive({
        onopen: () => {
          source.connect(processor);
          processor.connect(audioContextRef.current!.destination);
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
            session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
          };
        },
        onmessage: async (message: any) => {
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            const binary = atob(base64Audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const pcm = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm.length);
            for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 0x7FFF;
            
            const buffer = audioContextRef.current!.createBuffer(1, float32.length, 16000);
            buffer.getChannelData(0).set(float32);
            const source = audioContextRef.current!.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current!.destination);
            source.start();
          }
          if (message.serverContent?.modelTurn?.parts[0]?.text) {
            setLiveTranscription(prev => prev + ' ' + message.serverContent.modelTurn.parts[0].text);
          }
        }
      });
      liveSessionRef.current = session;
    } catch (error) {
      console.error(error);
      setIsLiveActive(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Navbar */}
      <nav className="glass border-b border-amber-900/30 px-6 py-4 flex justify-between items-center z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bear-gradient rounded-xl flex items-center justify-center shadow-lg">
            <Zap className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Bear<span className="text-amber-500">AI</span></h1>
            <p className="text-[10px] text-amber-200/50 uppercase tracking-[0.2em]">LLM Integrated Bridge</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors",
            isConnected ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
          )}>
            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
            <span className={cn("text-xs font-medium", isConnected ? "text-green-400" : "text-red-400")}>
              {isConnected ? 'Conectado via Bridge' : 'Desconectado'}
            </span>
          </div>
          {!isConnected && (
            <button 
              onClick={() => setShowPinModal(true)}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold transition-all active:scale-95"
            >
              Parear via PIN
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 glass border-r border-amber-900/20 p-6 hidden lg:flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mb-4">Workspace</h3>
            {files.map(file => (
              <button
                key={file.name}
                onClick={() => isConnected && setActiveFile(file)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all hover:bg-white/5 mb-1",
                  activeFile?.name === file.name ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "text-stone-400"
                )}
              >
                <FileCode className={cn("w-4 h-4", file.name.endsWith('.luau') ? "text-blue-400" : "text-yellow-400")} />
                <span className="text-sm font-medium font-mono">{file.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto space-y-4">
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setActiveTab('editor')}
                className={cn("flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all", activeTab === 'editor' ? "bg-amber-500/10 text-amber-400" : "text-stone-400 hover:bg-white/5")}
              >
                <Layout className="w-4 h-4" /> Editor
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={cn("flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all", activeTab === 'chat' ? "bg-amber-500/10 text-amber-400" : "text-stone-400 hover:bg-white/5")}
              >
                <MessageSquare className="w-4 h-4" /> Chat AI
              </button>
              <button 
                onClick={() => setActiveTab('media')}
                className={cn("flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all", activeTab === 'media' ? "bg-amber-500/10 text-amber-400" : "text-stone-400 hover:bg-white/5")}
              >
                <ImageIcon className="w-4 h-4" /> Media Gen
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={cn("flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all", activeTab === 'settings' ? "bg-amber-500/10 text-amber-400" : "text-stone-400 hover:bg-white/5")}
              >
                <Shield className="w-4 h-4" /> Settings
              </button>
              <button 
                onClick={toggleLiveVoice}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all",
                  isLiveActive ? "bg-red-500/10 text-red-400 animate-pulse" : "text-stone-400 hover:bg-white/5"
                )}
              >
                <Mic className="w-4 h-4" /> {isLiveActive ? 'Live Active' : 'Live Voice'}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-900/10 border border-amber-700/20">
              <p className="text-[11px] text-amber-200/60 leading-relaxed font-medium">
                <span className="text-amber-400 font-bold block mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Gemini Intelligence
                </span>
                BearAI uses Flash 2.5 and Pro 3.1 models for high-performance coding and generation.
              </p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative bg-[#141211]">
          {activeTab === 'editor' && (
            <>
              <div className="px-6 py-3 border-b border-amber-900/20 bg-stone-900/50 flex justify-between items-center">
                <span className="text-xs font-mono text-amber-400 italic">
                  {activeFile ? activeFile.name : 'selecione um ficheiro...'}
                </span>
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleAiAction('fix')}
                    disabled={!activeFile || isAiLoading}
                    className="text-[10px] text-green-400 font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <Bug className="w-3 h-3" /> Corrigir Bugs
                  </button>
                  <button 
                    onClick={() => handleAiAction('explain')}
                    disabled={!activeFile || isAiLoading}
                    className="text-[10px] text-blue-400 font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" /> Explicar
                  </button>
                </div>
              </div>
              
              <div className={cn("flex-1 relative overflow-hidden flex", isAiLoading && "ai-scanning")}>
                <div className="w-12 bg-stone-900/80 border-r border-amber-900/10 flex flex-col items-center py-4 text-stone-600 font-mono text-xs select-none">
                  {activeFile?.content.split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea 
                  ref={editorRef}
                  value={activeFile?.content || ''}
                  onChange={(e) => {
                    if (activeFile) {
                      const newContent = e.target.value;
                      setFiles(files.map(f => f.name === activeFile.name ? { ...f, content: newContent } : f));
                      setActiveFile({ ...activeFile, content: newContent });
                    }
                  }}
                  disabled={!isConnected}
                  className="flex-1 p-4 font-mono text-sm bg-transparent outline-none resize-none text-stone-200 scroll-custom"
                  placeholder={isConnected ? "Start coding..." : "Aguardando emparelhamento..."}
                />
              </div>

              {/* AI Prompt Bar */}
              <div className="p-4 glass border-t border-amber-900/20 flex gap-4 items-center">
                <div className="flex-1 relative">
                  <input 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiAction('edit')}
                    disabled={!isConnected || isAiLoading}
                    type="text" 
                    placeholder="✨ Diga à BearAI o que editar (ex: Adiciona sistema de moedas)..." 
                    className="w-full bg-stone-900/80 border border-amber-900/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-all disabled:opacity-50"
                  />
                </div>
                <button 
                  onClick={() => handleAiAction('edit')}
                  disabled={!isConnected || isAiLoading || !prompt.trim()}
                  className="p-3 bear-gradient rounded-xl text-amber-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center min-w-[48px]"
                >
                  {isAiLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </>
          )}

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 scroll-custom pr-2">
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-stone-500 gap-4">
                    <MessageSquare className="w-12 h-12 opacity-20" />
                    <p className="text-sm">Ask BearAI anything about your project.</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex flex-col max-w-[80%]",
                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "p-4 rounded-2xl text-sm",
                      msg.role === 'user' ? "bg-amber-600 text-white" : "glass border-amber-500/20 text-stone-200"
                    )}>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex gap-2 items-center text-amber-500 text-xs animate-pulse">
                    <Sparkles className="w-4 h-4" /> BearAI is thinking...
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <input 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                  placeholder="Ask a question..."
                  className="flex-1 bg-stone-900 border border-amber-900/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
                />
                <button 
                  onClick={handleChatSubmit}
                  disabled={isAiLoading || !chatInput.trim()}
                  className="p-3 bear-gradient rounded-xl text-white disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'media' && (
            <div className="flex-1 flex flex-col p-6 overflow-y-auto scroll-custom">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Image Generation</h4>
                  <div className="glass p-6 rounded-2xl space-y-4 border-amber-500/20">
                    <div className="aspect-square bg-stone-900 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center">
                      {generatedImage ? (
                        <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-stone-800" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select 
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="bg-stone-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-stone-300"
                      >
                        <option value="1:1">1:1 Square</option>
                        <option value="16:9">16:9 Landscape</option>
                        <option value="9:16">9:16 Portrait</option>
                        <option value="4:3">4:3 Classic</option>
                      </select>
                      <select 
                        value={imageSize}
                        onChange={(e) => setImageSize(e.target.value)}
                        className="bg-stone-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-stone-300"
                      >
                        <option value="1K">1K Quality</option>
                        <option value="2K">2K Quality</option>
                        <option value="4K">4K Ultra</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => handleGenerateMedia('image')}
                      disabled={isAiLoading || !mediaPrompt.trim()}
                      className="w-full py-3 bear-gradient rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      Generate Image
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Video Generation (Veo)</h4>
                  <div className="glass p-6 rounded-2xl space-y-4 border-amber-500/20">
                    <div className="aspect-video bg-stone-900 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center">
                      {generatedVideo ? (
                        <video src={generatedVideo} controls className="w-full h-full object-contain" />
                      ) : (
                        <Video className="w-12 h-12 text-stone-800" />
                      )}
                    </div>
                    <button 
                      onClick={() => handleGenerateMedia('video')}
                      disabled={isAiLoading || !mediaPrompt.trim()}
                      className="w-full py-3 bear-gradient rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      Generate Video
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Image Analysis</h4>
                  <div className="glass p-6 rounded-2xl space-y-4 border-amber-500/20">
                    <label className="w-full aspect-video bg-stone-900 rounded-xl overflow-hidden border border-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-stone-800 transition-colors">
                      <Search className="w-8 h-8 text-stone-700 mb-2" />
                      <span className="text-[10px] text-stone-500">Upload Image to Analyze</span>
                      <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                    </label>
                    <p className="text-[10px] text-stone-500 text-center">Analyze technical diagrams, UI mockups, or code screenshots.</p>
                  </div>
                </div>
              </div>

              <div className="glass p-4 rounded-2xl border-amber-500/20">
                <textarea 
                  value={mediaPrompt}
                  onChange={(e) => setMediaPrompt(e.target.value)}
                  placeholder="Describe what you want to generate..."
                  className="w-full bg-transparent border-none outline-none text-sm text-stone-200 resize-none h-24"
                />
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 flex flex-col p-8 overflow-y-auto scroll-custom">
              <div className="max-w-2xl mx-auto w-full space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-amber-500 mb-2">Connection Settings</h2>
                  <p className="text-stone-400 text-sm">Configure your BearAI Bridge and external integrations.</p>
                </div>

                <div className="space-y-6">
                  <div className="glass p-6 rounded-2xl border-amber-500/20 space-y-4">
                    <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-4 h-4" /> App Configuration
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-stone-500 uppercase font-bold mb-1 block">App URL</label>
                        <div className="flex gap-2">
                          <code className="flex-1 bg-black/40 p-3 rounded-lg text-xs text-amber-200 border border-white/5 break-all">
                            https://ais-dev-acrxlbqgyjx3zuv2mtambr-155614144423.us-east1.run.app
                          </code>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 uppercase font-bold mb-1 block">OAuth Callback URL</label>
                        <div className="flex gap-2">
                          <code className="flex-1 bg-black/40 p-3 rounded-lg text-xs text-amber-200 border border-white/5 break-all">
                            https://ais-dev-acrxlbqgyjx3zuv2mtambr-155614144423.us-east1.run.app/auth/callback
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass p-6 rounded-2xl border-amber-500/20 space-y-4">
                    <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Security
                    </h4>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Your connection is secured via a 6-digit PIN bridge. Ensure your local BearAI client is running to establish a workspace connection.
                    </p>
                    <button 
                      onClick={() => setIsConnected(false)}
                      className="text-xs text-red-400 font-bold hover:underline"
                    >
                      Reset Connection
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Response Box */}
          <AnimatePresence>
            {aiResponse && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-24 left-6 right-6 p-6 glass border border-amber-500/40 rounded-2xl text-xs text-amber-100 shadow-2xl z-40 max-h-64 overflow-y-auto scroll-custom"
              >
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Explicação da BearAI
                  </span>
                  <button onClick={() => setAiResponse(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-stone-500" />
                  </button>
                </div>
                <div className="prose prose-invert prose-xs max-w-none">
                  <ReactMarkdown>{aiResponse}</ReactMarkdown>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* PIN Modal */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-10 rounded-3xl border border-amber-500/30 max-w-sm w-full text-center relative"
            >
              <button 
                onClick={() => setShowPinModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-stone-500" />
              </button>
              <div className="w-16 h-16 bear-gradient rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl">
                <Shield className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Emparelhar Bridge</h2>
              <p className="text-stone-400 text-sm mb-8">Introduza o PIN de 6 dígitos gerado pela sua aplicação local.</p>
              
              <div className="flex justify-between mb-8">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { pinRefs.current[i] = el; }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    className="w-11 h-14 text-center text-xl font-bold bg-amber-500/5 border-2 border-amber-500/20 rounded-xl text-amber-500 outline-none focus:border-amber-500 focus:bg-amber-500/10 transition-all"
                  />
                ))}
              </div>

              <button 
                onClick={validatePin}
                className="w-full py-4 bear-gradient rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
              >
                Conectar Workspace
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification (Simplified) */}
      <div id="toast-container" className="fixed bottom-6 right-6 z-[200]" />
    </div>
  );
}
