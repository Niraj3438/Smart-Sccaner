import React,{useState} from 'react';
import {ScanSearch,User,Lock,KeyRound,Eye,EyeOff,ShieldCheck,UploadCloud,DownloadCloud,ArrowRight,Loader2,CheckCircle2} from 'lucide-react';

/*
  Fully local account gate. No internet, no external server — everything is
  written to this PC's own SmartScan X data folder. That means: if this app
  is ever removed from where it was built/downloaded, every copy that is
  already installed keeps working normally, because each installed copy
  owns its own local user list and its own local data file. A user simply
  reopens the app, enters their ID (username) and password, and their
  saved scans, projects, favorites and settings are exactly where they
  left them. Export/Import Account lets someone carry that same account
  and data to a reinstall, a backup drive, or another PC running SmartScan X.
*/

export default function Auth({onLogin}){
  const [mode,setMode]=useState('login'); // login | register | recover
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showPw,setShowPw]=useState(false);
  const [form,setForm]=useState({username:'',password:'',displayName:'',question:'',answer:'',remember:true,newPassword:''});

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const submit=async e=>{
    e.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try{
      if(mode==='register'){
        const r=await window.smartscan.register(form);
        if(!r.ok) throw new Error(r.error);
        onLogin(r.user);
      } else if(mode==='login'){
        const r=await window.smartscan.login(form);
        if(!r.ok) throw new Error(r.error);
        onLogin(r.user);
      } else {
        const r=await window.smartscan.resetPassword({username:form.username,answer:form.answer,newPassword:form.newPassword});
        if(!r.ok) throw new Error(r.error);
        setNotice('Password updated. You can log in now.');
        setMode('login');
      }
    }catch(err){ setError(err.message||'Something went wrong.'); }
    finally{ setBusy(false); }
  };

  const doImport=async()=>{
    setError(''); setNotice(''); setBusy(true);
    try{
      const r=await window.smartscan.importAccount();
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
        <button className={mode==='recover'?'active':''} onClick={()=>{setMode('recover');setError('');setNotice('')}}>Forgot Password</button>
      </div>

      <form key={mode} className="auth-form auth-anim" onSubmit={submit}>
        <label className="auth-field"><User size={15}/><input autoFocus placeholder={mode==='recover'?'Your ID or username':'Choose or enter your ID (username)'} value={form.username} onChange={e=>set('username',e.target.value)} required/></label>

        {mode==='register'&&<label className="auth-field"><ShieldCheck size={15}/><input placeholder="Display name (optional)" value={form.displayName} onChange={e=>set('displayName',e.target.value)}/></label>}

        {mode!=='recover'&&<label className="auth-field"><Lock size={15}/><input type={showPw?'text':'password'} placeholder="Password" value={form.password} onChange={e=>set('password',e.target.value)} required minLength={4}/><button type="button" className="eye" onClick={()=>setShowPw(v=>!v)}>{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></label>}

        {mode==='register'&&<>
          <label className="auth-field"><KeyRound size={15}/><input placeholder="Recovery question (optional, e.g. first pet's name)" value={form.question} onChange={e=>set('question',e.target.value)}/></label>
          {form.question&&<label className="auth-field"><KeyRound size={15}/><input placeholder="Answer" value={form.answer} onChange={e=>set('answer',e.target.value)}/></label>}
        </>}

        {mode==='recover'&&<>
          <label className="auth-field"><KeyRound size={15}/><input placeholder="Answer to your recovery question" value={form.answer} onChange={e=>set('answer',e.target.value)} required/></label>
          <label className="auth-field"><Lock size={15}/><input type={showPw?'text':'password'} placeholder="New password" value={form.newPassword} onChange={e=>set('newPassword',e.target.value)} required minLength={4}/><button type="button" className="eye" onClick={()=>setShowPw(v=>!v)}>{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></label>
        </>}

        {mode!=='recover'&&<label className="auth-remember"><input type="checkbox" checked={form.remember} onChange={e=>set('remember',e.target.checked)}/> Keep me logged in on this PC</label>}

        {error&&<div className="auth-error">{error}</div>}
        {notice&&<div className="auth-notice"><CheckCircle2 size={14}/> {notice}</div>}

        <button className="auth-submit" disabled={busy} type="submit">{busy?<Loader2 className="spin" size={16}/>:<ArrowRight size={16}/>} {mode==='login'?'Log In':mode==='register'?'Create My ID':'Reset Password'}</button>
      </form>

      <div className="auth-divider"><span>offline account tools</span></div>
      <div className="auth-restore">
        <button onClick={doImport} disabled={busy}><UploadCloud size={14}/> Restore from backup file</button>
      </div>
      <p className="auth-foot">Everything stays on this computer — no internet connection or account server is used. Once you create an ID, use <b>Settings → Backup Account</b> after logging in to save an offline backup you can restore after a reinstall or on another PC.</p>
    </div>
  </div>;
}
