import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {
  Upload,FolderOpen,Search,Settings,History,ShieldCheck,Copy,
  HardDrive,ScanSearch,Image as ImageIcon,Video,FileText,Music,
  Palette,ExternalLink,Folder,Download,Star,RefreshCw,Brain,
  ChevronRight,PackageCheck,Database,Undo2,Gamepad2,RotateCcw,
  Play,Maximize2,CheckCircle2,Trophy,Keyboard,Grid3X3,LogOut,
  UploadCloud,DownloadCloud,UserCircle2,LayoutDashboard,
  TrendingUp,PieChart,Award,Edit3,Timer,Zap,Square,X as XIcon
} from 'lucide-react';

import './styles.css';
import Auth from './Auth.jsx';

const fmt=n =>
  n<1024?`${n||0} B`:
  n<1048576?`${(n/1024).toFixed(1)} KB`:
  n<1073741824?`${(n/1048576).toFixed(1)} MB`:
  `${(n/1073741824).toFixed(2)} GB`;

const date=x=>x?new Date(x).toLocaleString():'—';

const icon=k=>({
  Images:ImageIcon,
  Videos:Video,
  Documents:FileText,
  Audio:Music,
  Design:Palette,
  Other:FileText
}[k]||FileText);

const DEFAULT_SETTINGS={
  theme:'dark',
  accent:'#7659ff',
  animations:true,
  deepScan:true,
  minScore:18,
  confirmDelete:true,
  scanMetadata:true,
  scanSubfolders:true,
  showHidden:false,
  compactMode:false,
  autoSaveHistory:true,
  includeOther:true,
  rounded:'large',
  motion:'smooth',
  showThumbnails:true,
  glass:true,
  glow:true,
  soundEffects:true,
  music:false,
  volume:70,
  highContrast:false,
  fontSize:'medium'
};


/* =========================================================
   SOUND ENGINE (synthesized — no external audio files)
   ========================================================= */

let _actx=null;
const _getCtx=()=>{
  try{
    if(!_actx){
      const C=window.AudioContext||window.webkitAudioContext;
      if(C)_actx=new C();
    }
    if(_actx && _actx.state==='suspended'){
      _actx.resume().catch(()=>{});
    }
    return _actx;
  }catch(e){
    return null;
  }
};

let _sfxOn=true;
let _musicOn=false;
let _sfxVol=0.7;
const soundSetEnabled=(sfx,music,vol)=>{
  _sfxOn=!!sfx;
  _musicOn=!!music;
  _sfxVol=Math.max(0,Math.min(1,(vol??70)/100));
};

const _tone=(freq,dur=0.15,type='sine',vol=0.18,delay=0)=>{
  if(!_sfxOn)return;
  const ctx=_getCtx();
  if(!ctx)return;
  try{
    const t0=ctx.currentTime+delay;
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(freq,t0);
    const v=vol*_sfxVol;
    gain.gain.setValueAtTime(0,t0);
    gain.gain.linearRampToValueAtTime(v,t0+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0+dur+0.03);
  }catch(e){}
};

const SFX={
  click:()=>_tone(340,.05,'triangle',.14),
  tick:()=>_tone(520,.09,'square',.16),
  go:()=>{_tone(660,.13,'square',.22);_tone(880,.2,'square',.2,.09);},
  point:()=>{_tone(880,.08,'square',.16);_tone(1180,.1,'square',.14,.06);},
  hit:()=>{_tone(700,.1,'sawtooth',.2);_tone(1040,.13,'square',.16,.05);},
  miss:()=>_tone(160,.2,'sawtooth',.16),
  match:()=>{_tone(720,.09,'sine',.17);_tone(980,.11,'sine',.15,.07);},
  win:()=>{[660,880,1100,1320].forEach((f,i)=>_tone(f,.17,'square',.17,i*.11));},
  gameover:()=>{_tone(300,.25,'sawtooth',.18);_tone(180,.35,'sawtooth',.16,.15);}
};

let _musicTimer=null;
let _musicStep=0;
const _musicNotes=[220,277,330,220,277,330,392,330];
const musicStart=()=>{
  if(_musicTimer)return;
  const ctx=_getCtx();
  if(!ctx)return;
  _musicTimer=setInterval(()=>{
    if(!_musicOn)return;
    const f=_musicNotes[_musicStep%_musicNotes.length];
    _musicStep++;
    _tone(f,.5,'sine',.06);
    _tone(f*1.5,.5,'sine',.03,.02);
  },520);
};
const musicStop=()=>{
  if(_musicTimer){
    clearInterval(_musicTimer);
    _musicTimer=null;
  }
  _musicStep=0;
};


/* =========================================================
   MAIN APP
   ========================================================= */

function App({user,onLogout}) {
  const [page,setPage]=useState('scan');
  const [game,setGame]=useState('ragdoll');

  const [settings,setSettings]=useState(DEFAULT_SETTINGS);
  const [profile,setProfile]=useState({bio:'',joined:Date.now()});

  const [seed,setSeed]=useState(null);
  const [locations,setLocations]=useState([]);
  const [results,setResults]=useState([]);

  const [scanning,setScanning]=useState(false);
  const [progress,setProgress]=useState(0);
  const [drag,setDrag]=useState(false);
  const [filter,setFilter]=useState('All');
  const [query,setQuery]=useState('');

  const [history,setHistory]=useState([]);
  const [collections,setCollections]=useState([]);
  const [favorites,setFavorites]=useState([]);

  const [recovery,setRecovery]=useState(null);
  const [preview,setPreview]=useState(null);
  const [globalQuery,setGlobalQuery]=useState('');
  const [globalOpen,setGlobalOpen]=useState(false);
  const [toast,setToast]=useState('');

  /* Load local application data */
  useEffect(()=>{
    (async()=>{
      try{
        const d=await window.smartscan.loadData();

        setSettings({
          ...DEFAULT_SETTINGS,
          ...(d.settings||{})
        });

        setHistory(d.history||[]);
        setCollections(d.collections||[]);
        setFavorites(d.favorites||[]);
        setProfile({
          bio:'',
          joined:Date.now(),
          ...(d.profile||{})
        });

      }catch(error){
        console.error('Could not load local data:',error);
      }
    })();
  },[]);


  /* Toast */
  useEffect(()=>{
    if(toast){
      const t=setTimeout(()=>setToast(''),2800);
      return()=>clearTimeout(t);
    }
  },[toast]);


  /* Theme/settings */
  useEffect(()=>{
    document.documentElement.dataset.theme=settings.theme;

    document.documentElement.style.setProperty(
      '--accent',
      settings.accent||DEFAULT_SETTINGS.accent
    );

    /* A later CSS layer (the "GLOBAL APPLICATION COLOR FIX"
       block) derives --accent/--accent-soft/--accent-faint/etc
       from --user-accent with !important, so it must be kept
       in sync too or the accent picker silently does nothing. */
    document.documentElement.style.setProperty(
      '--user-accent',
      settings.accent||DEFAULT_SETTINGS.accent
    );

    document.documentElement.style.setProperty(
      '--radius',
      settings.rounded==='small'
        ?'10px'
        :settings.rounded==='medium'
          ?'15px'
          :'20px'
    );

    document.documentElement.style.setProperty(
      '--motion',
      settings.motion==='fast'
        ?'120ms'
        :settings.motion==='cinematic'
          ?'480ms'
          :'220ms'
    );

    document.documentElement.dataset.contrast=
      settings.highContrast?'high':'normal';

    document.documentElement.dataset.fontsize=
      settings.fontSize||'medium';

    soundSetEnabled(
      settings.soundEffects,
      settings.music,
      settings.volume
    );

  },[settings]);


  const persist=async(next={})=>{
    const merged={
      ...settings,
      ...next
    };

    await window.smartscan.saveData({
      history,
      favorites,
      collections,
      settings:merged
    });
  };


  /* =======================================================
     FILE SELECTION
     ======================================================= */

  const chooseFile = async () => {

    // ======================================================
    // ELECTRON DESKTOP
    // ======================================================
    if (window.smartscan?.selectFile) {
      try {
        const p = await window.smartscan.selectFile();
        if (!p) return;

        const info = await window.smartscan.fileInfo(p);
        if (!info) {
          setToast('Could not read the selected file.');
          return;
        }

        setSeed(info);
        setResults([]);
        setFilter('All');
        setQuery('');
        setPage('scan');
      } catch (error) {
        console.error('Electron file selection error:', error);
        setToast('Could not select the file.');
      }
      return;
    }

    // ======================================================
    // CHROME / MOBILE / NORMAL BROWSER
    // ======================================================
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '0';

    input.onchange = (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        input.remove();
        return;
      }

      const url = URL.createObjectURL(file);
      const type = file.type || '';

      const kind =
        type.startsWith('image/') ? 'Images' :
        type.startsWith('video/') ? 'Videos' :
        type.startsWith('audio/') ? 'Audio' :
        'Other';

      const info = {
        name: file.name,
        size: file.size,
        type: type,
        path: file.name,
        modified: file.lastModified,
        kind,
        url,
        file
      };

      // Create a browser thumbnail for image files.
      if (kind === 'Images') {
        info.thumbnail = url;
      }

      setSeed(info);
      setResults([]);
      setFilter('All');
      setQuery('');
      setPage('scan');
      setToast(`Selected: ${file.name}`);

      input.remove();
    };

    document.body.appendChild(input);
    input.click();
  };

  const chooseFolder=async()=>{
    const p=await window.smartscan.selectFolder();

    if(p && !locations.includes(p)){
      setLocations(x=>[...x,p]);
    }
  };


  const handleDrop=async e=>{
    e.preventDefault();
    setDrag(false);

    const f=e.dataTransfer.files?.[0];

    if(!f)return;

    const p=window.smartscan.getDroppedPath(f);

    if(p){
      const info=await window.smartscan.fileInfo(p);

      if(info){
        setSeed(info);
        setResults([]);
        setPage('scan');
      }
    }
  };


  /* =======================================================
     SMART SCAN
     ======================================================= */

  const runScan=async()=>{

    if(!seed?.path || scanning)return;

    setScanning(true);
    setProgress(8);
    setResults([]);

    const timer=setInterval(()=>{
      setProgress(
        p=>Math.min(
          88,
          p+Math.random()*12
        )
      );
    },350);

    try{

      const r=await window.smartscan.scan({
        seedPath:seed.path,
        locations,
        deepScan:settings.deepScan,
        minScore:settings.minScore
      });

      clearInterval(timer);

      setProgress(100);
      setResults(r.results||[]);
      setSeed(r.seed);

      if(settings.autoSaveHistory){

        const entry={
          id:Date.now(),
          seed:r.seed.path,
          found:r.results.length,
          date:Date.now(),
          results:r.results,
          seedInfo:r.seed
        };

        const next=[
          entry,
          ...history.filter(
            h=>h.seed!==entry.seed
          )
        ].slice(0,100);

        setHistory(next);

        await window.smartscan.saveData({
          history:next,
          favorites,
          collections,
          settings,
          profile
        });
      }

      setToast(
        `Scan complete — ${r.results.length} related files found.`
      );

    }catch(e){

      clearInterval(timer);

      setToast(
        e?.message||'Scan failed.'
      );

    }finally{

      setTimeout(()=>{
        setScanning(false);
        setProgress(0);
      },700);
    }
  };


  /* =======================================================
     RESULTS
     ======================================================= */

  const filtered=useMemo(
    ()=>results.filter(
      x=>
        (
          filter==='All' ||
          x.kind===filter ||
          filter==='Strongly Related' &&
          x.relatedScore>=80 ||
          filter==='Possibly Related' &&
          x.relatedScore<50 ||
          filter==='Duplicates' &&
          x.matchReasons?.includes('exact duplicate')
        ) &&
        (
          !query ||
          `${x.name} ${x.path} ${x.kind}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
    ),
    [results,filter,query]
  );


  const globalMatches=useMemo(()=>{

    const q=globalQuery.trim().toLowerCase();

    if(!q)return {files:[],projects:[],history:[]};

    const seen=new Set();
    const files=[];

    const consider=f=>{
      if(!f?.path||seen.has(f.path))return;
      if(
        (f.name||'').toLowerCase().includes(q)||
        f.path.toLowerCase().includes(q)
      ){
        seen.add(f.path);
        files.push(f);
      }
    };

    results.forEach(consider);
    history.forEach(h=>(h.results||[]).forEach(consider));

    favorites.forEach(p=>{
      if(seen.has(p))return;
      if(p.toLowerCase().includes(q)){
        seen.add(p);
        files.push({
          path:p,
          name:pathName(p),
          kind:'Other',
          relatedScore:0
        });
      }
    });

    const projects=collections.filter(c=>
      (c.name||'').toLowerCase().includes(q)
    );

    const historyMatches=history.filter(h=>
      pathName(h.seed||'').toLowerCase().includes(q)
    );

    return {
      files:files.slice(0,6),
      projects:projects.slice(0,4),
      history:historyMatches.slice(0,4)
    };

  },[globalQuery,results,history,favorites,collections]);


  const counts=useMemo(
    ()=>({
      Related:results.length,
      Images:results.filter(
        x=>x.kind==='Images'
      ).length,
      Videos:results.filter(
        x=>x.kind==='Videos'
      ).length,
      Documents:results.filter(
        x=>x.kind==='Documents'
      ).length,
      Design:results.filter(
        x=>x.kind==='Design'
      ).length,
      Audio:results.filter(
        x=>x.kind==='Audio'
      ).length
    }),
    [results]
  );


  const toggleFavorite=async file=>{

    const exists=favorites.includes(file.path);

    const next=exists
      ?favorites.filter(x=>x!==file.path)
      :[...favorites,file.path];

    setFavorites(next);

    await window.smartscan.saveData({
      history,
      favorites:next,
      collections,
      settings,
      profile
    });

    setToast(
      exists
        ?'Removed from favorites'
        :'Added to favorites'
    );
  };


  const renameFile=async(file,newName)=>{

    const res=await window.smartscan.renameFile(
      file.path,
      newName
    );

    if(!res?.ok){
      setToast(res?.error||'Rename failed.');
      return;
    }

    const oldPath=file.path;
    const newPath=res.newPath;
    const newLabel=pathName(newPath);

    const swapPath=p=>p===oldPath?newPath:p;

    const patchFile=f=>
      f.path===oldPath
        ?{...f,path:newPath,name:newLabel}
        :f;

    const nextResults=results.map(patchFile);
    const nextFavorites=favorites.map(swapPath);

    const nextHistory=history.map(entry=>({
      ...entry,
      results:(entry.results||[]).map(patchFile)
    }));

    const nextCollections=collections.map(col=>({
      ...col,
      results:(col.results||col.files||[]).map(patchFile)
    }));

    setResults(nextResults);
    setFavorites(nextFavorites);
    setHistory(nextHistory);
    setCollections(nextCollections);

    await window.smartscan.saveData({
      history:nextHistory,
      favorites:nextFavorites,
      collections:nextCollections,
      settings,
      profile
    });

    setToast(`Renamed to "${newLabel}"`);
  };


  /* =======================================================
     PROJECTS
     ======================================================= */

  const saveCollection=async()=>{

    if(!results.length){
      setToast('Run a scan first.');
      return;
    }

    const name=prompt(
      'Project name:',
      seed?.name||'SmartScan Project'
    );

    if(!name?.trim())return;

    const next=[
      ...collections,
      {
        id:Date.now(),
        name:name.trim(),
        seed:seed?.path,
        files:results.map(x=>x.path),
        results:[...results],
        seedInfo:seed,
        date:Date.now()
      }
    ];

    setCollections(next);

    await window.smartscan.saveData({
      history,
      favorites,
      collections:next,
      settings,
      profile
    });

    setToast(
      'Project saved. Open it anytime from Projects.'
    );
  };


  const openSnapshot=async snap=>{

    const info=
      snap.seedInfo ||
      await window.smartscan.fileInfo(snap.seed);

    if(!info){
      setToast(
        'The original file is no longer available.'
      );
      return;
    }

    setSeed(info);
    setFilter('All');
    setQuery('');
    setPage('scan');

    if(snap.results?.length){

      setResults(snap.results);

      setToast('Saved scan opened.');

      return;
    }

    setToast('Rebuilding this older scan…');

    try{

      const r=await window.smartscan.scan({
        seedPath:info.path,
        locations:[],
        deepScan:settings.deepScan,
        minScore:settings.minScore
      });

      setSeed(r.seed);
      setResults(r.results||[]);

      setToast(
        `Scan reopened — ${r.results.length} related files found.`
      );

    }catch(e){

      setResults([]);

      setToast(
        e?.message||'Could not reopen this scan.'
      );
    }
  };


  const exportReport=async()=>{

    if(!results.length){
      setToast(
        'No scan results to export.'
      );
      return;
    }

    const p=
      await window.smartscan.exportReport(results);

    if(p){
      setToast('Report exported.');
    }
  };


  const nav=[
    ['scan','Smart Scan',ScanSearch],
    ['dashboard','Dashboard',LayoutDashboard],
    ['projects','Projects',Folder],
    ['history','History',History],
    ['recovery','Recovery',Undo2],
    ['duplicates','Duplicates',Copy],
    ['storage','Storage',HardDrive],
    ['games','Games',Gamepad2],
    ['profile','Profile',UserCircle2]
  ];


  return (
    <div
      className={
        `app ${
          settings.compactMode
            ?'compact-sidebar'
            :''
        } ${
          !settings.animations
            ?'no-animations'
            :''
        } ${
          settings.glass
            ?'glass-ui'
            :''
        } ${
          settings.glow
            ?'glow-ui'
            :''
        }`
      }
    >

      <aside className="smart-sidebar">

  <button
  type="button"
  className="mobile-menu-btn"
  onClick={() => {
    document
      .querySelector('.smart-sidebar')
      ?.classList.toggle('mobile-open');
  }}
  aria-label="Open menu"
  title="Menu"
>
  ⋮
</button>

  <div className="brand"> 

          <div className="logo">
            <ScanSearch size={21}/>
          </div>

          <div>
            <b>
              Smart<span>Scan</span>X
            </b>

            <small>
              Local File Intelligence
            </small>
          </div>

        </div>


        <nav>

          {nav.map(([id,label,I])=>(
            <button
              key={id}
              className={
                page===id
                  ?'active'
                  :''
              }
              onClick={()=>{
                SFX.click();
                setPage(id);
              }}
            >
              <I size={15}/>
              <span>{label}</span>
            </button>
          ))}

        </nav>


        <button
          className={
            `settings ${
              page==='settings'
                ?'active'
                :''
            }`
          }
          onClick={()=>setPage('settings')}
        >
          <Settings size={17}/>
          <span>Settings</span>
        </button>


        <div className="account-chip">

          <UserCircle2 size={18}/>

          <div>
            <b>{user.displayName}</b>
            <small>ID: {user.id}</small>
          </div>

          <button
            title="Log out"
            onClick={onLogout}
          >
            <LogOut size={15}/>
          </button>

        </div>


        <div className="privacy">
          <ShieldCheck size={17}/>

          <div>
            <b>Local-first</b>
            <small>
              Your files stay on this PC
            </small>
          </div>
        </div>

      </aside>


      <main>

        <header>

          <div>

            <div className="eyebrow">
              SMART FILE ORGANIZER
            </div>

            <h1>
              {
                page==='scan'
                  ?'Find every file related to your project'
                  :page==='games'
                    ?'Game Center'
                    :page==='dashboard'
                      ?'Smart Dashboard'
                      :page==='profile'
                        ?'Your Profile'
                        :page[0].toUpperCase()+page.slice(1)
              }
            </h1>

            <p>
              {
                page==='games'
                  ?'Play small offline games for fun — choose one below.'
                  :page==='dashboard'
                    ?'A live look at your scanning activity, matches and habits.'
                    :page==='profile'
                      ?'Your local account, stats and achievements.'
                      :'Fast, private and intelligent file relationship scanning.'
              }
            </p>

          </div>


          <div className="header-actions">

            <div
              className="global-search"
              onBlur={()=>
                setTimeout(()=>setGlobalOpen(false),150)
              }
            >

              <Search size={14}/>

              <input
                placeholder="Search files, favorites, projects..."
                value={globalQuery}
                onChange={e=>{
                  setGlobalQuery(e.target.value);
                  setGlobalOpen(true);
                }}
                onFocus={()=>setGlobalOpen(true)}
              />

              {globalQuery&&
                <button
                  className="global-search-clear"
                  onClick={()=>{
                    setGlobalQuery('');
                    setGlobalOpen(false);
                  }}
                >
                  ✕
                </button>
              }

              {globalOpen&&globalQuery&&
                <div className="global-search-results">

                  {(
                    globalMatches.files.length+
                    globalMatches.projects.length+
                    globalMatches.history.length
                  )===0&&
                    <div className="gsr-empty">
                      No matches for "{globalQuery}"
                    </div>
                  }

                  {globalMatches.files.length>0&&
                    <div className="gsr-group">
                      <small>Files</small>

                      {globalMatches.files.map(f=>(
                        <div
                          className="gsr-row"
                          key={f.path}
                          onClick={()=>{
                            setPreview(f);
                            setGlobalOpen(false);
                          }}
                        >
                          <ScanSearch size={13}/>
                          <div>
                            <b>{f.name}</b>
                            <small>{f.path}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  }

                  {globalMatches.projects.length>0&&
                    <div className="gsr-group">
                      <small>Projects</small>

                      {globalMatches.projects.map(c=>(
                        <div
                          className="gsr-row"
                          key={c.id}
                          onClick={()=>{
                            openSnapshot(c);
                            setGlobalOpen(false);
                          }}
                        >
                          <Folder size={13}/>
                          <div>
                            <b>{c.name}</b>
                            <small>{(c.results||c.files||[]).length} files</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  }

                  {globalMatches.history.length>0&&
                    <div className="gsr-group">
                      <small>History</small>

                      {globalMatches.history.map(h=>(
                        <div
                          className="gsr-row"
                          key={h.id}
                          onClick={()=>{
                            openSnapshot(h);
                            setGlobalOpen(false);
                          }}
                        >
                          <History size={13}/>
                          <div>
                            <b>{pathName(h.seed)}</b>
                            <small>{h.found} related files</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  }

                </div>
              }

            </div>


            <button
              className="install"
              onClick={async()=>{

                const r=
                  await window.smartscan.installApp();

                setToast(
                  r.packaged
                    ?'Installer-ready build is running.'
                    :'Use BUILD-INSTALLER.bat to create the Windows installer.'
                );
              }}
            >
              <PackageCheck size={16}/>
              Install App
            </button>

          </div>

        </header>


        <div
          key={page}
          className="page-anim"
        >

          {page==='scan'&&<>

            <section className="hero">

              <div
                className={`drop ${
                  drag?'drag':''
                }`}
                onDragOver={e=>{
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={()=>
                  setDrag(false)
                }
                onDrop={handleDrop}
              >

                <Upload size={38}/>

                <h2>
                  Drop one file here
                </h2>

                <p>
                  Images, videos, documents,
                  audio and design files
                </p>

                <button onClick={chooseFile}>
                  <FolderOpen size={17}/>
                  Browse File
                </button>

                <small>
                  Single-file scan •
                  Drag & drop supported
                </small>

              </div>


              {seed&&
                <div className="selected">

                  <div className="filebadge">
                    {
                      seed.thumbnail
                        ?<img
                            src={seed.thumbnail}
                            alt=""
                          />
                        :React.createElement(
                            icon(seed.kind),
                            {size:21}
                          )
                    }
                  </div>

                  <div>
                    <b>{seed.name}</b>
                    <small>{seed.path}</small>
                    <em>
                      Ready to scan •
                      {seed.kind} •
                      {fmt(seed.size)}
                    </em>
                  </div>

                  <button
                    onClick={()=>{
                      setSeed(null);
                      setResults([]);
                    }}
                  >
                    ×
                  </button>

                </div>
              }


              <div className="locations">

                <b>Search locations</b>

                <div className="chips">

                  {locations.map(x=>(
                    <span key={x}>
                      {x}

                      <button
                        onClick={()=>
                          setLocations(
                            v=>v.filter(
                              p=>p!==x
                            )
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <button
                    className="add"
                    onClick={chooseFolder}
                  >
                    + Add folder
                  </button>

                </div>

              </div>


              {scanning&&<>
                <div className="progress">
                  <div
                    style={{
                      width:`${progress}%`
                    }}
                  />
                </div>

                <div className="scan-status">
                  Smart engine is reading metadata,
                  names, folders, content hints and
                  image similarity…
                  {' '}
                  {Math.round(progress)}%
                </div>
              </>}


              <button
                className="scanbtn"
                disabled={!seed||scanning}
                onClick={runScan}
              >
                {
                  scanning
                    ?<>
                        <RefreshCw
                          className="spin"
                          size={17}
                        />
                        Scanning…
                      </>
                    :<>
                        <ScanSearch size={17}/>
                        Start Smart Scan
                      </>
                }
              </button>

            </section>


            <div className="stats">

              {Object.entries(counts).map(
                ([k,v])=>(
                  <div
                    className="stat"
                    key={k}
                  >
                    <b>{v}</b>
                    <small>{k}</small>
                  </div>
                )
              )}

            </div>


            <section className="results">

              <div className="resulthead">

                <div>
                  <h2>
                    Relationship Results
                  </h2>

                  <small>
                    Sorted by evidence-based
                    relationship score.
                  </small>
                </div>


                <label className="search">

                  <Search size={15}/>

                  <input
                    value={query}
                    onChange={e=>
                      setQuery(e.target.value)
                    }
                    placeholder="Search results…"
                  />

                </label>

              </div>


              <div className="filters">

                {[
                  'All',
                  'Images',
                  'Videos',
                  'Documents',
                  'Design',
                  'Audio',
                  'Duplicates',
                  'Strongly Related',
                  'Possibly Related'
                ].map(x=>(
                  <button
                    key={x}
                    className={
                      filter===x
                        ?'sel'
                        :''
                    }
                    onClick={()=>
                      setFilter(x)
                    }
                  >
                    {x}
                  </button>
                ))}

              </div>


              {
                filtered.length
                  ?<div className="grid">

                      {filtered.map(file=>(
                        <FileCard
                          key={file.path}
                          file={file}
                          favorite={
                            favorites.includes(
                              file.path
                            )
                          }
                          showThumb={
                            settings.showThumbnails
                          }
                          onPreview={()=>
                            setPreview(file)
                          }
                          onFavorite={()=>
                            toggleFavorite(file)
                          }
                          onRename={renameFile}
                        />
                      ))}

                    </div>
                  :<Empty
                      text={
                        seed
                          ?'No matching files found'
                          :'No scan results yet'
                      }
                      sub={
                        seed
                          ?'Try adding another search folder or lowering the relationship threshold in Settings.'
                          :'Select one file and run Smart Scan to discover related files.'
                      }
                    />
              }


              <div className="footerActions">

                <span>
                  {
                    results.length
                      ?`${results.length} related files found`
                      :'Ready'
                  }
                </span>

                <div>

                  <button
                    onClick={saveCollection}
                  >
                    Save Project
                  </button>

                  <button
                    onClick={exportReport}
                  >
                    <Download size={13}/>
                    Export
                  </button>

                </div>

              </div>

            </section>

          </>}


          {page==='projects'&&
            <Panel title="Project Collections">

              <p className="muted">
                Saved scans can be reopened
                with their relationship results.
              </p>

              {
                collections.length
                  ?<div className="list">

                      {collections.map(c=>(
                        <div
                          className="row clickable"
                          key={c.id}
                          onClick={()=>
                            openSnapshot(c)
                          }
                        >

                          <Folder/>

                          <div>
                            <b>{c.name}</b>

                            <small>
                              {(c.results||c.files||[]).length}
                              {' '}
                              files •
                              {' '}
                              {date(c.date)}
                            </small>
                          </div>

                          <ChevronRight size={15}/>

                        </div>
                      ))}

                    </div>
                  :<Empty
                      text="No projects yet"
                      sub="Run a scan and choose Save Project."
                    />
              }

            </Panel>
          }


          {page==='history'&&
            <Panel title="Scan History">

              <p className="muted">
                Click any scan to reopen
                its saved results.
              </p>

              {
                history.length
                  ?<div className="list">

                      {history.map(h=>(
                        <div
                          className="row clickable"
                          key={h.id}
                          onClick={()=>
                            openSnapshot(h)
                          }
                        >

                          <History/>

                          <div>
                            <b>{pathName(h.seed)}</b>

                            <small>
                              {h.found}
                              {' '}
                              related files •
                              {' '}
                              {date(h.date)}
                            </small>
                          </div>

                          <ChevronRight size={15}/>

                        </div>
                      ))}

                    </div>
                  :<Empty
                      text="No scan history"
                      sub="Your completed scans will appear here."
                    />
              }

            </Panel>
          }


          {page==='recovery'&&
            <Recovery
              notify={setToast}
              recovery={recovery}
              setRecovery={setRecovery}
            />
          }


          {page==='duplicates'&&
            <Panel title="Duplicate Center">

              <p className="muted">
                Exact duplicates are identified
                using a local SHA-1 fingerprint.
                Nothing is deleted automatically.
              </p>

              {
                results.filter(
                  x=>x.matchReasons?.includes(
                    'exact duplicate'
                  )
                ).length
                  ?<div className="list">

                      {results
                        .filter(
                          x=>x.matchReasons?.includes(
                            'exact duplicate'
                          )
                        )
                        .map(x=>(
                          <div
                            className="row"
                            key={x.path}
                          >

                            <Copy/>

                            <div>
                              <b>{x.name}</b>

                              <small>
                                {fmt(x.size)}
                                {' • '}
                                {x.path}
                              </small>
                            </div>

                            <button
                              onClick={()=>
                                window.smartscan.showFolder(
                                  x.path
                                )
                              }
                            >
                              Folder
                            </button>

                          </div>
                        ))}

                    </div>
                  :<Empty
                      text="No duplicates in the latest scan"
                      sub="Select a file and run Smart Scan."
                    />
              }

            </Panel>
          }


          {page==='storage'&&
            <Panel title="Storage & Safety">

              <div className="feature">

                <Database/>

                <div>
                  <b>Local database</b>

                  <small>
                    Scan history, settings,
                    favorites and collections
                    are stored in your Windows
                    user data folder, private to
                    your ID ({user.id}).
                  </small>
                </div>

              </div>


              <div className="feature">

                <ShieldCheck/>

                <div>
                  <b>Privacy by design</b>

                  <small>
                    SmartScan performs matching
                    locally. Your files are not
                    uploaded to a server.
                  </small>
                </div>

              </div>


              <div className="feature">

                <Brain/>

                <div>
                  <b>Smart relationship engine</b>

                  <small>
                    Combines filenames, folders,
                    type, dates, content keywords,
                    dimensions, exact fingerprints
                    and perceptual image similarity.
                  </small>
                </div>

              </div>


              <div className="feature">

                <UploadCloud/>

                <div>
                  <b>Backup your account</b>

                  <small>
                    Save your ID, password and
                    all your data to one offline
                    file — restore it after a
                    reinstall or on another PC.
                  </small>
                </div>

                <button
                  className="ghostbtn"
                  onClick={async()=>{

                    const r=
                      await window.smartscan.exportAccount();

                    setToast(
                      r?.ok
                        ?'Backup saved.'
                        :'Backup cancelled.'
                    );
                  }}
                >
                  Backup Account
                </button>

              </div>

            </Panel>
          }


          {page==='settings'&&
            <SettingsPanel
              settings={settings}
              setSettings={async next=>{

                const merged={
                  ...settings,
                  ...next
                };

                setSettings(merged);

                await window.smartscan.saveData({
                  history,
                  favorites,
                  collections,
                  settings:merged,
                  profile
                });

                setToast(
                  'Settings saved.'
                );
              }}
            />
          }


          {page==='games'&&
            <GameCenter
              game={game}
              setGame={setGame}
              settings={settings}
            />
          }


          {page==='dashboard'&&
            <Dashboard
              history={history}
              favorites={favorites}
              collections={collections}
              results={results}
              counts={counts}
            />
          }


          {page==='profile'&&
            <ProfilePage
              user={user}
              profile={profile}
              setProfile={async next=>{
                const merged={...profile,...next};
                setProfile(merged);
                await window.smartscan.saveData({
                  history,favorites,collections,settings,profile:merged
                });
              }}
              history={history}
              favorites={favorites}
              collections={collections}
              settings={settings}
            />
          }

        </div>

      </main>


      {preview&&
        <Preview
          file={preview}
          close={()=>
            setPreview(null)
          }
        />
      }

      {toast&&
        <div className="toast">
          {toast}
        </div>
      }

    </div>
  );



/* =========================================================
   DASHBOARD
   ========================================================= */

function Dashboard({history,favorites,collections,results,counts}){

  const totalScans=history.length;
  const totalFound=history.reduce((s,h)=>s+(h.found||0),0);
  const avgScore=useMemo(()=>{
    const all=results.length?results:(history[0]?.results||[]);
    if(!all.length)return 0;
    return Math.round(
      all.reduce((s,x)=>s+(x.relatedScore||0),0)/all.length
    );
  },[results,history]);

  // Last 7 history entries, oldest -> newest, for the bar chart
  const recent=useMemo(
    ()=>[...history].slice(0,7).reverse(),
    [history]
  );
  const maxFound=Math.max(1,...recent.map(h=>h.found||0));

  // Type breakdown donut, from current results or most recent scan
  const typeSource=results.length?results:(history[0]?.results||[]);
  const typeCounts=useMemo(()=>{
    const c={Images:0,Videos:0,Documents:0,Design:0,Audio:0,Other:0};
    typeSource.forEach(x=>{
      c[x.kind && c.hasOwnProperty(x.kind)?x.kind:'Other']++;
    });
    return c;
  },[typeSource]);
  const typeTotal=Object.values(typeCounts).reduce((a,b)=>a+b,0)||1;
  const typeColors={
    Images:'#00b8d9',Videos:'#ff7a45',Documents:'#7659ff',
    Design:'#f03e8c',Audio:'#f2b84b',Other:'#19b878'
  };

  // Score trend across recent history entries
  const scoreTrend=useMemo(()=>{
    return recent.map(h=>{
      const rs=h.results||[];
      if(!rs.length)return 0;
      return Math.round(rs.reduce((s,x)=>s+(x.relatedScore||0),0)/rs.length);
    });
  },[recent]);

  const linePoints=(()=>{
    if(scoreTrend.length<2)return null;
    const w=560,h=140,pad=10;
    const step=(w-pad*2)/(scoreTrend.length-1);
    return scoreTrend.map((v,i)=>{
      const x=pad+i*step;
      const y=h-pad-((v/100)*(h-pad*2));
      return [x,y];
    });
  })();

  const linePath=linePoints
    ?'M'+linePoints.map(p=>p.join(',')).join(' L')
    :'';
  const fillPath=linePoints
    ?linePath+` L${linePoints[linePoints.length-1][0]},140 L${linePoints[0][0]},140 Z`
    :'';

  let donutOffset=0;

  return (
    <div className="dash-page">

      <div className="dash-stats">

        <div className="dash-stat">
          <History size={18} className="dash-icon"/>
          <b>{totalScans}</b>
          <small>Total scans run</small>
        </div>

        <div className="dash-stat">
          <ScanSearch size={18} className="dash-icon"/>
          <b>{totalFound}</b>
          <small>Related files found (all-time)</small>
        </div>

        <div className="dash-stat">
          <Star size={18} className="dash-icon"/>
          <b>{favorites.length}</b>
          <small>Favorited files</small>
        </div>

        <div className="dash-stat">
          <Folder size={18} className="dash-icon"/>
          <b>{collections.length}</b>
          <small>Saved projects</small>
        </div>

      </div>


      <div className="dash-grid">

        <div>

          <div className="dash-card">
            <h3><TrendingUp size={14}/> Files found per scan</h3>
            <p className="muted">Your last {recent.length||0} scans, most recent on the right.</p>

            {recent.length
              ?<div className="dash-bars">
                  {recent.map((h,i)=>(
                    <div className="dash-bar-col" key={h.id||i}>
                      <div
                        className="dash-bar"
                        style={{
                          height:`${Math.max(6,(h.found||0)/maxFound*100)}%`,
                          animationDelay:`${i*70}ms`
                        }}
                        title={`${h.found} files`}
                      />
                      <small>{h.found}</small>
                    </div>
                  ))}
                </div>
              :<div className="dash-empty">Run a Smart Scan to start building this chart.</div>
            }
          </div>

          <div className="dash-card">
            <h3><Zap size={14}/> Average match score trend</h3>
            <p className="muted">Average relationship score across your recent scans.</p>

            {linePoints
              ?<div className="dash-line-wrap">
                  <svg className="dash-line" viewBox="0 0 560 150" width="100%" height="150">
                    <path className="line-fill" d={fillPath} fill="color-mix(in srgb,var(--accent),transparent 82%)"/>
                    <path className="line-path" d={linePath} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    {linePoints.map(([x,y],i)=>(
                      <circle key={i} cx={x} cy={y} r="4.5" fill="#fff" stroke="var(--accent)" strokeWidth="2" style={{animationDelay:`${1.1+i*0.08}s`}}/>
                    ))}
                  </svg>
                </div>
              :<div className="dash-empty">Run at least two scans to see a trend line.</div>
            }
          </div>

        </div>


        <div>

          <div className="dash-card">
            <h3><PieChart size={14}/> File type breakdown</h3>
            <p className="muted">From your most recent scan results.</p>

            {typeTotal>1
              ?<div className="dash-donut-wrap">
                  <svg className="dash-donut" width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#1d2944" strokeWidth="14"/>
                    {Object.entries(typeCounts).filter(([,v])=>v>0).map(([k,v])=>{
                      const circumference=2*Math.PI*50;
                      const frac=v/typeTotal;
                      const seg=frac*circumference;
                      const dashoffset=-donutOffset;
                      donutOffset+=seg;
                      return (
                        <circle
                          key={k}
                          className="donut-seg"
                          cx="60" cy="60" r="50" fill="none"
                          stroke={typeColors[k]}
                          strokeWidth="14"
                          strokeDashoffset={dashoffset}
                          style={{'--seg':seg}}
                        />
                      );
                    })}
                  </svg>

                  <div className="dash-legend">
                    {Object.entries(typeCounts).filter(([,v])=>v>0).map(([k,v])=>(
                      <span key={k}>
                        <i style={{background:typeColors[k]}}/>
                        {k} — {v} ({Math.round(v/typeTotal*100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              :<div className="dash-empty">Scan a file to see its type breakdown.</div>
            }
          </div>

          <div className="dash-card">
            <h3><Award size={14}/> Average relationship score</h3>
            <p className="muted">Across your current or most recent results.</p>

            <div className="dash-gauge-wrap">
              <svg className="dash-gauge" width="140" height="90" viewBox="0 0 140 90">
                <path d="M15,85 A70,70 0 0 1 125,85" fill="none" stroke="#1d2944" strokeWidth="14" strokeLinecap="round"/>
                <path
                  className="gauge-fg"
                  d="M15,85 A70,70 0 0 1 125,85"
                  fill="none" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round"
                  style={{'--off':251-(avgScore/100*251)}}
                />
              </svg>
              <div className="dash-gauge-num">{avgScore}%</div>
              <small className="muted">Higher means stronger, more confident matches</small>
            </div>
          </div>

          <div className="dash-card">
            <h3><Folder size={14}/> Recent projects</h3>
            <p className="muted">Your most recently saved collections.</p>

            {collections.length
              ?<div className="dash-list">
                  {collections.slice(0,4).map(c=>(
                    <div className="row" key={c.id}>
                      <Folder size={16}/>
                      <div>
                        <b>{c.name}</b>
                        <small>{(c.results||c.files||[]).length} files</small>
                      </div>
                    </div>
                  ))}
                </div>
              :<div className="dash-empty">No projects saved yet.</div>
            }
          </div>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   PROFILE
   ========================================================= */

function ProfilePage({user,profile,setProfile,history,favorites,collections,settings}){

  const [editing,setEditing]=useState(false);
  const [nameDraft,setNameDraft]=useState(profile?.displayName||user.displayName||'');
  const [bioDraft,setBioDraft]=useState(profile?.bio||'');

  const initials=(profile?.displayName||user.displayName||user.username||'?')
    .trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()).join('')||'?';

  const totalScans=history.length;
  const totalFound=history.reduce((s,h)=>s+(h.found||0),0);
  const joinedLabel=date(profile?.joined);

  const accentSwatches=['#7659ff','#00b8d9','#19b878','#ff7a45','#f03e8c','#f2b84b'];

  const badges=[
    {
      id:'first-scan',title:'First Scan',desc:'Ran your first Smart Scan',
      unlocked:totalScans>=1
    },
    {
      id:'organizer',title:'Organizer',desc:'Saved 3 or more projects',
      unlocked:collections.length>=3
    },
    {
      id:'curator',title:'Curator',desc:'Favorited 5 or more files',
      unlocked:favorites.length>=5
    },
    {
      id:'power-user',title:'Power User',desc:'Ran 10 or more scans',
      unlocked:totalScans>=10
    },
    {
      id:'finder',title:'Master Finder',desc:'Found 100+ related files total',
      unlocked:totalFound>=100
    },
    {
      id:'gamer',title:'Break Time',desc:'Visited the Game Center',
      unlocked:!!profile?.playedGames
    }
  ];

  const save=()=>{
    setProfile({
      displayName:nameDraft.trim()||user.displayName,
      bio:bioDraft
    });
    setEditing(false);
    SFX.click();
  };

  return (
    <div className="profile-page">

      <div className="profile-head">

        <div className="profile-avatar">{initials}</div>

        <div>
          <h2>{profile?.displayName||user.displayName}</h2>
          <p className="muted">{profile?.bio||'No bio yet — click Edit to add one.'}</p>
          <span className="profile-id-badge">
            <UserCircle2 size={12}/> ID: {user.id} • Member since {joinedLabel}
          </span>
        </div>

        <div className="profile-edit-row">

          {editing
            ?<>
                <input
                  value={nameDraft}
                  onChange={e=>setNameDraft(e.target.value)}
                  placeholder="Display name"
                />
                <input
                  value={bioDraft}
                  onChange={e=>setBioDraft(e.target.value)}
                  placeholder="Short bio"
                />
                <button className="full-btn" onClick={save}>
                  <CheckCircle2 size={14}/> Save
                </button>
              </>
            :<button className="full-btn" onClick={()=>setEditing(true)}>
                <Edit3 size={14}/> Edit Profile
              </button>
          }

          <div className="profile-accent-row">
            {accentSwatches.map(c=>(
              <button
                key={c}
                title={c}
                className={settings.accent?.toLowerCase()===c.toLowerCase()?'swatch-sel':''}
                style={{
                  width:20,height:20,borderRadius:'50%',
                  border:'2px solid #ffffff44',background:c,cursor:'pointer'
                }}
              />
            ))}
          </div>

        </div>

      </div>


      <div className="profile-stats">

        <div className="dash-stat">
          <History size={18} className="dash-icon"/>
          <b>{totalScans}</b>
          <small>Scans run</small>
        </div>

        <div className="dash-stat">
          <ScanSearch size={18} className="dash-icon"/>
          <b>{totalFound}</b>
          <small>Files found</small>
        </div>

        <div className="dash-stat">
          <Star size={18} className="dash-icon"/>
          <b>{favorites.length}</b>
          <small>Favorites</small>
        </div>

        <div className="dash-stat">
          <Folder size={18} className="dash-icon"/>
          <b>{collections.length}</b>
          <small>Projects</small>
        </div>

      </div>


      <Panel title="Achievements">
        <div className="profile-badges">
          {badges.map(b=>(
            <div className={`profile-badge ${b.unlocked?'':'locked'}`} key={b.id}>
              <Award size={22} color={b.unlocked?'var(--accent)':'#7c8bab'}/>
              <div>
                <b>{b.title}</b>
                <small>{b.desc}</small>
              </div>
            </div>
          ))}
        </div>
      </Panel>

    </div>
  );
}


/* =========================================================
   HELPERS
   ========================================================= */

function pathName(p){
  return p
    ?p.split(/[\\/]/).pop()
    :'';
}


function FileCard({
  file,
  favorite,
  onPreview,
  onFavorite,
  onRename,
  showThumb
}){

  const I=icon(file.kind);

  const [renaming,setRenaming]=useState(false);
  const [nameDraft,setNameDraft]=useState(file.name);

  const submitRename=()=>{

    const trimmed=nameDraft.trim();

    if(!trimmed||trimmed===file.name){
      setRenaming(false);
      setNameDraft(file.name);
      return;
    }

    onRename?.(file,trimmed);
    setRenaming(false);
  };

  return (
    <div className="card">

      <div className="thumb">

        {
          showThumb&&file.thumbnail
            ?<img
                src={file.thumbnail}
                alt="Preview"
              />
            :React.createElement(
                I,
                {size:28}
              )
        }

        <span>
          {file.relatedScore}%
        </span>

      </div>


      <div className="cardbody">

        {renaming
          ?<input
              autoFocus
              className="rename-input"
              value={nameDraft}
              onChange={e=>setNameDraft(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='Enter')submitRename();
                if(e.key==='Escape'){
                  setRenaming(false);
                  setNameDraft(file.name);
                }
              }}
              onBlur={submitRename}
            />
          :<b title={file.name}>
              {file.name}
            </b>
        }

        <small title={file.path}>
          {file.kind}
          {' • '}
          {fmt(file.size)}
          {' • '}
          {file.path}
        </small>

        <div className="bar">
          <i
            style={{
              width:`${file.relatedScore}%`
            }}
          />
        </div>

        <div className="reasons">

          {(file.matchReasons||[])
            .slice(0,4)
            .map(r=>(
              <span key={r}>
                {r}
              </span>
            ))}

        </div>


        <div className="actions">

          <button onClick={onPreview}>
            Preview
          </button>

          <button
            onClick={()=>
              window.smartscan.openPath(
                file.path
              )
            }
          >
            <ExternalLink size={12}/>
            Open
          </button>

          <button
            onClick={()=>
              window.smartscan.showFolder(
                file.path
              )
            }
          >
            <Folder size={12}/>
            Folder
          </button>

          {onRename&&
            <button
              onClick={()=>{
                setNameDraft(file.name);
                setRenaming(true);
              }}
            >
              <Edit3 size={12}/>
              Rename
            </button>
          }

          <button onClick={onFavorite}>
            <Star
              size={12}
              fill={
                favorite
                  ?'currentColor'
                  :'none'
              }
            />
          </button>

        </div>

      </div>

    </div>
  );
}


function Empty({text,sub}){

  return (
    <div className="empty">

      <ScanSearch size={44}/>

      <h3>{text}</h3>

      <p>{sub}</p>

    </div>
  );
}


function Panel({title,children}){

  return (
    <section className="panel">

      <h2>{title}</h2>

      {children}

    </section>
  );
}


function Recovery({
  notify,
  recovery,
  setRecovery
}){

  return (
    <Panel title="Recovery Center">

      <p className="muted">
        Shows items currently visible
        in the Windows Recycle Bin.
        SmartScan never restores or
        deletes automatically.
      </p>


      <button
        className="scanSmall"
        onClick={async()=>{

          const x=
            await window.smartscan.recoveryScan();

          setRecovery(x);

          notify(
            `${x.length} recovery candidates found.`
          );

        }}
      >
        <RefreshCw size={16}/>
        Scan Recycle Bin
      </button>


      {recovery&&
        <div className="list">

          {recovery.map(x=>(
            <div
              className="row"
              key={x.path}
            >

              <Undo2/>

              <div>
                <b>{x.name}</b>

                <small>
                  {x.kind}
                  {' • '}
                  {fmt(x.size)}
                </small>
              </div>

              <button
                onClick={()=>
                  window.smartscan.showFolder(
                    x.path
                  )
                }
              >
                Folder
              </button>

            </div>
          ))}

        </div>
      }

    </Panel>
  );
}


/* =========================================================
   SETTINGS
   ========================================================= */

function SettingsPanel({
  settings,
  setSettings
}){

  const row=(label,desc,key)=>
    <div className="setting">

      <div>
        <b>{label}</b>
        <small>{desc}</small>
      </div>

      <label className="switch">

        <input
          type="checkbox"
          checked={!!settings[key]}
          onChange={e=>
            setSettings({
              [key]:e.target.checked
            })
          }
        />

        <span/>

      </label>

    </div>;


  const accentSwatches=[
    '#7659ff','#00b8d9','#19b878','#ff7a45',
    '#f03e8c','#f2b84b','#3fa9ff','#ffffff'
  ];

  return (
    <Panel title="Settings">

      <p className="muted settings-intro">
        Every setting here is applied live and saved
        only to your local account — tune the app to
        match how you like to work.
      </p>


      <h3 className="settings-section-title">
        <Palette size={14}/> Appearance
      </h3>

      <div className="settings-grid">

        <div className="setting">

          <div>
            <b>Theme</b>
            <small>
              Choose the whole application look.
            </small>
          </div>

          <select
            value={settings.theme}
            onChange={e=>
              setSettings({
                theme:e.target.value
              })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="midnight">Midnight</option>
            <option value="forest">Forest</option>
            <option value="sunset">Sunset</option>
          </select>

        </div>


        <div className="setting">

          <div>
            <b>Accent color</b>

            <small>
              Your pick instantly recolors buttons,
              highlights, sliders, charts and the
              active navigation item.
            </small>
          </div>


          <div className="color-tools">

            <input
              className="color"
              type="color"
              value={settings.accent}
              onChange={e=>
                setSettings({
                  accent:e.target.value
                })
              }
            />

            <div className="swatches">

              {accentSwatches.map(c=>(
                <button
                  key={c}
                  title={c}
                  className={
                    settings.accent?.toLowerCase()===c.toLowerCase()
                      ?'swatch-sel'
                      :''
                  }
                  style={{
                    background:c
                  }}
                  onClick={()=>
                    setSettings({
                      accent:c
                    })
                  }
                />
              ))}

            </div>

          </div>

        </div>


        <div className="setting">

          <div>
            <b>Interface shape</b>

            <small>
              Control how rounded the cards
              and controls feel.
            </small>
          </div>

          <select
            value={settings.rounded}
            onChange={e=>
              setSettings({
                rounded:e.target.value
              })
            }
          >
            <option value="small">
              Compact
            </option>

            <option value="medium">
              Balanced
            </option>

            <option value="large">
              Soft
            </option>

          </select>

        </div>


        <div className="setting">

          <div>
            <b>Animation speed</b>

            <small>
              Make the UI feel fast or cinematic.
            </small>
          </div>

          <select
            value={settings.motion}
            onChange={e=>
              setSettings({
                motion:e.target.value
              })
            }
          >
            <option value="fast">
              Fast
            </option>

            <option value="smooth">
              Smooth
            </option>

            <option value="cinematic">
              Cinematic
            </option>

          </select>

        </div>


        <div className="setting">

          <div>
            <b>Text size</b>

            <small>
              Scale the whole interface up or down.
            </small>
          </div>

          <select
            value={settings.fontSize}
            onChange={e=>
              setSettings({
                fontSize:e.target.value
              })
            }
          >
            <option value="small">Small</option>
            <option value="medium">Default</option>
            <option value="large">Large</option>
          </select>

        </div>


        {row(
          'Animations',
          'Use smooth interface animations.',
          'animations'
        )}

        {row(
          'Animated glow',
          'Add subtle moving highlights to the interface.',
          'glow'
        )}

        {row(
          'Glass panels',
          'Use translucent animated panels.',
          'glass'
        )}

        {row(
          'Compact sidebar',
          'Use a smaller navigation sidebar.',
          'compactMode'
        )}

        {row(
          'High contrast',
          'Boost text and border contrast for readability.',
          'highContrast'
        )}

      </div>


      <h3 className="settings-section-title">
        <Music size={14}/> Sound &amp; Music
      </h3>

      <div className="settings-grid">

        {row(
          'Sound effects',
          'Play short sounds for clicks, countdowns and game events.',
          'soundEffects'
        )}

        {row(
          'Background music',
          'Play a soft looping tune while in the Game Center.',
          'music'
        )}

        <div className="setting">

          <div>
            <b>Volume</b>
            <small>Master volume for effects and music.</small>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={settings.volume}
            onChange={e=>
              setSettings({
                volume:Number(e.target.value)
              })
            }
            onMouseUp={()=>SFX.click()}
          />

        </div>

      </div>


      <h3 className="settings-section-title">
        <ScanSearch size={14}/> Scanning behavior
      </h3>

      <div className="settings-grid">

        {row(
          'Deep scan',
          'Search deeper folder trees and more files.',
          'deepScan'
        )}

        {row(
          'Scan metadata',
          'Use dimensions and local content hints when available.',
          'scanMetadata'
        )}

        {row(
          'Scan subfolders',
          'Include nested folders under selected locations.',
          'scanSubfolders'
        )}

        {row(
          'Auto-save history',
          'Keep completed scans in local history.',
          'autoSaveHistory'
        )}

        {row(
          'Show image thumbnails',
          'Show a small picture of image results after scanning.',
          'showThumbnails'
        )}

        {row(
          'Include other files',
          'Keep unsupported/common files in matching results.',
          'includeOther'
        )}

      </div>


      <div className="threshold">

        <b>
          Minimum relationship score:
          {' '}
          {settings.minScore}%
        </b>

        <input
          type="range"
          min="5"
          max="60"
          value={settings.minScore}
          onChange={e=>
            setSettings({
              minScore:Number(
                e.target.value
              )
            })
          }
        />

        <small>
          Lower values find more possible
          relationships; higher values show
          only stronger matches.
        </small>

      </div>

    </Panel>
  );
}


/* =========================================================
   PREVIEW
   ========================================================= */

function Preview({file,close}){

  const isImage=
    file.kind==='Images';

  const isVideo=
    file.kind==='Videos';

  const isPdf=
    file.ext==='.pdf';


  return (
    <div
      className="modal"
      onClick={close}
    >

      <div
        className="modalbox"
        onClick={e=>
          e.stopPropagation()
        }
      >

        <button
          className="close"
          onClick={close}
        >
          ×
        </button>

        <h2>{file.name}</h2>

        <p>{file.path}</p>


        {
          isImage&&file.thumbnail
            ?<img
                className="big-preview"
                src={file.thumbnail}
                alt={file.name}
              />

            :isVideo
              ?<video
                  className="big-preview"
                  src={
                    file.url||
                    `file:///${file.path.replaceAll(
                      '\\',
                      '/'
                    )}`
                  }
                  controls
                />

              :isPdf
                ?<iframe
                    className="doc-preview"
                    src={
                      `file:///${file.path.replaceAll(
                        '\\',
                        '/'
                      )}`
                    }
                    title={file.name}
                  />

                :<div className="previewIcon">

                    {React.createElement(
                      icon(file.kind),
                      {size:64}
                    )}

                    <span>
                      Open the file with the
                      Windows default app
                    </span>

                  </div>
        }


        <div className="meta">

          <span>
            Related score
            {' '}
            <b>{file.relatedScore}%</b>
          </span>

          <span>
            Type
            {' '}
            <b>{file.kind}</b>
          </span>

          <span>
            Size
            {' '}
            <b>{fmt(file.size)}</b>
          </span>

          <span>
            Modified
            {' '}
            <b>{date(file.modified)}</b>
          </span>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   GAME CENTER
   ========================================================= */

function Countdown({onDone}){

  const [n,setN]=useState(3);

  useEffect(()=>{

    if(n>0){
      SFX.tick();
      const t=setTimeout(()=>setN(v=>v-1),650);
      return ()=>clearTimeout(t);
    }else{
      SFX.go();
      const t=setTimeout(onDone,750);
      return ()=>clearTimeout(t);
    }

  },[n]);

  return createPortal(
    <div className="countdown-overlay">
      <div className={`countdown-num ${n<=0?'go':''}`} key={n}>
        {n>0?n:'GO!'}
      </div>
    </div>,
    document.body
  );
}


function GameCenter({game,setGame,settings}){

  const [full,setFull]=useState(false);
  const [phase,setPhase]=useState('menu'); // menu | countdown | playing
  const [gameOver,setGameOver]=useState(null);

  const [config,setConfig]=useState({
    ragdoll:{difficulty:'normal'},
    snake:{speed:'normal',boardSize:'medium',wrap:false},
    memory:{pairs:8}
  });

  const updateConfig=(id,patch)=>
    setConfig(c=>({...c,[id]:{...c[id],...patch}}));


  /* Soft ambient music while inside the Game Center — actually
     audible only if the user has Background Music enabled in
     Settings; this just runs the scheduler. */
  useEffect(()=>{
    musicStart();
    return ()=>musicStop();
  },[]);


  const enter=async()=>{

    try{

      const element=document.querySelector(
        '.games-page'
      );

      if(element?.requestFullscreen){

        await element.requestFullscreen();

        setFull(true);

      }else{

        setFull(true);

      }

    }catch(error){

      console.error(
        'Fullscreen error:',
        error
      );

      setFull(true);
    }
  };


  const exit=async()=>{

    try{

      if(document.fullscreenElement){
        await document.exitFullscreen();
      }

    }catch(error){

      console.error(
        'Exit fullscreen error:',
        error
      );
    }

    setFull(false);
  };


  useEffect(()=>{

    const handleFullscreen=()=>{

      if(!document.fullscreenElement){
        setFull(false);
      }

    };

    document.addEventListener(
      'fullscreenchange',
      handleFullscreen
    );

    return()=>{

      document.removeEventListener(
        'fullscreenchange',
        handleFullscreen
      );

    };

  },[]);


  useEffect(()=>{

    const key=e=>{

      if(
        e.key==='Escape' &&
        full
      ){
        exit();
      }

    };

    window.addEventListener(
      'keydown',
      key
    );

    return()=>window.removeEventListener(
      'keydown',
      key
    );

  },[full]);


  const games=[

    {
      id:'ragdoll',
      title:'Ragdoll Archer',
      emoji:'🏹',
      desc:'Aim, fire and knock down the moving ragdoll.',
      tag:'Physics'
    },

    {
      id:'snake',
      title:'Neon Snake',
      emoji:'🐍',
      desc:'Eat food, grow longer and beat your high score.',
      tag:'Arcade'
    },

    {
      id:'memory',
      title:'Memory Match',
      emoji:'🧠',
      desc:'Flip cards and find every matching pair.',
      tag:'Puzzle'
    }

  ];


  const active=
    games.find(
      x=>x.id===game
    )||games[0];


  const chooseGame=id=>{
    SFX.click();
    setPhase('menu');
    setGameOver(null);
    setGame(id);
  };


  const startPlay=()=>{
    SFX.click();
    setGameOver(null);
    setPhase('countdown');
  };


  const playAgain=()=>{
    SFX.click();
    setGameOver(null);
    setPhase('countdown');
  };


  const endGame=()=>{
    setGameOver(null);
    setPhase('menu');
  };


  const cfg=config[active.id]||{};


  return (

    <div
      className={
        `games-page ${
          full
            ?'game-fullscreen'
            :''
        }`
      }
    >

      {full&&
        <button
          type="button"
          className="game-exit-btn"
          onClick={async()=>{
            try{
              if(document.fullscreenElement){
                await document.exitFullscreen();
              }
            }catch(e){}
            setFull(false);
          }}
        >
          ✕ Exit
        </button>
      }

      <div className="games-head">

        <div>

          <div className="eyebrow">
            SMARTSCAN X FUN ZONE
          </div>

          <h2>
            🎮 {active.title}
          </h2>

          {!full&&
            <p>
              Quick offline games.
              No account, no internet
              and no impact on your file scans.
            </p>
          }

        </div>


        {!full&&
          <button
            className="full-btn"
            onClick={enter}
          >
            <Maximize2 size={15}/>
            Full Screen
          </button>
        }

      </div>


      {phase==='menu'&&!full&&
        <div className="game-picker">

          {games.map(g=>(
            <button
              key={g.id}
              className={
                game===g.id
                  ?'chosen'
                  :''
              }
              onClick={()=>
                chooseGame(g.id)
              }
            >

              <span className="game-emoji">
                {g.emoji}
              </span>

              <span>

                <b>{g.title}</b>

                <small>
                  {g.desc}
                </small>

              </span>

              <em>{g.tag}</em>

            </button>
          ))}

        </div>
      }


      {phase==='menu'&&
        <div className="game-menu-grid">

          <div className="game-customize">

            <h3><Keyboard size={14}/> {active.title} — Customize</h3>
            <p className="muted">
              Tune this game to your liking, then hit Play.
              Each game keeps its own settings.
            </p>

            {active.id==='snake'&&<>

              <div className="gc-row">
                <div>
                  <b>Speed</b>
                  <small>How fast the snake moves.</small>
                </div>
                <div className="gc-pillgroup">
                  {['slow','normal','fast'].map(v=>(
                    <button
                      key={v}
                      className={cfg.speed===v?'sel':''}
                      onClick={()=>updateConfig('snake',{speed:v})}
                    >
                      {v[0].toUpperCase()+v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gc-row">
                <div>
                  <b>Board size</b>
                  <small>Smaller boards are quicker to fill up.</small>
                </div>
                <div className="gc-pillgroup">
                  {['small','medium','large'].map(v=>(
                    <button
                      key={v}
                      className={cfg.boardSize===v?'sel':''}
                      onClick={()=>updateConfig('snake',{boardSize:v})}
                    >
                      {v[0].toUpperCase()+v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gc-row">
                <div>
                  <b>Wrap around walls</b>
                  <small>Pass through the edge instead of dying.</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!!cfg.wrap}
                    onChange={e=>updateConfig('snake',{wrap:e.target.checked})}
                  />
                  <span/>
                </label>
              </div>

            </>}

            {active.id==='memory'&&<>

              <div className="gc-row">
                <div>
                  <b>Difficulty</b>
                  <small>More pairs means a bigger board and more moves.</small>
                </div>
                <div className="gc-pillgroup">
                  {[
                    {v:6,label:'Easy'},
                    {v:8,label:'Normal'},
                    {v:12,label:'Hard'}
                  ].map(o=>(
                    <button
                      key={o.v}
                      className={cfg.pairs===o.v?'sel':''}
                      onClick={()=>updateConfig('memory',{pairs:o.v})}
                    >
                      {o.label} ({o.v} pairs)
                    </button>
                  ))}
                </div>
              </div>

            </>}

            {active.id==='ragdoll'&&<>

              <div className="gc-row">
                <div>
                  <b>Difficulty</b>
                  <small>Harder difficulty means fewer arrows and a faster target.</small>
                </div>
                <div className="gc-pillgroup">
                  {[
                    {v:'easy',label:'Easy'},
                    {v:'normal',label:'Normal'},
                    {v:'hard',label:'Hard'}
                  ].map(o=>(
                    <button
                      key={o.v}
                      className={cfg.difficulty===o.v?'sel':''}
                      onClick={()=>updateConfig('ragdoll',{difficulty:o.v})}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

            </>}

            <div className="game-play-cta">
              <button className="game-play-btn" onClick={startPlay}>
                <Play size={18}/> Play {active.title}
              </button>
            </div>

          </div>

        </div>
      }


      {phase==='countdown'&&
        <Countdown onDone={()=>setPhase('playing')}/>
      }


      {phase==='playing'&&
        <div className="game-active-wrap">

          <button className="game-end-btn" onClick={endGame}>
            <Square size={13}/> End Game
          </button>

          <div className="active-game">

            {
              active.id==='snake'
                ?<SnakeGame config={cfg} onGameOver={setGameOver}/>
                :active.id==='memory'
                  ?<MemoryMatch config={cfg} onGameOver={setGameOver}/>
                  :<RagdollArcher config={cfg} onGameOver={setGameOver}/>
            }

          </div>

          {gameOver&&
            <div className="gameover-overlay">

              <div className="gameover-card">

                <Trophy size={34}/>

                <h3>{gameOver.label||'Game Over'}</h3>

                <p>
                  Score: <b>{gameOver.score}</b>
                </p>

                <div className="gameover-actions">

                  <button className="game-play-btn" onClick={playAgain}>
                    <Play size={16}/> Play Again
                  </button>

                  <button className="gameover-end-btn" onClick={endGame}>
                    <Square size={14}/> End
                  </button>

                </div>

              </div>

            </div>
          }

        </div>
      }

    </div>
  );
}


/* =========================================================
   SNAKE
   ========================================================= */

function SnakeGame({config,onGameOver}={}){

  const speedMs=
    config?.speed==='slow'?180
      :config?.speed==='fast'?85
        :125;

  const board=
    config?.boardSize==='small'?14
      :config?.boardSize==='large'?22
        :18;

  const wrap=!!config?.wrap;
  const mid0=Math.floor(board/2);

  const [
    snake,
    setSnake
  ]=useState([
    [mid0,mid0],
    [mid0-1,mid0],
    [mid0-2,mid0]
  ]);

  const [
    food,
    setFood
  ]=useState([Math.min(board-1,mid0+6),mid0]);

  const [
    dir,
    setDir
  ]=useState([1,0]);

  const [
    score,
    setScore
  ]=useState(0);

  const [
    running,
    setRunning
  ]=useState(true);


  const spawn=()=>
    [
      Math.floor(
        Math.random()*board
      ),
      Math.floor(
        Math.random()*board
      )
    ];


  useEffect(()=>{

    const key=e=>{

      const k=
        e.key.toLowerCase();

      const d=
        k==='arrowup'||k==='w'
          ?[0,-1]
          :k==='arrowdown'||k==='s'
            ?[0,1]
            :k==='arrowleft'||k==='a'
              ?[-1,0]
              :k==='arrowright'||k==='d'
                ?[1,0]
                :null;

      if(
        d &&
        !(d[0]===-dir[0] &&
          d[1]===-dir[1])
      ){
        setDir(d);
      }

    };


    window.addEventListener(
      'keydown',
      key
    );

    return()=>window.removeEventListener(
      'keydown',
      key
    );

  },[dir]);


  useEffect(()=>{

    if(!running)return;

    const t=setInterval(()=>{

      setSnake(old=>{

        const head=[
          old[0][0]+dir[0],
          old[0][1]+dir[1]
        ];

        if(wrap){
          head[0]=(head[0]+board)%board;
          head[1]=(head[1]+board)%board;
        }


        if(
          (!wrap && (
            head[0]<0||
            head[1]<0||
            head[0]>=board||
            head[1]>=board
          ))||
          old.some(
            p=>
              p[0]===head[0] &&
              p[1]===head[1]
          )
        ){

          setRunning(false);
          SFX.gameover();

          return old;
        }


        const eat=
          head[0]===food[0] &&
          head[1]===food[1];


        if(eat){

          setScore(
            s=>s+10
          );

          SFX.point();

          let f=spawn();

          while(
            old.some(
              p=>
                p[0]===f[0] &&
                p[1]===f[1]
            )
          ){
            f=spawn();
          }

          setFood(f);

          return [
            head,
            ...old
          ];
        }


        return [
          head,
          ...old.slice(0,-1)
        ];

      });

    },speedMs);


    return()=>clearInterval(t);

  },[
    running,
    dir,
    food,
    speedMs,
    board,
    wrap
  ]);


  useEffect(()=>{
    if(!running){
      onGameOver?.({score,label:'Game Over'});
    }
  },[running]);


  const reset=()=>{

    const mid=Math.floor(board/2);

    setSnake([
      [mid,mid],
      [mid-1,mid],
      [mid-2,mid]
    ]);

    setFood([Math.min(board-1,mid+6),mid]);

    setDir([1,0]);

    setScore(0);

    setRunning(true);
  };


  return (

    <section className="game-panel arcade">

      <div className="game-top">

        <div>

          <h2>
            🐍 Neon Snake
          </h2>

          <p>
            Use Arrow Keys or WASD.
            Eat the dots and don't hit yourself.
          </p>

        </div>


        <div className="game-stats">

          <span>
            Score <b>{score}</b>
          </span>

          <button onClick={reset}>
            <RotateCcw size={14}/>
            {running
              ?'Reset'
              :'Play Again'}
          </button>

        </div>

      </div>


      <div
        className="snake-board"
        style={{
          gridTemplateColumns:
            `repeat(${board},1fr)`
        }}
      >

        {Array.from(
          {length:board*board},
          (_,i)=>{

            const x=
              i%board;

            const y=
              Math.floor(i/board);

            const isHead=
              snake[0]?.[0]===x &&
              snake[0]?.[1]===y;

            const isBody=
              snake.some(
                p=>
                  p[0]===x &&
                  p[1]===y
              );


            return (

              <div
                key={i}
                className={
                  `cell ${
                    isBody
                      ?'snake-cell'
                      :''
                  } ${
                    isHead
                      ?'snake-head'
                      :''
                  } ${
                    food[0]===x &&
                    food[1]===y
                      ?'food-cell'
                      :''
                  }`
                }
              />

            );

          }
        )}

      </div>


      <div className="game-message">
        {
          running
            ?'Collect as many as possible!'
            :'Game over — press Play Again.'
        }
      </div>

    </section>
  );
}


/* =========================================================
   MEMORY MATCH
   ========================================================= */

function MemoryMatch({config,onGameOver}={}){

  const allValues=[
    '🍎','🚀','🎯','⭐','🐱','🍕','⚽','🌈',
    '🎸','🍩','🐢','🎈'
  ];

  const pairs=config?.pairs||8;
  const values=allValues.slice(0,pairs);


  const shuffle=()=>[
    ...values,
    ...values
  ]
    .sort(
      ()=>Math.random()-.5
    )
    .map(
      (v,i)=>({
        id:i,
        v,
        open:false,
        done:false
      })
    );


  const [
    cards,
    setCards
  ]=useState(shuffle);


  const [
    pick,
    setPick
  ]=useState([]);


  const [
    moves,
    setMoves
  ]=useState(0);


  useEffect(()=>{
    if(cards.length&&cards.every(c=>c.done)){
      onGameOver?.({
        score:moves,
        label:'You Win!'
      });
    }
  },[cards]);


  useEffect(()=>{

    if(pick.length!==2)return;

    const [a,b]=pick;


    if(cards[a].v===cards[b].v){

      const willWin=
        cards.filter(x=>!x.done).length===2;

      setCards(
        c=>
          c.map(
            (x,i)=>
              pick.includes(i)
                ?{
                    ...x,
                    done:true
                  }
                :x
          )
      );

      if(willWin){
        SFX.win();
      }else{
        SFX.match();
      }

      setPick([]);

    }else{

      SFX.miss();

      const t=setTimeout(()=>{

        setCards(
          c=>
            c.map(
              (x,i)=>
                pick.includes(i)
                  ?{
                      ...x,
                      open:false
                    }
                  :x
            )
        );

        setPick([]);

      },650);

      return()=>clearTimeout(t);
    }

  },[pick]);


  const click=i=>{

    if(
      pick.length===2||
      cards[i].open||
      cards[i].done
    )return;

    SFX.click();

    setCards(
      c=>
        c.map(
          (x,n)=>
            n===i
              ?{
                  ...x,
                  open:true
                }
              :x
        )
    );

    setPick(
      p=>[...p,i]
    );

    setMoves(
      m=>m+1
    );
  };


  const reset=()=>{

    setCards(shuffle());

    setPick([]);

    setMoves(0);
  };


  const won=
    cards.every(
      c=>c.done
    );


  return (

    <section className="game-panel arcade">

      <div className="game-top">

        <div>

          <h2>
            🧠 Memory Match
          </h2>

          <p>
            Find all eight pairs
            in as few moves as possible.
          </p>

        </div>


        <div className="game-stats">

          <span>
            Moves <b>{moves}</b>
          </span>

          <button onClick={reset}>
            <RotateCcw size={14}/>
            New Game
          </button>

        </div>

      </div>


      <div className="memory-grid">

        {cards.map((c,i)=>(

          <button
            key={c.id}
            className={
              `memory-card ${
                c.open||c.done
                  ?'revealed'
                  :''
              }`
            }
            onClick={()=>
              click(i)
            }
          >

            <span>
              {
                c.open||c.done
                  ?c.v
                  :'?'
              }
            </span>

          </button>

        ))}

      </div>


      <div className="game-message">

        {
          won
            ?'🏆 Perfect! You found every pair.'
            :'Match two cards with the same symbol.'
        }

      </div>

    </section>
  );
}


/* =========================================================
   RAGDOLL ARCHER
   ========================================================= */

function RagdollArcher({config,onGameOver}={}){

  const difficulty=config?.difficulty||'normal';

  const startShots=
    difficulty==='easy'?8
      :difficulty==='hard'?3
        :5;

  const speedMul=
    difficulty==='easy'?0.75
      :difficulty==='hard'?1.45
        :1;

  const canvasRef=
    useRef(null);


  const [
    score,
    setScore
  ]=useState(0);

  const scoreRef=useRef(0);
  useEffect(()=>{scoreRef.current=score;},[score]);


  const [
    shots,
    setShots
  ]=useState(startShots);


  const [
    message,
    setMessage
  ]=useState(
    'Drag from the bow and release to fire.'
  );


  const state=
    useRef({
      aim:null,
      arrow:null,
      target:{
        x:415,
        y:190,
        vx:0,
        vy:0,
        hit:false
      },
      last:0
    });


  useEffect(()=>{

    const c=
      canvasRef.current;

    const ctx=
      c.getContext('2d');

    let raf=0;


    const loop=t=>{

      const s=
        state.current;


      const dt=
        Math.min(
          .032,
          (t-s.last)/1000||.016
        );


      s.last=t;


      if(s.arrow){

        s.arrow.vy+=520*dt;

        s.arrow.x+=
          s.arrow.vx*dt;

        s.arrow.y+=
          s.arrow.vy*dt;


        const tar0=
          s.target;


        if(
          Math.hypot(
            s.arrow.x-tar0.x,
            s.arrow.y-(tar0.y-38)
          )<28
        ){

          setScore(
            v=>v+100
          );

          setMessage(
            '🎯 Bullseye! +100'
          );

          SFX.hit();

          tar0.vx=65*speedMul;
          tar0.vy=-210;

          s.arrow=null;

        }else if(
          s.arrow.x>560||
          s.arrow.y>340||
          s.arrow.x<0
        ){

          s.arrow=null;

          setMessage(
            'Miss! Try again.'
          );

          SFX.miss();
        }

      }


      const tar=
        s.target;


      tar.vy+=430*speedMul*dt;

      tar.y+=
        tar.vy*dt;

      tar.vx*=.992;

      tar.x+=
        tar.vx*speedMul*dt;


      if(tar.y>205){

        tar.y=205;

        tar.vy*=-.28;
      }


      if(
        tar.x<365||
        tar.x>475
      ){
        tar.vx*=-1;
      }


      ctx.clearRect(
        0,
        0,
        560,
        330
      );


      const g=
        ctx.createLinearGradient(
          0,
          0,
          0,
          330
        );

      g.addColorStop(
        0,
        '#17244a'
      );

      g.addColorStop(
        1,
        '#081022'
      );

      ctx.fillStyle=g;

      ctx.fillRect(
        0,
        0,
        560,
        330
      );


      ctx.fillStyle='#243d2c';

      ctx.fillRect(
        0,
        250,
        560,
        80
      );


      ctx.strokeStyle='#334d82';

      ctx.lineWidth=2;

      ctx.beginPath();

      ctx.moveTo(
        0,
        250
      );

      ctx.lineTo(
        560,
        250
      );

      ctx.stroke();


      ctx.strokeStyle='#9a7cff';

      ctx.lineWidth=5;

      ctx.beginPath();

      ctx.moveTo(
        72,
        226
      );

      ctx.lineTo(
        72,
        118
      );

      ctx.stroke();


      ctx.beginPath();

      ctx.arc(
        72,
        170,
        57,
        -1.25,
        1.25
      );

      ctx.stroke();


      ctx.strokeStyle='#e8edf9';

      ctx.lineWidth=2;

      ctx.beginPath();

      ctx.moveTo(
        72,
        113
      );

      ctx.lineTo(
        72,
        227
      );

      ctx.stroke();


      ctx.fillStyle='#ff6d6d';

      ctx.beginPath();

      ctx.arc(
        tar.x,
        tar.y-38,
        19,
        0,
        Math.PI*2
      );

      ctx.fill();


      ctx.strokeStyle='#f5d9c5';

      ctx.lineWidth=6;

      ctx.beginPath();

      ctx.moveTo(
        tar.x,
        tar.y-18
      );

      ctx.lineTo(
        tar.x,
        tar.y+35
      );

      ctx.moveTo(
        tar.x,
        tar.y
      );

      ctx.lineTo(
        tar.x-28,
        tar.y+18
      );

      ctx.moveTo(
        tar.x,
        tar.y
      );

      ctx.lineTo(
        tar.x+28,
        tar.y+18
      );

      ctx.moveTo(
        tar.x,
        tar.y+35
      );

      ctx.lineTo(
        tar.x-22,
        tar.y+70
      );

      ctx.moveTo(
        tar.x,
        tar.y+35
      );

      ctx.lineTo(
        tar.x+22,
        tar.y+70
      );

      ctx.stroke();


      if(s.arrow){

        ctx.strokeStyle='#f4cf62';

        ctx.lineWidth=4;

        ctx.beginPath();

        ctx.moveTo(
          s.arrow.x,
          s.arrow.y
        );

        ctx.lineTo(
          s.arrow.x-
            s.arrow.vx*.035,
          s.arrow.y-
            s.arrow.vy*.035
        );

        ctx.stroke();
      }


      if(s.aim){

        ctx.strokeStyle='#ffffff99';

        ctx.setLineDash([
          6,
          6
        ]);

        ctx.beginPath();

        ctx.moveTo(
          72,
          170
        );

        ctx.lineTo(
          s.aim.x,
          s.aim.y
        );

        ctx.stroke();

        ctx.setLineDash([]);
      }


      raf=
        requestAnimationFrame(loop);
    };


    raf=
      requestAnimationFrame(loop);


    return()=>cancelAnimationFrame(
      raf
    );

  },[]);


  const fire=e=>{

    if(
      shots<=0||
      state.current.arrow
    )return;


    const r=
      canvasRef.current
        .getBoundingClientRect();


    const x=
      e.clientX-r.left;

    const y=
      e.clientY-r.top;


    const dx=
      72-x;

    const dy=
      170-y;


    const power=
      Math.min(
        650,
        Math.hypot(dx,dy)*5
      );


    state.current.arrow={
      x:72,
      y:170,
      vx:
        dx/
        Math.max(
          1,
          Math.hypot(dx,dy)
        )*
        power,
      vy:
        dy/
        Math.max(
          1,
          Math.hypot(dx,dy)
        )*
        power
    };


    SFX.click();

    setShots(
      v=>{
        const next=v-1;
        if(next<=0){
          setTimeout(()=>{
            SFX.gameover();
            onGameOver?.({
              score:scoreRef.current,
              label:'Out of Arrows'
            });
          },1300);
        }
        return next;
      }
    );


    setMessage(
      'Arrow released!'
    );
  };


  const reset=()=>{

    state.current.arrow=null;

    state.current.target={
      x:415,
      y:190,
      vx:0,
      vy:0,
      hit:false
    };

    setShots(startShots);

    setScore(0);

    setMessage(
      'Drag from the bow and release to fire.'
    );
  };


  return (

    <section className="game-panel">

      <div className="game-top">

        <div>

          <h2>
            🏹 Ragdoll Archer
          </h2>

          <p>
            Hit the moving ragdoll
            before you run out of arrows.
          </p>

        </div>


        <div className="game-stats">

          <span>
            Score <b>{score}</b>
          </span>

          <span>
            Arrows <b>{shots}</b>
          </span>

          <button onClick={reset}>
            <RotateCcw size={14}/>
            Reset
          </button>

        </div>

      </div>


      <div className="game-canvas-wrap">

        <canvas
          ref={canvasRef}
          width="560"
          height="330"

          onPointerMove={e=>{

            const r=
              e.currentTarget
                .getBoundingClientRect();

            state.current.aim={
              x:e.clientX-r.left,
              y:e.clientY-r.top
            };

          }}

          onPointerLeave={()=>
            state.current.aim=null
          }

          onPointerUp={fire}

          onPointerDown={e=>{

            const r=
              e.currentTarget
                .getBoundingClientRect();

            state.current.aim={
              x:e.clientX-r.left,
              y:e.clientY-r.top
            };

          }}
        />

      </div>


      <div className="game-message">
        {message}
      </div>

    </section>
  );
}


/* =========================================================
   ROOT + GUEST MODE FIX
   ========================================================= */
}

function Root(){

  const [
    status,
    setStatus
  ]=useState('checking');

  const [
    user,
    setUser
  ]=useState(null);


  useEffect(()=>{

    (async()=>{

      try{

        const s=
          await window.smartscan.getSession();


        if(s?.ok){

          setUser(s.user);

          setStatus('in');

        }else{

          setStatus('guest');

        }

      }catch(error){

        console.error(
          'Session check failed:',
          error
        );

        setStatus('guest');
      }

    })();

  },[]);


  const onLogin=u=>{

    setUser(u);

    setStatus('in');
  };


  /* =======================================================
     GUEST MODE
     ======================================================= */

  const onGuest=()=>{

    const guestUser={
      id:'guest-local',
      username:'guest',
      displayName:'Guest',
      guest:true
    };


    setUser(guestUser);

    setStatus('in');
  };


  const onLogout=async()=>{

    try{

      await window.smartscan.logout();

    }catch(error){

      console.error(
        'Logout error:',
        error
      );
    }


    setUser(null);

    setStatus('guest');
  };


  if(status==='checking'){

    return (

      <div className="boot-screen">

        <ScanSearch
          className="spin"
          size={30}
        />

        <span>
          Loading SmartScan X…
        </span>

      </div>

    );
  }


  /* =======================================================
     LOGIN + GUEST SCREEN
     ======================================================= */

  if(status==='guest'){

    return (

      <div className="auth-shell">

        <Auth
          onLogin={onLogin}
        />


        <button
          type="button"
          className="guest-mode-btn"
          onClick={onGuest}
        >

          <UserCircle2
            size={20}
          />

          <span>
            Continue as Guest

            <small>
              No account required
            </small>
          </span>

        </button>

      </div>

    );
  }


  return (
    <App
      user={user}
      onLogout={onLogout}
    />
  );
}


createRoot(
  document.getElementById('root')
).render(
  <Root/>
);
