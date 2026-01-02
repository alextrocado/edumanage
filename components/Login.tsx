
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

  const [globalUser, setGlobalUser] = useState('');
  const [globalPass, setGlobalPass] = useState('');

  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const globalToken = localStorage.getItem('global_auth_token');
      if (!globalToken) {
        setView('global');
        return;
      }

      const saved = localStorage.getItem('edumanage_data');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setLocalData(parsed);
          setView(parsed.config?.appPassword ? 'login' : 'setup');
        } catch (e) { setView('setup'); }
      } else { setView('setup'); }
    };
    checkAuth();
  }, []);

  const handleGlobalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsConnecting(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: globalUser, password: globalPass }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        localStorage.setItem('global_auth_token', result.token);
        const saved = localStorage.getItem('edumanage_data');
        setView(saved ? 'login' : 'setup');
      } else {
        setError(result.error || 'Acesso negado.');
      }
    } catch (err) {
      setError('Erro ao contactar o servidor de autenticação.');
    } finally {
      setIsConnecting(false);
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
        cloudSyncEnabled: true,
        calendar: { yearStart: '', yearEnd: '', holidays: [], terms: [] }
      }
    };
    onLogin(initial);
  };

  const handleCloudImport = async () => {
    if (!newName) {
      setError('Insira o seu nome de utilizador para procurar na cloud.');
      return;
    }
    setIsConnecting(true);
    setError('');
    
    try {
      const userId = newName.trim();
      const cloudData = await postgresService.pullData(userId);
      
      if (cloudData) {
        const finalData: AppData = { 
          ...cloudData, 
          config: { 
            ...cloudData.config, 
            appPassword: newPass || cloudData.config?.appPassword,
            userName: userId
          } 
        };
        onLogin(finalData);
      } else {
        setError(`Não foram encontrados dados para "${userId}". Pode criar um novo perfil.`);
      }
    } catch (e) {
      setError('Erro na ligação à API Cloud.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="max-w-md w-full z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-[30px] flex items-center justify-center text-white text-3xl mx-auto mb-6 shadow-2xl">
            <i className="fas fa-shield-halved"></i>
          </div>
          <h1 className="text-4xl font-black text-white">EduTrocado <span className="text-blue-500">Pro</span></h1>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-[40px] shadow-2xl">
          {view === 'global' && (
            <form onSubmit={handleGlobalLogin} className="space-y-4">
              <h2 className="text-xl font-bold text-white text-center mb-4">Acesso Administrativo</h2>
              <input type="text" value={globalUser} onChange={e => setGlobalUser(e.target.value)} placeholder="Utilizador Admin" className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              <input type="password" value={globalPass} onChange={e => setGlobalPass(e.target.value)} placeholder="Palavra-passe Admin" className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}
              <button type="submit" disabled={isConnecting} className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all">
                {isConnecting ? 'A validar...' : 'Entrar no Sistema'}
              </button>
            </form>
          )}

          {view === 'setup' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white text-center mb-4">Configurar Professor</h2>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="O seu Nome (ID Cloud)" className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Defina Password Local" className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              
              {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}
              
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={handleSetup} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-500 transition-all">Novo Perfil</button>
                <button onClick={handleCloudImport} disabled={isConnecting} className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-sm hover:bg-white/10 transition-all">
                  {isConnecting ? 'A procurar...' : 'Recuperar da Cloud'}
                </button>
              </div>
            </div>
          )}

          {view === 'login' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Bem-vindo de volta</p>
                <h2 className="text-2xl font-black text-white mt-1">{localData?.config?.userName}</h2>
              </div>
              <input type="password" autoFocus value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLocalAccess()} placeholder="Password Local" className="w-full px-5 py-5 bg-white/5 border border-white/10 rounded-3xl text-white text-center outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg tracking-widest" />
              {error && <p className="text-red-400 text-xs font-bold text-center">{error}</p>}
              <button onClick={handleLocalAccess} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg shadow-xl">Desbloquear</button>
              <button onClick={() => { localStorage.removeItem('global_auth_token'); setView('global'); }} className="w-full py-2 text-slate-500 text-[9px] font-black uppercase hover:text-white transition-all">Sair do Admin</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
