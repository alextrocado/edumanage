
import React, { useState, useEffect } from 'react';
import { AppData } from '../types';
import { postgresService } from '../services/postgres';

interface LoginProps {
  onLogin: (data: AppData) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCloudConnect: (url: string, token: string) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ onLogin, onImport, onCloudConnect }) => {
  const [localData, setLocalData] = useState<AppData | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<'login' | 'setup' | 'global'>('global');

  // Credenciais globais (APP_USER e APP_PASSWORD)
  const [globalUser, setGlobalUser] = useState('');
  const [globalPass, setGlobalPass] = useState('');

  // Estados de configuração local/cloud
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [pgUrl, setPgUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Verificar Token Global
      const globalToken = localStorage.getItem('global_auth_token');
      if (!globalToken) {
        setView('global');
        return;
      }

      // 2. Se autenticado globalmente, verificar dados locais
      const saved = localStorage.getItem('edumanage_data');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setLocalData(parsed);
          if (parsed.config?.appPassword) {
            setView('login');
          } else {
            setView('setup');
          }
        } catch (e) {
          setView('setup');
        }
      } else {
        setView('setup');
      }
    };
    checkAuth();
  }, []);

  const handleGlobalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Verificação contra variáveis de ambiente
    const envUser = process.env.APP_USER;
    const envPass = process.env.APP_PASSWORD;

    if (globalUser === envUser && globalPass === envPass) {
      localStorage.setItem('global_auth_token', `auth_${Date.now()}`);
      setError('');
      
      // Prosseguir para a lógica local
      const saved = localStorage.getItem('edumanage_data');
      if (saved) {
        setView('login');
      } else {
        setView('setup');
      }
    } else {
      setError('Credenciais administrativas incorretas.');
    }
  };

  const handleLocalAccess = () => {
    if (!localData || localData.config?.appPassword !== passwordInput) {
      setError('Password incorreta.');
      return;
    }
    onLogin(localData);
  };

  const handleSetup = () => {
    if (!newName || !newPass) {
      setError('Preencha o nome e a password para começar.');
      return;
    }
    const initial: AppData = {
      classes: [],
      config: {
        userName: newName,
        appPassword: newPass,
        cloudSyncEnabled: false,
        calendar: { yearStart: '', yearEnd: '', holidays: [], terms: [] }
      }
    };
    onLogin(initial);
  };

  const handlePgImport = async () => {
    const trimmedUrl = pgUrl.trim();
    if (!trimmedUrl) {
      setError('Insira o URL da Neon PostgreSQL.');
      return;
    }
    setIsConnecting(true);
    setError('');
    
    try {
      postgresService.init(trimmedUrl);
      const userId = newName.trim() || 'default_prof';
      const cloudData = await postgresService.pullData(userId);
      
      if (cloudData) {
        const finalData: AppData = { 
          ...cloudData, 
          config: { 
            ...cloudData.config, 
            postgresConnectionString: trimmedUrl,
            appPassword: newPass || cloudData.config?.appPassword,
            userName: userId
          } 
        };
        onLogin(finalData);
      } else {
        setError(`Não foram encontrados dados para o utilizador "${userId}".`);
      }
    } catch (e) {
      setError('Erro de ligação à Neon.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReset = () => {
    if (confirm("Isto irá apagar os dados locais. Tem a certeza?")) {
      localStorage.removeItem('edumanage_data');
      localStorage.removeItem('global_auth_token');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>

      <div className="max-w-md w-full z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-[30px] flex items-center justify-center text-white text-3xl mx-auto mb-6 shadow-2xl shadow-blue-500/40">
            <i className="fas fa-shield-halved"></i>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">EduTrocado <span className="text-blue-500">Pro</span></h1>
          <p className="text-slate-400 font-medium mt-2">Acesso Restrito</p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-[40px] shadow-2xl">
          
          {view === 'global' && (
            <form onSubmit={handleGlobalLogin} className="space-y-4">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Login Administrativo</h2>
                <p className="text-slate-500 text-xs">Introduza as credenciais da plataforma</p>
              </div>
              <input 
                type="text" 
                value={globalUser} 
                onChange={e => setGlobalUser(e.target.value)} 
                placeholder="Utilizador Admin" 
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
              />
              <input 
                type="password" 
                value={globalPass} 
                onChange={e => setGlobalPass(e.target.value)} 
                placeholder="Palavra-passe Admin" 
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
              />
              {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}
              <button type="submit" className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl hover:bg-slate-200 transition-all">
                Entrar no Sistema
              </button>
            </form>
          )}

          {view === 'setup' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white text-center mb-4">Configurar Professor</h2>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="O seu Nome" className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Defina Password Local" className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              
              <div className="relative pt-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-950 px-2 text-slate-500 font-black">Ou Importar Cloud</span></div>
              </div>

              <input type="password" value={pgUrl} onChange={e => setPgUrl(e.target.value)} placeholder="PostgreSQL URL" className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-blue-400 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500" />
              
              {error && <p className="text-red-400 text-xs font-bold text-center leading-relaxed">{error}</p>}
              
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={pgUrl ? handlePgImport : handleSetup} disabled={isConnecting} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-blue-500 transition-all">
                  {isConnecting ? 'A ligar...' : (pgUrl ? 'Importar Cloud' : 'Criar Perfil')}
                </button>
              </div>
            </div>
          )}

          {view === 'login' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Sessão Professor</p>
                <h2 className="text-2xl font-black text-white mt-1">{localData?.config?.userName || 'Utilizador'}</h2>
              </div>
              <div className="space-y-4">
                <input 
                  type="password" 
                  autoFocus
                  value={passwordInput}
                  onChange={e => { setPasswordInput(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLocalAccess()}
                  placeholder="Password Local"
                  className="w-full px-5 py-5 bg-white/5 border border-white/10 rounded-3xl text-white text-center placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-lg tracking-widest"
                />
                {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}
                <button onClick={handleLocalAccess} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black text-lg shadow-xl transition-all">Desbloquear</button>
                <button onClick={() => { localStorage.removeItem('global_auth_token'); setView('global'); }} className="w-full py-2 text-slate-500 text-[9px] font-black uppercase hover:text-white transition-all">Sair do Administrador</button>
              </div>
            </div>
          )}
        </div>
        
        <p className="mt-8 text-center text-slate-700 text-[10px] font-black uppercase tracking-[0.3em]">
          EduTrocado Pro • Sistema Protegido
        </p>
      </div>
    </div>
  );
};

export default Login;
