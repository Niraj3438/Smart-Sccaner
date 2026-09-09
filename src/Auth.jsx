import React,{useState} from 'react';
import {ScanSearch,User,Lock,Eye,EyeOff,ShieldCheck,UploadCloud,ArrowRight,Loader2,CheckCircle2} from 'lucide-react';
import {supabase} from './supabase.js';

export default function Auth({onLogin}){
  const [mode,setMode]=useState('login');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showPw,setShowPw]=useState(false);
  const [form,setForm]=useState({username:'',password:'',displayName:'',remember:true});

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const browserMode=!!supabase && !window.smartscan?.login;

  const submit=async e=>{
    e.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try{
      if(browserMode){
        if(mode==='register'){
          const {data,error}=await supabase.auth.signUp({
            email:form.username.trim(),
            password:form.password,
            options:{data:{display_name:form.displayName||form.username.trim()}}
          });
          if(error) throw error;
          if(data.session && data.user) onLogin({id:data.user.id,username:data.user.email,displayName:data.user.user_metadata?.display_name||data.user.email});
          else setNotice('Account created. Check your email to verify your account, then log in.');
        } else {
          const {data,error}=await supabase.auth.signInWithPassword({email:form.username.trim(),password:form.password});
          if(error) throw error;
          if(!data.user) throw new Error('Login failed.');
          onLogin({id:data.user.id,username:data.user.email,displayName:data.user.user_metadata?.display_name||data.user.email});
        }
      } else {
        if(mode==='register'){
          const r=await window.smartscan.register(form);
          if(!r.ok) throw new Error(r.error||'Could not create account.');
          onLogin(r.user);
        } else if(mode==='login'){
          const r=await window.smartscan.login(form);
          if(!r.ok) throw new Error(r.error||'Login failed.');
          onLogin(r.user);
        }
      }
    }catch(err){ setError(err?.message||'Something went wrong.'); }
    finally{ setBusy(false); }
  };

  const doImport=async()=>{
    setError(''); setNotice(''); setBusy(true);
    try{
      const r=await window.smartscan?.importAccount?.();
      if(r===undefined) return;
      if(!r.ok){ if(r.error) setError(r.error); return; }
      onLogin(r.user);
    } finally { setBusy(false); }
  };

  return <div className="auth-screen">
    <div className="auth-aurora"/>
    <div className={`auth-card ${busy?'auth-busy':''}`}>
      <div className="auth-brand"><div className="logo pulse"><ScanSearch size={22}/></div><div><b>Smart<span>Scan</span>X</b><small>Local File Intelligence</small></div></div>
      <div className="auth-tabs">
        <button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');setNotice('')}}>Log In</button>
        <button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('');setNotice('')}}>Create ID</button>
      </div>
      <form key={mode} className="auth-form auth-anim" onSubmit={submit}>
        <label className="auth-field"><User size={15}/><input type="email" autoFocus placeholder="Email address" value={form.username} onChange={e=>set('username',e.target.value)} required/></label>
        {mode==='register'&&<label className="auth-field"><ShieldCheck size={15}/><input placeholder="Display name (optional)" value={form.displayName} onChange={e=>set('displayName',e.target.value)}/></label>}
        <label className="auth-field"><Lock size={15}/><input type={showPw?'text':'password'} placeholder="Password" value={form.password} onChange={e=>set('password',e.target.value)} required minLength={6}/><button type="button" className="eye" onClick={()=>setShowPw(v=>!v)}>{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></label>
        <label className="auth-remember"><input type="checkbox" checked={form.remember} onChange={e=>set('remember',e.target.checked)}/> Keep me logged in</label>
        {error&&<div className="auth-error">{error}</div>}
        {notice&&<div className="auth-notice"><CheckCircle2 size={14}/> {notice}</div>}
        <button className="auth-submit" disabled={busy} type="submit">{busy?<Loader2 className="spin" size={16}/>:<ArrowRight size={16}/>} {mode==='login'?'Log In':'Create My ID'}</button>
      </form>
      {!browserMode&&<><div className="auth-divider"><span>offline account tools</span></div><div className="auth-restore"><button onClick={doImport} disabled={busy}><UploadCloud size={14}/> Restore from backup file</button></div></>}
      <p className="auth-foot">{browserMode?'Web accounts are securely managed by Supabase. Your login session is saved in this browser.':'Everything stays on this computer. Use Settings → Backup Account to save an offline backup.'}</p>
    </div>
  </div>;
}
