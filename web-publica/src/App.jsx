import { useEffect, useMemo, useRef, useState } from 'react'
import {
  motion, AnimatePresence, MotionConfig, useScroll, useSpring, useTransform, useMotionValueEvent, useReducedMotion,
} from 'motion/react'
import Lenis from 'lenis'

/* ---------- datos (precios, contacto e historia son de ejemplo) ---------- */
const WA = '51900000000'
// números de ejemplo: reemplazar por el WhatsApp real de cada sede
const SEDES = {
  nauta: { n: 'Nauta', enc: 'Jefferson Gómez Tuesta', wa: '51900000000', tel: '900 000 000' },
  iquitos: { n: 'Iquitos', enc: 'Liz Nery Gómez Ríos', wa: '51900000001', tel: '900 000 001' },
}
const ZONAS = ['En la ciudad', 'Carretera Iquitos–Nauta', 'Pueblo o comunidad por el río']
const sedeLine = (sede, z, lugar) => `[Sede ${SEDES[sede].n}] ` + (z && z !== ZONAS[0] ? `Pido desde: ${z}${lugar ? ` (${lugar.trim()})` : ''}. ` : '')
function SedeFields({ sede, setSede, z, lugar, set, idp }) {
  return (
    <>
      <div className="f full sedef"><label>¿A qué sede pides?</label>
        <div className="sedes">{Object.entries(SEDES).map(([k, v]) => (
          <button type="button" key={k} className={sede === k ? 'on' : ''} aria-pressed={sede === k} onClick={() => setSede(k)}><b>{v.n}</b><small>{v.enc}</small></button>
        ))}</div>
      </div>
      <div className="f"><label htmlFor={idp + 'z'}>¿Desde dónde?</label><select id={idp + 'z'} value={z} onChange={set('z')}>{ZONAS.map(o => <option key={o}>{o}</option>)}</select></div>
      <div className="f"><label htmlFor={idp + 'l'}>{z === ZONAS[0] ? 'Barrio (opcional)' : 'Nombre del lugar'}</label><input id={idp + 'l'} placeholder={z === ZONAS[1] ? 'Ej. km 45' : z === ZONAS[2] ? 'Ej. San Regis' : 'Ej. Centro'} value={lugar} onChange={set('lugar')} /></div>
    </>
  )
}
const EASE = [0.22, 1, 0.36, 1]
const PAGES = [
  ['', 'Inicio'], ['catalogo', 'Catálogo'], ['precios', 'Precios'], ['proceso', 'Cómo trabajamos'], ['nosotros', 'Nosotros'], ['contacto', 'Contacto'],
]
const LEVELS = [
  ['inicial', 'Inicial', 'Para los más pequeños: su primera promoción.', 'yellow'],
  ['primaria', 'Primaria', 'El recuerdo de 6.º grado, con todo el salón.', 'blue'],
  ['secundaria', 'Secundaria', 'La promoción de 5.º, la que más se cuelga en casa.', 'red'],
  ['superior', 'Superior', 'Institutos y universidad: graduación y título.', 'cream'],
]
const LVN = Object.fromEntries(LEVELS.map(([k, l]) => [k, l]))
const CATS = [['promo', 'Promociones'], ['grad', 'Graduaciones'], ['carnet', 'Carnets'], ['extra', 'Extras']]
const CATN = Object.fromEntries(CATS)
const ITEMS = [
  { id: 'i-cuadro', c: 'promo', lv: 'inicial', t: 'Cuadro de promoción', d: '15 × 21 cm con marco de madera y vidrio.', p: 40, art: 'frame' },
  { id: 'i-grupal', c: 'promo', lv: 'inicial', t: 'Foto grupal del aula', d: '20 × 30 cm, todos los niños juntos.', p: 25, u: 'por niño', art: 'group' },
  { id: 'p-cuadro', c: 'promo', lv: 'primaria', t: 'Cuadro de promoción', d: '20 × 30 cm con marco de madera y vidrio.', p: 50, tag: 'Más pedido', art: 'frame' },
  { id: 'p-grupal', c: 'promo', lv: 'primaria', t: 'Foto grupal', d: '30 × 40 cm, toda la promoción de 6.º.', p: 30, u: 'por alumno', art: 'group' },
  { id: 's-cuadro', c: 'promo', lv: 'secundaria', t: 'Cuadro de promoción', d: '20 × 30 cm con vidrio y marco de madera.', p: 55, tag: 'Más pedido', art: 'frame' },
  { id: 's-grupal', c: 'promo', lv: 'secundaria', t: 'Foto grupal', d: '30 × 40 cm, toda la promoción de 5.º.', p: 30, u: 'por alumno', art: 'group' },
  { id: 'u-cuadro', c: 'promo', lv: 'superior', t: 'Cuadro de promoción', d: '20 × 30 cm con marco dorado.', p: 60, art: 'grad2' },
  { id: 'u-grupal', c: 'promo', lv: 'superior', t: 'Foto grupal de la promoción', d: '30 × 40 cm con todos los egresados.', p: 35, u: 'por persona', art: 'group' },
  { id: 'grad', c: 'grad', t: 'Cuadro de graduación', d: '15 × 21 cm con toga y birrete.', p: 35, art: 'grad' },
  { id: 'gradg', c: 'grad', t: 'Graduación grande', d: '20 × 30 cm con marco dorado.', p: 50, tag: 'Premium', art: 'grad2' },
  { id: 'carnet', c: 'carnet', t: 'Fotos carnet', d: 'Juego de 8 fotos, fondo blanco o azul.', p: 5, u: 'el juego', art: 'sheet' },
  { id: 'fcheck', c: 'carnet', t: 'Fotocheck', d: 'Credencial con foto, nombre y cinta.', p: 8, art: 'badge' },
  { id: 'abue', c: 'extra', t: 'Cuadro para los abuelos', d: 'Copia extra 15 × 21 para regalar.', p: 30, art: 'dark' },
  { id: 'digital', c: 'extra', t: 'Copia digital HD', d: 'Tu foto editada, lista en el celular.', p: 15, art: 'phone' },
]
const PACKS = [
  { n: 'Esencial', p: 45, d: 'Lo básico para la promoción.', f: ['1 cuadro 15 × 21 con marco', 'Foto grupal impresa', 'Edición y retoque'] },
  { n: 'Recuerdo', p: 75, d: 'El que más piden las familias.', f: ['1 cuadro 20 × 30 con vidrio', 'Foto grupal 30 × 40', 'Copia digital HD', 'Edición y retoque'], pop: true },
  { n: 'Familia', p: 110, d: 'Para regalar a los abuelos.', f: ['2 cuadros 20 × 30', '1 cuadro 15 × 21 extra', 'Foto grupal 30 × 40', 'Copias digitales HD'] },
]
const SIZES = { '15x21': [15, 21, 'Para mesa o repisa. El más económico.'], '20x30': [20, 30, 'El más pedido. Queda bien en cualquier sala.'], '30x40': [30, 40, 'Para la foto grupal o una pared grande.'] }
const STEPS = [
  ['Sesión', '1 día', 'Vamos al colegio con cámara, luces y fondo. Todo el salón en una mañana.'],
  ['Edición', 'Pocos días', 'Recortamos, corregimos el color y retocamos cada foto. Tú eliges la mejor.'],
  ['Enmarcado', 'En el estudio', 'Impresión a 300 DPI con vidrio y marco de madera o dorado.'],
  ['Entrega', '1 a 2 semanas', 'Pagas el saldo con Yape, Plin o efectivo y lo cuelgas en casa.'],
]
const FAQ = [
  ['¿Van hasta el colegio?', 'Sí. Llevamos cámara, luces y fondo. Hacemos toda la sesión en un día.'],
  ['¿Cuánto demora la entrega?', 'Normalmente entre 1 y 2 semanas después de la sesión, según la cantidad de alumnos.'],
  ['¿Puedo ver la foto antes de pagar?', 'Sí. Te mostramos las fotos editadas y eliges la que más te gusta.'],
  ['¿Cómo pago?', 'Con Yape, Plin o en efectivo. Puedes dejar un adelanto para reservar.'],
  ['¿Hacen fotos carnet sueltas?', 'Sí, también para trámites. Escríbenos y te decimos el horario.'],
  ['¿Puedo pedir copias extra?', 'Claro. Cuadros para los abuelos, copias digitales y otros tamaños.'],
]
const LOOKS = [
  { bgc: '#c9dbd3', cloth: '#1b2b26' }, { bgc: '#e5d6c3', cloth: '#3a2a20', skin: '#9c6a4a', skin2: '#86583c', grad: 1 },
  { bgc: '#d7e3f0', cloth: '#1d2a44' }, { bgc: '#ecd9cf', cloth: '#5b1f2a', skin: '#c2906a', grad: 1 },
  { bgc: '#d9e6dd', cloth: '#0F4C3A', skin: '#a8754f' }, { bgc: '#dfe1e8', cloth: '#232323', grad: 1 },
]
const fmt = n => 'S/' + Math.round(n).toLocaleString('en-US')
const today = (() => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `'${String(d.getFullYear()).slice(2)} ${p(d.getMonth() + 1)} ${p(d.getDate())}` })()

/* ---------- routing (hash) + smooth scroll ---------- */
let lenis = null
const go = to => { location.hash = '#/' + to }
const readRoute = () => { const r = location.hash.replace(/^#\/?/, ''); return PAGES.some(([k]) => k === r) ? r : '' }
const Link = ({ to, className, children, onClick }) => (
  <a href={'#/' + to} className={className} onClick={e => { e.preventDefault(); onClick?.(); go(to) }}>{children}</a>
)
const Arrow = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>

/* ---------- drawn placeholders (to swap for real photos with permission) ---------- */
function Pt({ look = LOOKS[0], grad, neg }) {
  const g = grad ?? look.grad
  return (
    <div className={`pt ${neg ? 'neg' : ''}`} style={{ '--bgc': look.bgc, '--cloth': look.cloth, '--skin': look.skin, '--skin2': look.skin2 }}>
      <i className="bd" />{g ? <i className="st" /> : null}<i className="nk" /><i className="hd" /><i className="hr" style={look.hair ? { background: look.hair } : null} />
      {g ? <><i className="cb" /><i className="cp" /><i className="ts" /></> : null}
    </div>
  )
}
const MiniFrame = ({ cls = '', look, grad, wide, children }) => (
  <div className={`mini-frame ${cls} ${wide ? 'wide' : ''}`}><div className="mat"><div className="pic">{children || <Pt look={look} grad={grad} />}</div></div></div>
)
function Art({ kind }) {
  switch (kind) {
    case 'frame': return <MiniFrame look={LOOKS[2]} />
    case 'group': return <MiniFrame wide><div className="grp">{Array.from({ length: 15 }, (_, i) => <i key={i} />)}</div></MiniFrame>
    case 'grad': return <MiniFrame cls="gold" look={LOOKS[1]} grad />
    case 'grad2': return <MiniFrame cls="gold" look={LOOKS[3]} grad />
    case 'sheet': return <div className="sheet">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>
    case 'badge': return <div className="badge"><div className="bh" /><div className="bp" /><div className="bl" /><div className="bl" style={{ width: 44 }} /></div>
    case 'dark': return <MiniFrame cls="dark" look={LOOKS[4]} />
    default: return <div className="phone"><div className="scr"><Pt look={LOOKS[0]} /></div></div>
  }
}

/* ---------- motion helpers ---------- */
function Words({ text, as = 'h2', className, inView = true, delay = 0, accent }) {
  const C = motion[as]
  const words = text.split(' ')
  const trig = inView ? { whileInView: 's', viewport: { once: true, margin: '-10% 0px' } } : { animate: 's' }
  return (
    <C className={className} initial="h" {...trig} variants={{ s: { transition: { staggerChildren: 0.045, delayChildren: delay } } }}>
      {words.map((w, i) => (
        <span key={i}><span className="w"><motion.span className={accent?.includes(i) ? 'hl' : undefined}
          variants={{ h: { y: '110%' }, s: { y: 0, transition: { duration: 0.85, ease: EASE } } }}>{w}</motion.span></span>{i < words.length - 1 ? ' ' : ''}</span>
      ))}
    </C>
  )
}
const Rise = ({ children, d = 0, y = 24, as = 'div', ...rest }) => {
  const C = motion[as]
  return <C initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-6% 0px' }}
    transition={{ duration: 0.8, delay: d, ease: EASE }} {...rest}>{children}</C>
}
const fill = (v, min, max) => ({ '--p': ((v - min) / (max - min)) * 100 + '%' })
function Money({ value }) {
  const mv = useSpring(value, { stiffness: 140, damping: 22 })
  useEffect(() => { mv.set(value) }, [value])
  return <motion.span>{useTransform(mv, v => fmt(v))}</motion.span>
}

/* ---------- chrome ---------- */
const Phone = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
const Cam = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.6" /></svg>
const Search = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="7" /><path d="m21 21-5.5-5.5" /></svg>

function Header({ route }) {
  const [open, setOpen] = useState(false)
  const [hide, setHide] = useState(false)
  useEffect(() => setOpen(false), [route])
  useEffect(() => {
    let last = scrollY
    const on = () => { const y = scrollY; setHide(y > 300 && y > last); last = y }
    addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on)
  }, [])
  useEffect(() => {
    if (!open) return
    const k = e => e.key === 'Escape' && setOpen(false)
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [open])
  return (
    <motion.header className={`hdr ${hide && !open ? 'hide' : ''}`} data-open={open ? '' : undefined}
      initial={{ y: '-110%' }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: EASE }}>
      <div className="util">
        <span className="ph"><Phone /><span>Sede Nauta<br /><b>{SEDES.nauta.tel}</b> (ejemplo)</span></span>
        <span className="vr" />
        <span className="ph ph2"><Phone /><span>Sede Iquitos<br /><b>{SEDES.iquitos.tel}</b> (ejemplo)</span></span>
        <nav className="unav" aria-label="Accesos">
          <Link to="proceso" className="opt">Cómo trabajamos</Link>
          <Link to="nosotros" className="opt">Nosotros</Link>
          <Link to="contacto">Contacto</Link>
          <Link to="catalogo" className="srch" aria-label="Buscar en el catálogo"><Search /></Link>
        </nav>
      </div>
      <div className="mainrow">
        <Link to="" className="logo"><b>FOTOS JEFFERSON<span>.</span></b><small>ESTUDIO FOTOGRÁFICO · NAUTA · IQUITOS</small></Link>
        <nav className="mnav" aria-label="Principal">
          {[['catalogo', 'Catálogo'], ['precios', 'Precios']].map(([k, l]) => (
            <Link key={k} to={k}>{l}{route === k && <motion.span layoutId="mnav-ul" className="ul" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}</Link>
          ))}
          {[['proceso', 'Proceso'], ['nosotros', 'Historia']].map(([k, l]) => (
            <Link key={k} to={k} className="lk">{l}{route === k && <motion.span layoutId="mnav-ul" className="ul" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}</Link>
          ))}
          <span className="sep" />
          <button className="menu-btn" aria-expanded={open} aria-controls="panel" onClick={() => setOpen(o => !o)}>
            <span className="bars"><i /><i /></span>{open ? 'Cerrar' : 'Menú'}
          </button>
        </nav>
        <div className="cta combo">
          <Link to="contacto" className="pill">Pedir</Link>
          <Link to="catalogo" className="circ" aria-label="Ver catálogo"><Cam /></Link>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id="panel" className="panel" initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            <nav>
              {PAGES.map(([k, l], i) => (
                <motion.div key={k} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.04, duration: 0.5, ease: EASE }}>
                  <Link to={k} className={route === k ? 'on' : ''}>{l}<span className="circ sm"><Arrow /></span></Link>
                </motion.div>
              ))}
              <div className="pp">
                <Link to="contacto" className="pill">Pedir</Link>
                <a className="pill lt" href={`https://wa.me/${WA}`} target="_blank" rel="noopener">WhatsApp</a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

function Footer() {
  return (
    <footer>
      <div className="in">
        <div className="big">Fotos Jefferson<span>.</span></div>
        <div className="cols">
          <div><h4>Páginas</h4><ul>{PAGES.map(([k, l]) => <li key={k}><Link to={k}>{l}</Link></li>)}</ul></div>
          <div><h4>Sedes</h4><ul><li>Sede Nauta · Jefferson Gómez Tuesta</li><li>Sede Iquitos · Liz Nery Gómez Ríos</li><li>Carretera Iquitos–Nauta y pueblos por el río</li></ul></div>
          <div><h4>Pagos</h4><ul><li>Yape</li><li>Plin</li><li>Efectivo</li></ul></div>
        </div>
        <div className="bot"><span>© 2026 Fotos Jefferson</span><span>Fotografía escolar en Nauta e Iquitos</span></div>
      </div>
    </footer>
  )
}

function PageHead({ n, crumb, title, lead }) {
  return (
    <div className="phead">
      <motion.div className="kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}><i />{n} · {crumb}</motion.div>
      <div className="row">
        <Words as="h1" text={title} inView={false} delay={0.2} />
        {lead && <motion.p className="lead" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7, ease: EASE }}>{lead}</motion.p>}
      </div>
    </div>
  )
}
const Next = ({ to, label }) => (
  <div className="wrap" style={{ paddingBottom: 24 }}>
    <div className="next"><span className="muted" style={{ color: '#9a9993' }}>Siguiente</span><Link to={to}>{label} <span className="circ"><Arrow /></span></Link></div>
  </div>
)

/* ---------- pages ---------- */
const PH = (i, extra) => ({ k: 'p', look: LOOKS[i % LOOKS.length], ...extra })
const COLS = [
  [{ k: 'red', l: 'Promo 2026' }, PH(0), PH(1), { k: 'blue', l: 'Carnets' }, PH(2)],
  [{ k: 'yellow', l: 'Desde 1 día' }, PH(3), { k: 'dark', l: 'Hecho en Nauta' }, PH(4), { k: 'red' }],
  [{ k: 'blue' }, { k: 'cream', l: 'Graduación' }, PH(5), { k: 'yellow', l: 'Yape · Plin' }, PH(1, { bw: 1 })],
]
const TOPS = [86, -11.5, 86.5]
function MTile({ t }) {
  if (t.k === 'p') return <div className="tile"><div className={`pt ${t.bw ? 'bw' : ''}`} style={{ '--bgc': t.look.bgc, '--cloth': t.look.cloth, '--skin': t.look.skin, '--skin2': t.look.skin2 }}>
    <i className="bd" />{t.look.grad ? <i className="st" /> : null}<i className="nk" /><i className="hd" /><i className="hr" />{t.look.grad ? <><i className="cb" /><i className="cp" /><i className="ts" /></> : null}</div></div>
  return <div className={`tile ${t.k}`}>{t.l && <span className="lbl">{t.l}</span>}</div>
}
function Mosaic() {
  return (
    <div className="mosaic" aria-hidden="true">
      {COLS.map((c, i) => (
        <motion.div key={i} className="mcol" style={{ left: `calc(${i} * (var(--col) + var(--gap)))`, top: TOPS[i] }}
          initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, delay: 0.35 + i * 0.12, ease: EASE }}>
          <div className={`mtrack ${i === 1 ? 'up' : ''}`}>{[...c, ...c].map((t, k) => <MTile key={k} t={t} />)}</div>
        </motion.div>
      ))}
    </div>
  )
}

const WAYS = [
  ['ind', '👪', 'Para mi hijo o para mí', 'Eres papá, mamá o alumno y quieres tu cuadro, una copia extra o fotos carnet.', 'yellow'],
  ['col', '🏫', 'Para todo un colegio', 'Eres director, tutor o padre delegado y quieres la sesión de toda la promoción.', 'dark'],
]
function QuickQuote({ mode, setMode, picked, sede, setSede }) {
  const [f, setF] = useState({ n: '', w: '', c: '', q: 'Cuadro de promoción', a: '', z: ZONAS[0], lugar: '' })
  const [st, setSt] = useState('')
  const ind = mode === 'ind'
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const names = ITEMS.filter(i => picked.has(i.id)).map(i => i.t)
  const submit = e => {
    e.preventDefault()
    if (!f.n.trim() || !f.c.trim()) { setSt('err'); return }
    let m = sedeLine(sede, f.z, f.lugar) + (ind
      ? `Hola, soy ${f.n.trim()}. Quiero cotizar: ${f.q}. Colegio y grado: ${f.c.trim()}.`
      : `Hola, soy ${f.n.trim()} del colegio ${f.c.trim()}. Queremos cotizar la sesión de la promoción.${f.a ? ` Somos ${f.a} alumnos.` : ''}`)
    if (names.length) m += ` Me interesa: ${names.join(', ')}.`
    if (f.w) m += ` Mi WhatsApp: ${f.w}.`
    window.open(`https://wa.me/${SEDES[sede].wa}?text=${encodeURIComponent(m)}`, '_blank', 'noopener')
    setSt('ok')
  }
  return (
    <form className="qcard" noValidate onSubmit={submit}>
      <h2>Cotiza en 1 minuto</h2>
      <p className="hint">Te respondemos por WhatsApp el mismo día.</p>
      <div className="mode" role="tablist">
        {[['ind', 'Para mi hijo'], ['col', 'Para un colegio']].map(([k, l]) => (
          <button type="button" role="tab" aria-selected={mode === k} key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setSt('') }}>
            {mode === k && <motion.span layoutId="qmode-bg" className="bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}<span>{l}</span>
          </button>
        ))}
      </div>
      <div className="fg">
        <SedeFields sede={sede} setSede={setSede} z={f.z} lugar={f.lugar} set={set} idp="q" />
        <div className="f full"><label htmlFor="qn">Tu nombre</label><input id="qn" autoComplete="name" placeholder="Ej. Rosa Pérez" value={f.n} onChange={set('n')} /></div>
        <div className="f"><label htmlFor="qw">Tu WhatsApp</label><input id="qw" inputMode="tel" placeholder="9XX XXX XXX" value={f.w} onChange={set('w')} /></div>
        <div className="f full"><label htmlFor="qc">{ind ? 'Colegio y grado' : 'Colegio'}</label><input id="qc" placeholder={ind ? 'Ej. San Martín, 5.º B' : 'Ej. I.E. San Martín'} value={f.c} onChange={set('c')} /></div>
        {ind
          ? <div className="f full"><label htmlFor="qq">¿Qué quieres?</label><select id="qq" value={f.q} onChange={set('q')}>{IND_ITEMS.map(o => <option key={o}>{o}</option>)}</select></div>
          : <div className="f full"><label htmlFor="qa">N.º de alumnos</label><input id="qa" inputMode="numeric" placeholder="Ej. 35" value={f.a} onChange={set('a')} /></div>}
      </div>
      <motion.button whileTap={{ scale: 0.98 }} type="submit" className="pill">Pedir mi cotización</motion.button>
      {st === 'err' && <motion.p className="err" initial={{ x: 0 }} animate={{ x: [8, -6, 3, 0] }}>Escribe tu nombre y el colegio.</motion.p>}
      {st === 'ok' && <p className="ok">Se abrió WhatsApp con tu mensaje. Solo toca enviar.</p>}
      {!st && <p className="safe"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>Sin compromiso. Tus datos solo se usan para responderte.</p>}
    </form>
  )
}

function Home({ mode, setMode, setLevel, picked, sede, setSede }) {
  const lines = [['Elige el cuadro'], ['de promoción', 1], ['de tu hijo.']]
  return (
    <>
      <section className="qhero" style={{ paddingBottom: 0 }}>
        <motion.div className="box" initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.1, ease: EASE }}>
          <div className="deco" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={`fr ${i % 3 === 1 ? 'gold' : ''}`} style={{ marginTop: i % 3 === 1 ? 50 : 0 }}><div className="mt"><div className="ph"><Pt look={LOOKS[i]} /></div></div></div>)}
          </div>
          <div className="txt">
            <motion.div className="chips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}><span>Nauta e Iquitos · por décadas</span><span>Promociones · Graduaciones · Carnets</span></motion.div>
            <h1 aria-label="La foto de promoción que tu familia cuelga para siempre.">
              {[['La foto de promoción'], ['que tu familia'], ['cuelga para siempre.', 1]].map(([l, em], i) => (
                <span className="ln" key={l} aria-hidden="true"><motion.span initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.45 + i * 0.1, ease: EASE }}>{em ? <em>{l}</em> : l}</motion.span></span>
              ))}
            </h1>
            <motion.p className="sub" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.7, ease: EASE }}>
              Retratos en tu colegio, cuadros con vidrio y marco, y entrega puntual. Escoge tu cuadro y pide el precio aquí mismo.
            </motion.p>
            <motion.ul className="ticks2" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.08, delayChildren: 1 } } }}>
              {['Sesión de fotos en tu colegio, en un solo día', 'Ves la foto antes de pagar, con Yape o Plin', 'Te avisamos por WhatsApp cuando está listo'].map(t => <motion.li key={t} variants={{ h: { opacity: 0, x: -12 }, s: { opacity: 1, x: 0 } }}>{t}</motion.li>)}
            </motion.ul>
            <motion.div className="acts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>
              <Link to="catalogo" className="pill">Ver los cuadros</Link>
              <a className="textlink" href={`https://wa.me/${WA}`} target="_blank" rel="noopener">Escribir por WhatsApp <span className="circ xs"><Arrow /></span></a>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.6, ease: EASE }} style={{ position: 'relative', zIndex: 1 }}>
            <QuickQuote mode={mode} setMode={setMode} picked={picked} sede={sede} setSede={setSede} />
          </motion.div>
        </motion.div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-t"><Words text="Cuadros de promoción por nivel" /><Link to="catalogo" className="textlink">Ver todo el catálogo <span className="circ xs"><Arrow /></span></Link></div>
          <div className="levels">
            {LEVELS.map(([k, l, d, c], i) => {
              const from = Math.min(...ITEMS.filter(x => x.lv === k && x.t.startsWith('Cuadro')).map(x => x.p))
              const look = LOOKS[[0, 2, 1, 3][i]]
              return (
                <motion.a key={k} href="#/catalogo" className={`lvcard tile ${c}`} onClick={e => { e.preventDefault(); setLevel(k); go('catalogo') }}
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ y: -5 }} transition={{ duration: 0.6, delay: i * 0.07, ease: EASE }}>
                  <div className="lvart"><MiniFrame cls={i > 1 ? 'gold' : ''} look={look} grad={i > 1} /></div>
                  <div className="lvtxt"><h3>{l}</h3><p>{d}</p><span className="from">Cuadros desde <b>S/{from}</b><span className="circ sm"><Arrow /></span></span></div>
                </motion.a>
              )
            })}
          </div>
        </div>
      </section>

      <section id="pedir" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-t"><Words text="¿Cómo quieres pedir?" /><Rise as="p">Elige una opción y te llevamos al formulario correcto.</Rise></div>
          <div className="ways">
            {WAYS.map(([m, ic, t, d, c], i) => (
              <motion.button key={m} className={`way tile ${c}`} onClick={() => { setMode(m); go('contacto') }}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ y: -4 }} transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}>
                <div><span className="ic" aria-hidden="true">{ic}</span><h3>{t}</h3><p>{d}</p></div>
                <span className="go">{m === 'ind' ? 'Pedir mi cuadro' : 'Pedir para el colegio'} <span className="circ sm"><Arrow /></span></span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Rise className="band">
            <div>
              <span className="kicker" style={{ color: 'var(--yellow)' }}>Nauta e Iquitos, Loreto</span>
              <h2 style={{ marginTop: 14 }}>El estudio de los colegios de Loreto <em>desde hace décadas.</em></h2>
            </div>
            <div>
              <p>Don Jeff y su familia conocen a cada colegio de la ciudad. Hoy trabajamos igual que siempre, ahora con edición profesional y pagos por Yape.</p>
              <Link to="nosotros" className="pill">Nuestra historia</Link>
            </div>
          </Rise>
        </div>
      </section>
    </>
  )
}
function DoorTile({ to, cls, t, d, bg }) {
  return (
    <motion.a href={'#/' + to} className={`door tile ${cls}`} onClick={e => { e.preventDefault(); go(to) }}
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-8% 0px' }}
      whileHover={{ y: -4 }} transition={{ duration: 0.7, ease: EASE }}>
      {bg}
      <h3>{t}</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, position: 'relative', zIndex: 4 }}>
        <p>{d}</p><span className="circ sm"><Arrow /></span>
      </div>
    </motion.a>
  )
}

const TILEC = { ...Object.fromEntries(LEVELS.map(([k, , , c]) => [k, c])), grad: 'yellow', carnet: 'blue', extra: 'cream' }
function Card({ it, on, toggle }) {
  return (
    <article className="item">
      <motion.div className={`tile ${TILEC[it.lv || it.c]}`} whileHover="h" initial="r">
        {it.tag && <span className="tag">{it.tag}</span>}
        <motion.div className="shot" variants={{ r: { scale: 1, rotate: 0 }, h: { scale: 1.07, rotate: -2 } }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}><Art kind={it.art} /></motion.div>
      </motion.div>
      <div className="inf">
        <span className="cat">{it.lv ? `Promoción · ${LVN[it.lv]}` : CATN[it.c]}</span>
        <h3>{it.t}</h3><p>{it.d}</p>
        <div className="row">
          <span className="price">S/{it.p}{it.u && <small>{it.u}</small>}</span>
          <motion.button className={`add ${on ? 'on' : ''}`} whileTap={{ scale: 0.94 }} onClick={() => toggle(it.id)}>{on ? '✓ En tu lista' : '+ Agregar'}</motion.button>
        </div>
      </div>
    </article>
  )
}

function Catalog({ picked, toggle, level, setLevel }) {
  const [cat, setCat] = useState(level !== 'all' ? 'promo' : 'all')
  const cats = cat === 'all' ? CATS : CATS.filter(([k]) => k === cat)
  const lvls = level === 'all' ? LEVELS : LEVELS.filter(([k]) => k === level)
  const grid = list => (
    <div className="grid">
      {list.map((it, n) => <Rise key={it.id} d={n * 0.05} style={{ display: 'flex' }}><Card it={it} on={picked.has(it.id)} toggle={toggle} /></Rise>)}
    </div>
  )
  return (
    <div className="page"><div className="wrap">
      <PageHead n="01" crumb="Catálogo" title="Catálogo" lead="Agrega a tu lista lo que te guste y al final la mandas por WhatsApp. Precios de ejemplo." />
      <div className="fbar">
        <div className="in">
          <div className="tabs">
            {[['all', 'Todo'], ...CATS].map(([k, l]) => (
              <button key={k} className={`tab ${cat === k ? 'on' : ''}`} onClick={() => { setCat(k); if (k !== 'promo') setLevel('all') }}>
                {cat === k && <motion.span layoutId="tab-bg" className="bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}<span>{l}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={cat} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }} transition={{ duration: 0.45, ease: EASE }}>
          {cats.map(([k, l]) => (
            <div className="lvsec" key={k}>
              <div className="lvhead"><h2>{l}</h2>
                {k === 'promo' && (
                  <div className="lvchips">
                    {[['all', 'Todos los niveles'], ...LEVELS].map(([lk, ll]) => (
                      <button key={lk} className={level === lk ? 'on' : ''} onClick={() => setLevel(lk)}>{ll}</button>
                    ))}
                  </div>
                )}
              </div>
              {k === 'promo'
                ? <div className="lvwrap">{lvls.map(([lk, ll, ld, lc]) => (
                  <div className="lvsub" key={lk}>
                    <div className="lvsubh"><span className={`lvdot ${lc}`} /><h3>{ll}</h3><p>{ld}</p></div>
                    {grid(ITEMS.filter(i => i.lv === lk))}
                  </div>
                ))}</div>
                : grid(ITEMS.filter(i => i.c === k))}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div><Next to="precios" label="Precios" /></div>
  )
}

function Prices({ plan, setPlan, onSend }) {
  const [n, setN] = useState(30), [pk, setPk] = useState(1), [dp, setDp] = useState(50)
  const disc = n >= 30 ? 0.9 : 1, per = Math.round(PACKS[pk].p * disc), tot = per * n, ad = Math.round(tot * dp / 100)
  const [sz, setSz] = useState('20x30'); const [w, h, txt] = SIZES[sz]
  const [s, setS] = useState(7); const ref = useRef(null)
  useEffect(() => { const ro = new ResizeObserver(([e]) => setS(e.contentRect.width < 420 ? 5.5 : 7)); ro.observe(ref.current); return () => ro.disconnect() }, [])
  return (
    <div className="page">
      <div className="wrap"><PageHead n="02" crumb="Precios" title="Precios" lead="Paquetes por alumno, el total de tu salón y cómo se ve cada tamaño. Todos los precios son de ejemplo." /></div>
      <section style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="packs">
            {PACKS.map((p, i) => {
              const id = `${p.n} (S/${p.p})`, on = plan === id
              return (
                <Rise key={p.n} d={i * 0.1} className={`pack ${p.pop ? 'pop' : ''}`}>
                  <div className="top"><h3>{p.n}</h3>{p.pop && <span className="badge2">El más pedido</span>}</div>
                  <div className="pr">S/{p.p} <small>por alumno</small></div>
                  <p className="d">{p.d}</p>
                  <ul>{p.f.map(f => <li key={f}>{f}</li>)}</ul>
                  <motion.button whileTap={{ scale: 0.97 }} className={`pill ${p.pop ? '' : 'lt'} ${on ? 'chosen' : ''}`} onClick={() => setPlan(on ? '' : id)}>{on ? '✓ Elegido' : `Elegir ${p.n}`}</motion.button>
                </Rise>
              )
            })}
          </div>
          <p className="note">Descuento para salones desde 30 alumnos (ejemplo).</p>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap calc">
          <Rise className="side">
            <div>
              <span className="kicker">Cotizador</span>
              <h2 style={{ marginTop: 12 }}>Todo tu salón en un número</h2>
              <p className="lead" style={{ marginTop: 16 }}>Mueve las barras y mira cuánto sale. Luego mandas el cálculo por WhatsApp.</p>
            </div>
            <ul className="ticks">{['Precio por alumno y total del salón', 'Adelanto y saldo al entregar', '10% menos desde 30 alumnos'].map(t => <li key={t}>{t}</li>)}</ul>
          </Rise>
          <Rise className="ccard" y={40} d={0.1}>
            <div className="crow"><div className="t"><span>Alumnos</span><b>{n}</b></div><input type="range" min="5" max="80" value={n} style={fill(n, 5, 80)} onChange={e => setN(+e.target.value)} aria-label="Alumnos" /></div>
            <div className="crow"><div className="t"><span>Paquete</span></div>
              <div className="pseg">{PACKS.map((p, i) => (
                <button key={p.n} className={pk === i ? 'on' : ''} onClick={() => setPk(i)}>
                  {pk === i && <motion.span layoutId="pk-bg" className="bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}<span>{p.n}</span>
                </button>))}</div></div>
            <div className="crow"><div className="t"><span>Adelanto</span><b>{dp}%</b></div><input type="range" min="20" max="100" step="10" value={dp} style={fill(dp, 20, 100)} onChange={e => setDp(+e.target.value)} aria-label="Adelanto" /></div>
            <div className="res">
              <span className="lbl">TOTAL ESTIMADO</span>
              <div className="tot"><Money value={tot} /></div>
              <p className="det">{fmt(per)} por alumno{disc < 1 ? ', con 10% de descuento' : ''}</p>
              <div className="split"><div><b><Money value={ad} /></b>Adelanto</div><div><b><Money value={tot - ad} /></b>Al entregar</div></div>
              <button className="pill" onClick={() => onSend(PACKS[pk], n)}>Enviar esta cotización</button>
            </div>
          </Rise>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap sizes">
          <Rise className="side y">
            <span className="kicker">Tamaños</span>
            <h2 style={{ marginTop: 12 }}>¿Cómo se ve en tu pared?</h2>
            <div className="seg">{Object.keys(SIZES).map(k => (
              <button key={k} className={sz === k ? 'on' : ''} onClick={() => setSz(k)}>
                {sz === k && <motion.span layoutId="sz-bg" className="bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}<span>{k.replace('x', ' × ')}</span>
              </button>))}</div>
            <AnimatePresence mode="wait"><motion.p key={sz} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}><b>{w} × {h} cm.</b> {txt}</motion.p></AnimatePresence>
          </Rise>
          <motion.div className="cwall" ref={ref} initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }}>
            <div className="scale"><motion.i animate={{ width: 10 * s }} />10 cm</div>
            <motion.div className="cframe" animate={{ width: w * s, height: h * s }} transition={{ type: 'spring', stiffness: 120, damping: 16 }}>
              <span className="ctag">{w} × {h} cm</span>
              <div className="mat"><div className="pic"><Pt look={LOOKS[1]} grad /></div></div>
            </motion.div>
            <div className="sofa" />
          </motion.div>
        </div>
      </section>
      <Next to="proceso" label="Proceso" />
    </div>
  )
}

function Process() {
  const ref = useRef(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [step, setStep] = useState(0)
  useMotionValueEvent(p, 'change', v => setStep(Math.min(3, Math.floor(v * 4.0001))))
  const filter = useTransform(p, [0.08, 0.3], ['grayscale(1) brightness(0.8) contrast(0.9)', 'grayscale(0) brightness(1) contrast(1)'])
  const phS = useTransform(p, [0.08, 0.3], [1.3, 1]), phX = useTransform(p, [0.08, 0.3], ['9%', '0%'])
  const vfO = useTransform(p, [0.22, 0.34], [1, 0]), vfS = useTransform(p, [0.22, 0.34], [1, 0.82])
  const matO = useTransform(p, [0.4, 0.52], [0, 1]), matS = useTransform(p, [0.4, 0.52], [0.94, 1])
  const frO = useTransform(p, [0.45, 0.6], [0, 1]), frS = useSpring(useTransform(p, [0.45, 0.6], [1.14, 1]), { stiffness: 200, damping: 20 })
  const hO = useTransform(p, [0.72, 0.82], [0, 1]), hY = useTransform(p, [0.72, 0.82], [-14, 0])
  const tO = useTransform(p, [0.8, 0.9], [0, 1]), tY = useTransform(p, [0.8, 0.9], [10, 0])
  return (
    <div className="page">
      <div className="wrap"><PageHead n="03" crumb="Proceso" title="Cómo trabajamos" lead="Baja despacio: así pasa una foto del colegio a la pared de tu casa." /></div>
      <div className="story" ref={ref}>
        <div className="story-in">
          <ol className="ssteps">
            {STEPS.map(([t, d, x], i) => <li key={t} className={step === i ? 'on' : ''}><h3>0{i + 1} {t} <small>{d}</small></h3><p>{x}</p></li>)}
          </ol>
          <div className="stage" aria-hidden="true">
            <div className="sp">
              <motion.svg className="s-hang" viewBox="0 0 130 60" fill="none" style={{ opacity: hO, y: hY }}><path d="M12 60 65 8l53 52" stroke="currentColor" strokeWidth="2" /><circle cx="65" cy="7" r="5" fill="currentColor" /></motion.svg>
              <motion.div className="s-frame" style={{ opacity: frO, scale: frS }} />
              <motion.div className="s-mat" style={{ opacity: matO, scale: matS }} />
              <div className="s-photo"><motion.div style={{ position: 'absolute', inset: 0, filter, scale: phS, x: phX }}><Pt look={LOOKS[1]} grad /></motion.div></div>
              <motion.div className="s-vf" style={{ opacity: vfO, scale: vfS }}><i /><i /><i /><i /><span className="rec">● REC</span></motion.div>
              <motion.span className="s-tag" style={{ opacity: tO, y: tY }}>LISTO PARA COLGAR</motion.span>
            </div>
          </div>
        </div>
      </div>
      <section>
        <div className="wrap faq">
          <div><Words text="Preguntas frecuentes" /><Rise as="p" className="lead" style={{ marginTop: 14 }}>¿Otra duda? Escríbenos por WhatsApp.</Rise></div>
          <Faq />
        </div>
      </section>
      <Next to="nosotros" label="Nuestra historia" />
    </div>
  )
}
function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <div>
      {FAQ.map(([q, a], i) => (
        <Rise key={q} d={i * 0.04} y={14} className={`qa ${open === i ? 'open' : ''}`}>
          <button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>{q}<motion.span className="pl" animate={{ rotate: open === i ? 45 : 0 }}>+</motion.span></button>
          <AnimatePresence initial={false}>
            {open === i && <motion.div className="ans" initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.35, ease: EASE }}><p>{a}</p></motion.div>}
          </AnimatePresence>
        </Rise>
      ))}
    </div>
  )
}

function About() {
  const grand = { bgc: '#d9e6dd', cloth: '#2b2b2b', skin: '#a8754f', skin2: '#8f6040', hair: '#cfcfc8' }
  return (
    <div className="page">
      <div className="wrap"><PageHead n="04" crumb="Nosotros" title="Nuestra historia" lead="Un estudio familiar con sedes en Nauta e Iquitos. Media ciudad conoce a Don Jeff." /></div>
      <section style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="about">
            <motion.div className="tile photo" initial={{ clipPath: 'inset(100% 0 0 0 round 22px)' }} whileInView={{ clipPath: 'inset(0% 0 0 0 round 22px)' }} viewport={{ once: true }} transition={{ duration: 1.1, ease: EASE }}>
              <Pt look={grand} /><span className="lbl" style={{ color: '#fff' }}>Don Jeff · Nauta</span>
            </motion.div>
            <Rise className="txt" d={0.1}>
              <h2>Décadas guardando los recuerdos de Nauta.</h2>
              <p className="lead" style={{ marginTop: 18 }}>Fotos Jefferson empezó como el estudio de un fotógrafo que iba colegio por colegio. Hoy la familia sigue ese trabajo en dos sedes: Nauta, a cargo de Jefferson Gómez Tuesta, e Iquitos, a cargo de Liz Nery Gómez Ríos. Ahora con edición profesional, catálogo en línea y pagos por Yape y Plin.</p>
              <span className="ph-note">Texto de ejemplo: aquí va la historia real de Don Jeff</span>
            </Rise>
          </div>
          <div className="values">
            {[['Cercanía', 'Conocemos a los colegios, a los profesores y a las familias de Nauta.', 'red'], ['Cuidado', 'Revisamos y retocamos cada foto antes de imprimirla.', 'blue'], ['Cumplimiento', 'Fechas claras de entrega y pagos sin complicaciones.', 'yellow']].map(([t, d, c], i) => (
              <Rise key={t} d={i * 0.1} className={`tile ${c}`}><span className="kicker">0{i + 1}</span><h3 style={{ marginTop: 'auto' }}>{t}</h3><p>{d}</p></Rise>
            ))}
          </div>
        </div>
      </section>
      <Next to="contacto" label="Contacto" />
    </div>
  )
}

const IND_ITEMS = ['Cuadro de promoción', 'Cuadro de graduación', 'Copia extra para los abuelos', 'Fotos carnet', 'Copia digital', 'Otro']
function Contact({ form, setForm, picked, plan, mode, setMode, sede, setSede }) {
  const [state, setState] = useState('')
  const names = ITEMS.filter(i => picked.has(i.id)).map(i => i.t)
  const set = k => e => setForm({ ...form, [k]: e.target.value })
  const ind = mode === 'ind'
  const submit = e => {
    e.preventDefault()
    if (!form.n.trim() || (!ind && !form.c.trim())) { setState('err'); return }
    let m = sedeLine(sede, form.z, form.lugar)
    if (ind) {
      m += `Hola, soy ${form.n.trim()}. Quiero pedir: ${form.q}${form.k > 1 ? ` (${form.k})` : ''}.`
      if (form.al) m += ` Alumno(a): ${form.al}.`
      if (form.c) m += ` Colegio y grado: ${form.c}.`
    } else {
      m += `Hola, soy ${form.n.trim()}, ${form.cargo.toLowerCase()} del colegio ${form.c.trim()}. Queremos cotizar: ${form.s}.`
      if (form.a) m += ` Somos ${form.a} alumnos.`
      if (form.d) m += ` Fecha aproximada: ${form.d}.`
      if (plan) m += ` Paquete: ${plan}.`
    }
    if (names.length) m += ` Me interesa: ${names.join(', ')}.`
    if (form.w) m += ` Mi WhatsApp: ${form.w}.`
    window.open(`https://wa.me/${SEDES[sede].wa}?text=${encodeURIComponent(m)}`, '_blank', 'noopener')
    setState('ok')
  }
  return (
    <div className="page">
      <div className="wrap"><PageHead n="05" crumb="Contacto" title="Haz tu pedido" lead="Llena lo que sepas y te llevamos a WhatsApp con el mensaje listo. Respondemos el mismo día." /></div>
      <section style={{ paddingTop: 8 }}>
        <div className="wrap contact">
          <div className="info">
            {Object.entries(SEDES).map(([k, v], i) => (
              <Rise key={k} d={i * 0.06} className={`tile sedecard ${i ? 'blue' : 'yellow'}`}>
                <span className="k">Sede {v.n}</span><b>{v.enc}</b>
                <span className="sd">Encargado(a) · WhatsApp {v.tel} (ejemplo)</span>
                <a className="pill lt" href={`https://wa.me/${v.wa}`} target="_blank" rel="noopener" onClick={() => setSede(k)}>Escribir a {v.n}</a>
              </Rise>
            ))}
            <Rise d={0.12} className="tile cream"><span className="k">También atendemos</span><b>Carretera Iquitos–Nauta y pueblos por el río</b><span className="sd">Elige la sede más cercana y dinos desde dónde pides.</span></Rise>
            <Rise d={0.18} className="tile dark" style={{ color: '#fff' }}><span className="k">Pagos</span><b>Yape, Plin, efectivo</b></Rise>
          </div>
          <Rise as="form" className="form" noValidate onSubmit={submit} d={0.1}>
            <h3>¿Para quién es el pedido?</h3>
            <p className="hint">Elige una opción y llena lo que sepas.</p>
            <div className="mode" role="tablist">
              {[['ind', 'Para mi hijo o para mí'], ['col', 'Para un colegio']].map(([k, l]) => (
                <button type="button" role="tab" aria-selected={mode === k} key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setState('') }}>
                  {mode === k && <motion.span layoutId="mode-bg" className="bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}<span>{l}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={mode} className="fg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                <SedeFields sede={sede} setSede={setSede} z={form.z} lugar={form.lugar} set={set} idp="f" />
                <div className="f"><label htmlFor="fn">Tu nombre</label><input id="fn" autoComplete="name" placeholder="Ej. Rosa Pérez" value={form.n} onChange={set('n')} /></div>
                <div className="f"><label htmlFor="fw">Tu WhatsApp</label><input id="fw" inputMode="tel" placeholder="9XX XXX XXX" value={form.w} onChange={set('w')} /></div>
                {ind ? <>
                  <div className="f"><label htmlFor="fal">Nombre del alumno(a)</label><input id="fal" placeholder="Ej. Lucía Pérez" value={form.al} onChange={set('al')} /></div>
                  <div className="f"><label htmlFor="fc">Colegio y grado</label><input id="fc" placeholder="Ej. San Martín, 5.º B" value={form.c} onChange={set('c')} /></div>
                  <div className="f"><label htmlFor="fq">¿Qué quieres?</label><select id="fq" value={form.q} onChange={set('q')}>{IND_ITEMS.map(o => <option key={o}>{o}</option>)}</select></div>
                  <div className="f"><label htmlFor="fk">Cantidad</label><input id="fk" type="number" min="1" max="20" value={form.k} onChange={set('k')} /></div>
                </> : <>
                  <div className="f"><label htmlFor="fcg">Tu cargo</label><select id="fcg" value={form.cargo} onChange={set('cargo')}><option>Director(a)</option><option>Profesor(a) o tutor(a)</option><option>Padre o madre delegado(a)</option><option>Otro</option></select></div>
                  <div className="f"><label htmlFor="fc">Colegio</label><input id="fc" placeholder="Ej. I.E. San Martín" value={form.c} onChange={set('c')} /></div>
                  <div className="f"><label htmlFor="fa">N.º de alumnos</label><input id="fa" inputMode="numeric" placeholder="Ej. 35" value={form.a} onChange={set('a')} /></div>
                  <div className="f"><label htmlFor="fs">Servicio</label><select id="fs" value={form.s} onChange={set('s')}><option>Promoción</option><option>Graduación</option><option>Fotos carnet</option><option>Otro</option></select></div>
                  <div className="f wide"><label htmlFor="fd">Fecha aproximada</label><input id="fd" type="date" value={form.d} onChange={set('d')} /></div>
                </>}
                {((!ind && plan) || names.length > 0) && <div className="picked"><b>Tu lista:</b> {[!ind && plan && 'Paquete ' + plan, ...names].filter(Boolean).join(', ')}</div>}
              </motion.div>
            </AnimatePresence>
            <motion.button whileTap={{ scale: 0.98 }} type="submit" className="pill">Enviar por WhatsApp</motion.button>
            {state === 'err' && <motion.p className="err" initial={{ x: 0 }} animate={{ x: [8, -6, 3, 0] }}>{ind ? 'Escribe tu nombre.' : 'Escribe tu nombre y el colegio.'}</motion.p>}
            {state === 'ok' && <motion.p className="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Se abrió WhatsApp con tu mensaje. Solo toca enviar.</motion.p>}
            {!state && <p className="safe"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>Sin compromiso. Te respondemos el mismo día.</p>}
          </Rise>
        </div>
      </section>
    </div>
  )
}

/* ---------- app ---------- */
export default function App() {
  const reduce = useReducedMotion()
  const [route, setRoute] = useState(readRoute)
  const [picked, setPicked] = useState(() => new Set())
  const [plan, setPlan] = useState('')
  const [mode, setMode] = useState('ind')
  const [level, setLevel] = useState('all')
  const [sede, setSede] = useState('nauta')
  const [form, setForm] = useState({ n: '', c: '', w: '', a: '', s: 'Promoción', d: '', al: '', q: 'Cuadro de promoción', k: 1, cargo: 'Director(a)', z: ZONAS[0], lugar: '' })

  useEffect(() => {
    const on = () => setRoute(readRoute())
    addEventListener('hashchange', on); return () => removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (reduce) return
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true })
    let id; const raf = t => { lenis.raf(t); id = requestAnimationFrame(raf) }; id = requestAnimationFrame(raf)
    return () => { cancelAnimationFrame(id); lenis.destroy(); lenis = null }
  }, [reduce])
  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0)
    document.title = route ? `${PAGES.find(([k]) => k === route)[1]} · Fotos Jefferson` : 'Fotos Jefferson · Nauta'
  }, [route])

  const toggle = id => setPicked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const list = [plan && 'Paquete ' + plan, ...ITEMS.filter(i => picked.has(i.id)).map(i => i.t)].filter(Boolean)
  useEffect(() => { document.body.classList.toggle('qb', list.length > 0) }, [list.length])
  const label = PAGES.find(([k]) => k === route)[1]
  const first = useRef(true)
  useEffect(() => { first.current = false }, [])

  const page = {
    '': <Home picked={picked} mode={mode} setMode={setMode} setLevel={setLevel} sede={sede} setSede={setSede} />,
    catalogo: <Catalog picked={picked} toggle={toggle} level={level} setLevel={setLevel} />,
    precios: <Prices plan={plan} setPlan={setPlan} onSend={(p, n) => { setPlan(`${p.n} (S/${p.p})`); setForm(f => ({ ...f, a: String(n) })); setMode('col'); go('contacto') }} />,
    proceso: <Process />,
    nosotros: <About />,
    contacto: <Contact form={form} setForm={setForm} picked={picked} plan={plan} mode={mode} setMode={setMode} sede={sede} setSede={setSede} />,
  }[route]

  return (
    <MotionConfig reducedMotion="user">
      <Header route={route} />
      <AnimatePresence mode="wait">
        <motion.main key={route} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          {page}
        </motion.main>
      </AnimatePresence>
      <AnimatePresence>
        <motion.div key={'c' + route} aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--red)', pointerEvents: 'none', display: 'grid', placeItems: 'center' }}
          initial={{ y: first.current ? '-100%' : '0%' }} animate={{ y: '-100%' }}
          transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1], delay: 0.1 }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontStretch: '85%', fontSize: 'clamp(48px,10vw,140px)', letterSpacing: '-.05em', textTransform: 'uppercase', color: 'var(--ink)' }}>{label}</span>
        </motion.div>
      </AnimatePresence>
      <Footer />
      <AnimatePresence>
        {list.length > 0 && route !== 'contacto' && (
          <motion.div className="qbar" role="status" style={{ x: '-50%' }} initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <motion.span key={list.length} className="cnt" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>{list.length}</motion.span>
            <span className="lst">{list.join(', ')}</span>
            <Link to="contacto" className="pill">Pedir</Link>
          </motion.div>
        )}
      </AnimatePresence>
      <a className="wa" href={`https://wa.me/${SEDES[sede].wa}`} target="_blank" rel="noopener" aria-label="WhatsApp">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" /></svg>
      </a>
    </MotionConfig>
  )
}
