import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Asterisk, ArrowDown, ArrowRight, Check, ChevronRight, Clock3, Heart, History, Info, Moon, RotateCcw, Settings2, ShieldCheck, Shuffle, Sparkles, Users, Volume2, VolumeX, X, Zap } from 'lucide-react'
import { Mars, Venus } from './components/GenderIcons'
import { type Gender, type Question, type QuestionType } from './data/questions'
import { drawQuestion, eligibleQuestions, type DrawMode } from './lib/game'
import { loadQuestionBank } from './lib/database'

type Page = 'game' | 'library' | 'guide'
type RecordItem = { id: string; at: number; gender: Gender }
type SavedState = { seen: string[]; favorites: string[]; history: RecordItem[]; noRepeat: boolean; sound: boolean }
const defaultState: SavedState = { seen: [], favorites: [], history: [], noRepeat: true, sound: false }
function readState(): SavedState {
  try {
    const value = JSON.parse(localStorage.getItem('after-hours-state') || 'null')
    if (!value || !Array.isArray(value.favorites) || !Array.isArray(value.history)) return defaultState
    return {
      seen: Array.isArray(value.seen) ? value.seen.filter((id: unknown) => typeof id === 'string') : [],
      favorites: value.favorites.filter((id: unknown) => typeof id === 'string'),
      history: value.history.filter((item: RecordItem) => item && typeof item.id === 'string' && Number.isFinite(item.at) && ['male', 'female'].includes(item.gender)),
      noRepeat: value.noRepeat !== false, sound: value.sound === true,
    }
  } catch { return defaultState }
}
const modes: { id: DrawMode; title: string; description: string; icon: typeof Heart; count: string }[] = [
  { id: 'random', title: '随机惊喜', description: '把选择交给今晚的运气', icon: Shuffle, count: '500' },
  { id: 'truth', title: '真心话', description: '一些平时没说出口的话', icon: Heart, count: '200' },
  { id: 'dare', title: '大冒险', description: '给今晚加一点心跳', icon: Zap, count: '300' },
]
function BrandMark({ small = false }: { small?: boolean }) {
  return <svg width={small ? 26 : 39} height={small ? 26 : 39} viewBox="0 0 44 44" fill="none" aria-hidden="true"><rect x="7" y="7" width="21" height="29" rx="4" transform="rotate(-14 7 7)" stroke="currentColor" strokeWidth="1.7"/><rect x="20" y="6" width="21" height="29" rx="4" transform="rotate(12 20 6)" fill="currentColor"/><path d="m28 14 5 6-5 6-5-6z" fill="#1b1c1d"/></svg>
}
function CardArtwork() {
  return <div className="card-artwork" aria-hidden="true">
    <div className="orbital orbital-one"/><div className="orbital orbital-two"/>
    <span className="floating-star star-one">✦</span><span className="floating-star star-two">✧</span><span className="floating-dot"/>
    <div className="playing-card back-card"><span className="card-corner">A<Heart size={12}/></span><Heart className="card-symbol" size={61} strokeWidth={1.1}/><span className="card-label">SAY IT.</span><span className="card-corner bottom-corner">A<Heart size={12}/></span></div>
    <div className="playing-card front-card"><span className="card-corner">A<Zap size={12}/></span><Zap className="card-symbol" size={65} strokeWidth={1.1}/><span className="card-label">DO IT.</span><span className="card-corner bottom-corner">A<Zap size={12}/></span></div>
  </div>
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    close.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const elements = container.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]')
        if (!elements?.length) return
        const first = elements[0]; const last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus() }
  }, [onClose])
  return <div className="modal-backdrop" onClick={onClose}><div ref={container} className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}><div className="modal-heading"><h2>{title}</h2><button ref={close} className="icon-button" onClick={onClose} aria-label="关闭弹窗"><X size={20}/></button></div>{children}</div></div>
}
export default function App() {
  const [page, setPage] = useState<Page>('game')
  const [bank, setBank] = useState<Question[]>([])
  const [gender, setGender] = useState<Gender | null>(null)
  const [mode, setMode] = useState<DrawMode>('random')
  const [current, setCurrent] = useState<Question | null>(null)
  const [saved, setSaved] = useState<SavedState>(readState)
  const [drawing, setDrawing] = useState(false)
  const [toast, setToast] = useState('')
  const [dialog, setDialog] = useState<'settings' | 'history' | null>(null)
  const [query, setQuery] = useState('')
  const [libraryType, setLibraryType] = useState<'all' | QuestionType>('all')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [libraryLimit, setLibraryLimit] = useState(24)
  const [needsGender, setNeedsGender] = useState(false)
  const drawTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const genderPanel = useRef<HTMLDivElement>(null)
  useEffect(() => { void loadQuestionBank().then(setBank) }, [])
  useEffect(() => { try { localStorage.setItem('after-hours-state', JSON.stringify(saved)) } catch { /* Play without persistence when storage is unavailable. */ } }, [saved])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer) }, [toast])
  useEffect(() => () => { if (drawTimer.current) clearTimeout(drawTimer.current) }, [])
  useEffect(() => { setLibraryLimit(24) }, [query, libraryType, onlyFavorites])
  const favorite = (id: string) => setSaved(prev => ({ ...prev, favorites: prev.favorites.includes(id) ? prev.favorites.filter(value => value !== id) : [...prev.favorites, id] }))
  const chooseGender = (value: Gender) => { setGender(value); setNeedsGender(false); setCurrent(null) }
  const chooseMode = (value: DrawMode) => { setMode(value); setCurrent(null) }
  const playSound = () => {
    if (!saved.sound) return
    try {
      const context = new AudioContext()
      const oscillator = context.createOscillator(); const gain = context.createGain()
      oscillator.connect(gain); gain.connect(context.destination)
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(660, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.18)
      gain.gain.setValueAtTime(0.065, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22)
      oscillator.start(); oscillator.stop(context.currentTime + 0.22); oscillator.onended = () => { void context.close() }
    } catch { /* Sound is optional. */ }
  }
  const draw = () => {
    if (drawing || !bank.length) return
    if (!gender) { setNeedsGender(true); setToast('先选一位执行者，今晚就从你开始。'); genderPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    setDrawing(true)
    drawTimer.current = setTimeout(() => {
      try {
        const result = drawQuestion(bank, gender, mode, saved.noRepeat ? saved.seen : [])
        setCurrent(result.question)
        const recycledPool = result.recycled ? new Set(eligibleQuestions(bank, gender, mode).map(item => item.id)) : new Set<string>()
        setSaved(prev => ({
          ...prev,
          seen: [...new Set([...prev.seen.filter(id => !recycledPool.has(id)), result.question.id])],
          history: [{ id: result.question.id, at: Date.now(), gender }, ...prev.history].slice(0, 500),
        }))
        if (result.recycled) setToast('这个题池已经抽完，新一轮开始啦。')
        playSound()
      } catch { setToast('题库暂未准备好，请刷新后重试。') }
      setDrawing(false)
    }, 480)
  }
  const nextPlayer = () => { if (drawing) return; setCurrent(null); setGender(null); setNeedsGender(false); genderPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  const selectedMode = modes.find(item => item.id === mode)!
  const poolSize = gender ? eligibleQuestions(bank, gender, mode).length : bank.length
  const filtered = bank.filter(question => (libraryType === 'all' || question.type === libraryType) && (!onlyFavorites || saved.favorites.includes(question.id)) && (!query || question.text.includes(query) || question.id.toLowerCase().includes(query.toLowerCase())))
  const closeDialog = useRef(() => setDialog(null)).current
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <a href="#" className="brand" onClick={event => { event.preventDefault(); setPage('game') }} aria-label="微醺时刻首页"><span className="brand-icon"><BrandMark/></span><span><strong>微醺时刻<span className="brand-dot">.</span></strong><small>AFTER HOURS</small></span></a>
      <nav className="main-nav" aria-label="主导航">{([{ id: 'game', title: '开始游戏' }, { id: 'library', title: '探索题库' }, { id: 'guide', title: '怎么玩' }] as const).map(item => <button key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} aria-current={page === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}>{item.title}{page === item.id && <span className="nav-dot"/>}</button>)}</nav>
      <div className="header-actions"><span className="night-status"><span/>深夜营业中<Moon size={13}/></span><div className="header-divider"/><button className="icon-button" aria-label="游戏设置" onClick={() => setDialog('settings')}><Settings2 size={20}/></button></div>
    </div></header>
    <main>
      {page === 'game' && <>
        <section className="hero"><div><div className="eyebrow"><span/>LESS SCROLLING, MORE CONNECTING</div><h1>把真心，留给<span>今晚。</span><span className="heading-spark" aria-hidden="true"><Asterisk size={33} strokeWidth={1.4}/></span></h1><p>放下手机里的世界，和眼前的人，制造一点新故事。</p></div><div className="hero-social"><div className="people-stack"><span>Y</span><span>J</span><span>M</span><span>+你</span></div><div><strong>好朋友，好时光。</strong><span>2 人就能开局 · 人越多越好玩</span></div></div></section>
        <div className="game-layout">
          <aside className="setup-panel">
            <div className={`gender-section ${needsGender ? 'needs-attention' : ''}`} ref={genderPanel}><div className="section-heading"><span className="step-number">01</span><h2>谁是这一轮的主角？</h2></div><p className="section-description">选择执行者，匹配你的专属题目</p>
              <div className="gender-options" role="group" aria-label="选择执行者"><button disabled={drawing} className={`gender-option ${gender === 'male' ? 'selected' : ''}`} aria-pressed={gender === 'male'} onClick={() => chooseGender('male')}><Mars size={25} strokeWidth={1.5}/><span>男生</span>{gender === 'male' && <span className="selected-check"><Check size={10}/></span>}</button><button disabled={drawing} className={`gender-option ${gender === 'female' ? 'selected' : ''}`} aria-pressed={gender === 'female'} onClick={() => chooseGender('female')}><Venus size={25} strokeWidth={1.5}/><span>女生</span>{gender === 'female' && <span className="selected-check"><Check size={10}/></span>}</button></div>
            </div>
            <div className="mode-section"><div className="section-heading"><span className="step-number">02</span><h2>今晚，想怎么玩？</h2></div><p className="section-description">选一种心情，也可以全部交给随机</p><div className="mode-options" role="group" aria-label="选择题目类型">{modes.map(item => { const Icon = item.icon; return <button disabled={drawing} key={item.id} className={`mode-option ${mode === item.id ? 'selected' : ''}`} aria-label={item.title} aria-pressed={mode === item.id} onClick={() => chooseMode(item.id)}><span className={`mode-icon ${item.id}`}><Icon size={19} strokeWidth={1.7}/></span><span className="mode-text"><strong>{item.title}</strong><small>{item.description}</small></span><span className="mode-count">{item.count}<ChevronRight size={13}/></span></button> })}</div></div>
            <div className="setup-note"><ShieldCheck size={16}/><span>尽兴就好，不必逞强。随时可以跳过。</span></div>
          </aside>
          <section className={`play-panel ${current ? 'has-question' : ''} ${drawing ? 'is-drawing' : ''}`} aria-label="随机抽题">
            <div className="play-header"><span className="live-label"><span/>{current ? `ROUND ${String(saved.history.length).padStart(2, '0')}` : 'LET THE NIGHT BEGIN'}</span><span className="mode-badge"><selectedMode.icon size={12}/>{selectedMode.title}</span></div>
            <div className="question-stage" aria-live="polite" aria-busy={drawing}>
              {current && !drawing ? <div className="question-content" key={current.id}><span className={`question-type ${current.type}`} >{current.type === 'truth' ? <Heart size={18}/> : <Zap size={18}/>} {current.type === 'truth' ? '真心话' : '大冒险'}<span> / {current.level}</span></span><h2>{current.text}</h2><div className="question-meta"><span>{gender === 'male' ? <Mars size={14}/> : <Venus size={14}/>}{gender === 'male' ? '男生' : '女生'}执行</span><span className="meta-dot"/><span>#{current.id}</span></div></div> : <div className="welcome-content"><CardArtwork/><h2>{drawing ? '今晚的惊喜，正在靠近…' : '有些故事，从这一题开始。'}</h2><p>{drawing ? '把一点勇气，交给未知' : '一点真心，一点冒险。准备好让气氛升温了吗？'}</p></div>}
            </div>
            <div className="draw-controls"><button className="draw-button" disabled={drawing || !bank.length} onClick={draw}><Shuffle size={19} className={drawing ? 'shuffle-animation' : ''}/><span>{drawing ? '正在抽取…' : current ? '再抽一道' : '抽取今晚的第一题'}</span><ArrowRight size={19}/></button>{current ? <div className="revealed-actions"><button disabled={drawing} onClick={() => favorite(current.id)} className={saved.favorites.includes(current.id) ? 'is-favorite' : ''}><Heart size={15} fill={saved.favorites.includes(current.id) ? 'currentColor' : 'none'}/>{saved.favorites.includes(current.id) ? '已收藏' : '收藏这道题'}</button><span/><button disabled={drawing} onClick={nextPlayer}>换下一位<ArrowRight size={15}/></button></div> : <p className="draw-caption"><Sparkles size={12}/> {bank.length ? '500 道精选题目，每一题都是新的可能' : '正在准备今晚的题库…'}</p>}</div>
            <div className="play-footer"><span><span className="status-dot"/>{saved.noRepeat ? '本轮不重复' : '自由随机'}<span className="footer-separator">/</span>{gender ? `${poolSize} 道适配题目` : '先选择左侧执行者'}</span><button onClick={() => setDialog('history')}><History size={14}/>本局记录<span className="history-count">{saved.history.length}</span></button></div>
          </section>
        </div>
        <section className="bottom-section"><div className="bottom-heading"><span>THE ONLY RULE? HAVE A GOOD TIME.</span><span>今晚没有标准答案<ArrowDown size={13}/></span></div><div className="feature-grid"><div className="feature-item"><div className="feature-icon"><Heart size={21} strokeWidth={1.4}/></div><div><h3>200 次，走近彼此</h3><p>从轻松破冰到认真走心，总有一句想听你说。</p></div><span className="feature-number">01</span></div><div className="feature-item"><div className="feature-icon"><Zap size={21} strokeWidth={1.4}/></div><div><h3>300 次，打破日常</h3><p>为平凡的聚会，加一点意想不到的名场面。</p></div><span className="feature-number">02</span></div><div className="feature-item"><div className="feature-icon"><Users size={21} strokeWidth={1.4}/></div><div><h3>让在场的每个人，都在场</h3><p>不用下载，不必注册。把时间留给身边的人。</p></div><span className="feature-number">03</span></div></div></section>
      </>}
      {page === 'library' && <section className="library-page"><div className="eyebrow"><span/>A LITTLE SOMETHING FOR EVERYONE</div><div className="page-title"><div><h1>今晚的灵感库<span>。</span></h1><p>200 道真心话，300 道大冒险。先看看，心动的就收下。</p></div><span className="library-total">500<span>个故事的开场</span></span></div><div className="library-toolbar"><div className="library-tabs">{([{ id: 'all', label: '全部题目' }, { id: 'truth', label: '真心话' }, { id: 'dare', label: '大冒险' }] as const).map(item => <button key={item.id} aria-pressed={libraryType === item.id} className={libraryType === item.id ? 'active' : ''} onClick={() => setLibraryType(item.id)}>{item.label}</button>)}</div><div className="library-tools"><button className={`favorites-filter ${onlyFavorites ? 'active' : ''}`} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}><Heart size={15}/>我的收藏 {saved.favorites.length}</button><input type="search" placeholder="搜索题目或编号…" aria-label="搜索题库" value={query} onChange={event => setQuery(event.target.value)}/></div></div><p className="results-count">共 {filtered.length} 道题目{onlyFavorites && ' · 仅显示已收藏'}</p><div className="question-grid">{filtered.slice(0, libraryLimit).map(question => <article className="library-card" key={question.id}><div><span className={`question-type ${question.type}`}>{question.type === 'truth' ? <Heart size={14}/> : <Zap size={14}/>} {question.type === 'truth' ? '真心话' : '大冒险'}</span><button className={`icon-button ${saved.favorites.includes(question.id) ? 'is-favorite' : ''}`} aria-label={`${saved.favorites.includes(question.id) ? '取消收藏' : '收藏'} ${question.id}`} onClick={() => favorite(question.id)}><Heart size={17} fill={saved.favorites.includes(question.id) ? 'currentColor' : 'none'}/></button></div><p>{question.text}</p><footer><span>{question.gender === 'all' ? '所有人' : question.gender === 'male' ? '男生专属' : '女生专属'} · {question.level}</span><span>#{question.id}</span></footer></article>)}</div>{!filtered.length && <div className="empty-state"><Heart size={32}/><h3>{onlyFavorites ? '还没有收藏到合适的题目' : '没有找到这道题'}</h3><p>{onlyFavorites ? '点击题目上的爱心，把喜欢的留给下次聚会。' : '换个关键词，试着再找找。'}</p></div>}{libraryLimit < filtered.length && <button className="load-more" onClick={() => setLibraryLimit(prev => prev + 24)}>再看 24 道题<ArrowDown size={16}/></button>}</section>}
      {page === 'guide' && <section className="guide-page"><div className="eyebrow"><span/>GOOD NIGHTS START HERE</div><h1>很简单，开心就好<span>。</span></h1><p className="guide-intro">不用复杂的规则，把主场交给你们。</p><div className="guide-steps">{[{ title: '选一位今晚的主角', text: '围坐在一起，自由决定执行顺序。选择这一轮执行者的性别，题库会自动匹配适合的题目。', icon: Users }, { title: '决定用真心，还是勇气', text: '真心话让你说出平时没机会说的话，大冒险负责制造名场面。选不出来？试试「随机惊喜」。', icon: Shuffle }, { title: '抽一道题，让故事发生', text: '点击抽题，大声念出题目。完成后点击「换下一位」，把惊喜传下去。喜欢的题目，点爱心就能收藏。', icon: Sparkles }].map((step, i) => <div key={step.title}><span className="guide-step-number">0{i + 1}</span><step.icon size={27}/><h2>{step.title}</h2><p>{step.text}</p></div>)}</div><div className="comfort-note"><ShieldCheck size={26}/><div><h3>舒服的氛围，才是最好的氛围。</h3><p>任何题目都可以跳过；互动前先征得对方同意。不需要用喝酒来惩罚，更不用勉强自己。题目存在这台设备里，收藏与记录也只留在本地。</p></div></div><button className="draw-button guide-start" onClick={() => setPage('game')}>知道了，开局<ArrowRight size={18}/></button></section>}
    </main>
    <footer className="site-footer"><span><BrandMark small/>微醺时刻<span className="footer-dot">·</span>AFTER HOURS</span><p>真心有分寸，冒险有边界。<span>快乐，请尽兴。</span></p><span className="footer-end">MADE FOR REAL CONNECTIONS <span>↗</span></span></footer>
    {dialog === 'settings' && <Modal title="今晚的游戏设置" onClose={closeDialog}><p className="modal-description">按你们的节奏，定制这一晚。</p><div className="setting-row"><div><strong>本轮题目不重复</strong><p>题池抽完后，自动开启新一轮。</p></div><button className={`toggle ${saved.noRepeat ? 'on' : ''}`} role="switch" aria-checked={saved.noRepeat} aria-label="本轮题目不重复" onClick={() => setSaved(prev => ({ ...prev, noRepeat: !prev.noRepeat }))}><span/></button></div><div className="setting-row"><div><strong>{saved.sound ? <Volume2 size={16}/> : <VolumeX size={16}/>} 抽题提示音</strong><p>揭晓时，来一点小小的仪式感。</p></div><button className={`toggle ${saved.sound ? 'on' : ''}`} role="switch" aria-checked={saved.sound} aria-label="抽题提示音" onClick={() => setSaved(prev => ({ ...prev, sound: !prev.sound }))}><span/></button></div><div className="settings-info"><Info size={17}/><p>已内置 500 道题目。题库无需账号，收藏和记录仅保存在当前浏览器。</p></div><button className="secondary-button reset-button" onClick={() => { if (drawTimer.current) clearTimeout(drawTimer.current); setDrawing(false); setCurrent(null); setGender(null); setSaved(prev => ({ ...prev, seen: [], history: [] })); setDialog(null); setToast('新的一局开始了，收藏已为你保留。') }}><RotateCcw size={16}/>重开一局</button></Modal>}
    {dialog === 'history' && <Modal title="本局的故事" onClose={closeDialog}><p className="modal-description">已经抽过 {saved.history.length} 道题。好笑的、走心的，都在这里。</p><div className="history-list">{saved.history.length ? saved.history.map((record, index) => { const question = bank.find(item => item.id === record.id); return question ? <article key={`${record.at}-${index}`}><span className={`history-type ${question.type}`}>{question.type === 'truth' ? <Heart size={17}/> : <Zap size={17}/>}</span><div><span>{record.gender === 'male' ? '男生' : '女生'} · {question.type === 'truth' ? '真心话' : '大冒险'}<time>{new Date(record.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time></span><p>{question.text}</p></div><button className={`icon-button ${saved.favorites.includes(question.id) ? 'is-favorite' : ''}`} aria-label={`${saved.favorites.includes(question.id) ? '取消收藏' : '收藏'} ${question.id}`} onClick={() => favorite(question.id)}><Heart size={16} fill={saved.favorites.includes(question.id) ? 'currentColor' : 'none'}/></button></article> : null }) : <div className="empty-state"><Clock3 size={32}/><h3>今晚的故事，还没开始</h3><p>抽出第一道题，这里就有了你们的回忆。</p></div>}</div></Modal>}
    {toast && <div className="toast" role="status"><Sparkles size={16}/>{toast}</div>}
  </div>
}
