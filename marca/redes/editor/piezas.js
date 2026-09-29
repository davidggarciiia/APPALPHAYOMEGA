/* global window */
/**
 * Piezas que comparten las plantillas: colocar textos en columna, encoger lo
 * que no cabe, etiquetas, pildoras, numeros en aro...
 *
 * Cada plantilla se escribe con esto y con MOTOR, y se apunta en
 * window.PLANTILLAS con su grupo.
 */
;(function () {
  const M = window.MOTOR
  const { avance, bloque, boton, fondo, medio, COLOR, DENTRO_Y_FUERA, LINEAL } = M

  /** Una pieza de una columna: se mide primero y se pinta despues en su sitio. */
  function texto(ctx, t, op, antes = 0) {
    if (!op.texto || !String(op.texto).trim()) return null
    const { alto } = bloque(ctx, t, { ...op, y: 0, soloMedir: true })
    return { alto, antes, pintar: (y) => bloque(ctx, t, { ...op, y }) }
  }

  const totalDe = (piezas) =>
    piezas.filter((p) => p && p.alto > 0).reduce((s, p, i) => s + p.alto + (i ? p.antes : 0), 0)

  /**
   * Coloca las piezas una debajo de otra entre `arriba` y `abajo`: centradas,
   * o pegadas abajo con `pegar: "abajo"`. Las piezas vacias no ocupan sitio.
   */
  function columna(piezas, { arriba, abajo, pegar }) {
    const llenas = piezas.filter((p) => p && p.alto > 0)
    const total = totalDe(llenas)
    let y = pegar === "abajo" ? abajo - total : arriba + Math.max(0, (abajo - arriba - total) / 2)
    llenas.forEach((p, i) => {
      if (i) y += p.antes
      p.pintar(y)
      y += p.alto
    })
    return total
  }

  /**
   * Construye la columna con los cuerpos multiplicados por f, y lo baja hasta
   * que quepa: asi un texto largo se encoge en lugar de salirse.
   */
  function ajustar(construir, disponible) {
    let f = 1
    let piezas = construir(f)
    for (let i = 0; i < 8 && totalDe(piezas) > disponible; i++) {
      f *= 0.9
      piezas = construir(f)
    }
    return piezas
  }

  /** Las lineas no vacias de un campo de varias lineas, hasta `max`. */
  const lineasDe = (valor, max) =>
    String(valor || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, max)

  /** Parte "a | b | c" en sus trozos, sin espacios sobrantes. */
  const trozos = (linea) => linea.split("|").map((x) => x.trim())

  /** Foto de fondo oscurecida, o el fondo de la marca si no hay foto. */
  function fondoConFoto(ctx, t, R, campo, oscuro = 0.62, op = {}) {
    const f = R.medios[campo]
    if (!f) {
      fondo(ctx, R, { y: R.H * 0.45, ...op })
      return
    }
    medio(ctx, f.el, { x: 0, y: 0, w: R.W, h: R.H }, f.ajuste, avance(t, 0, R.duracion, LINEAL))
    ctx.fillStyle = `rgba(10, 10, 10, ${oscuro})`
    ctx.fillRect(0, 0, R.W, R.H)
    fondo(ctx, R, { y: R.H * 0.45, alfa: 0.35, soloResplandor: true, ...op })
  }

  /** Lo que ocupa la firma de abajo, si se pone. */
  const reservaFirma = (R) => (R.global.mostrarFirma ? M.ALTO_FIRMA + 48 : 0)

  // ---------- Textos con el estilo de la marca ----------

  /** Etiqueta pequeña en Cinzel y oro, encima de los titulares. */
  function ante(ctx, t, valor, o) {
    return texto(ctx, t, {
      texto: valor,
      tipo: "firma",
      peso: 600,
      tam: (o.tam ?? 34) * (o.f ?? 1),
      espaciado: 0.3,
      mayus: true,
      color: COLOR.oroSuave,
      x: o.x,
      ancho: o.ancho,
      alinear: o.alinear,
      entrada: "subir",
      inicio: o.inicio ?? 650,
    })
  }

  /** Titular en Anton, en oro metalico por defecto. */
  function titular(ctx, t, valor, o, antes = 24) {
    return texto(
      ctx,
      t,
      {
        texto: valor,
        tipo: "titular",
        tam: o.tam * (o.f ?? 1),
        min: o.min ?? 64,
        maxLineas: o.maxLineas ?? 3,
        interlinea: o.interlinea ?? 1.04,
        mayus: true,
        color: o.color ?? "oro",
        x: o.x,
        ancho: o.ancho,
        alinear: o.alinear,
        entrada: o.entrada ?? "asomar",
        inicio: o.inicio ?? 800,
        paso: o.paso ?? 120,
        dura: o.dura ?? 900,
        brilloEn: o.brillo,
      },
      antes,
    )
  }

  /** Parrafo en Archivo. */
  function parrafo(ctx, t, valor, o, antes = 34) {
    return texto(
      ctx,
      t,
      {
        texto: valor,
        tipo: "cuerpo",
        peso: o.peso ?? 500,
        tam: (o.tam ?? 44) * (o.f ?? 1),
        min: o.min ?? 28,
        maxLineas: o.maxLineas ?? 4,
        interlinea: o.interlinea ?? 1.3,
        color: o.color ?? COLOR.texto,
        x: o.x,
        ancho: o.ancho,
        alinear: o.alinear,
        entrada: o.entrada ?? "subir",
        inicio: o.inicio ?? 1700,
        paso: o.paso ?? 90,
      },
      antes,
    )
  }

  /** Boton con borde de oro, centrado en x. */
  function botonPieza(ctx, t, valor, o, antes = 56) {
    if (!valor || !String(valor).trim()) return null
    const tam = 32 * (o.f ?? 1)
    return {
      alto: tam * 3.6,
      antes: antes * (o.f ?? 1),
      pintar: (y) =>
        boton(ctx, t, {
          texto: valor,
          x: o.x,
          y,
          tam,
          inicio: o.inicio ?? 2700,
          anchoMax: o.ancho,
        }),
    }
  }

  /** Hueco fijo en la columna, para pintar algo propio. */
  const hueco = (alto, antes, pintar) => ({ alto, antes, pintar })

  // ---------- Adornos ----------

  /** Numero en un aro de oro que se traza. */
  function numeroEnAro(ctx, t, x, y, r, n, inicio) {
    const p = avance(t, inicio, 600, DENTRO_Y_FUERA)
    if (p <= 0) return
    ctx.save()
    const largo = 2 * Math.PI * r
    ctx.strokeStyle = M.oroLineal(ctx, x - r, y - r, x + r, y + r)
    ctx.lineWidth = 3
    ctx.setLineDash([largo, largo])
    ctx.lineDashOffset = largo * (1 - p)
    ctx.beginPath()
    ctx.arc(x, y, r, -Math.PI / 2, (3 * Math.PI) / 2)
    ctx.stroke()
    ctx.restore()
    bloque(ctx, t, {
      texto: String(n),
      tipo: "titular",
      tam: r * 1.05,
      interlinea: 1,
      color: "oro",
      x,
      y: y - (r * 1.05) / 2,
      ancho: r * 2,
      entrada: "aparecer",
      inicio: inicio + 250,
      dura: 500,
    })
  }

  /** Linea que crece desde la izquierda y se apaga hacia la derecha. */
  function rayaIzquierda(ctx, t, x, y, ancho, inicio, color) {
    const p = avance(t, inicio, 800, DENTRO_Y_FUERA)
    if (p <= 0) return
    const g = ctx.createLinearGradient(x, 0, x + ancho, 0)
    g.addColorStop(0, color || COLOR.oroSuave)
    g.addColorStop(1, "rgba(201, 162, 39, 0)")
    ctx.fillStyle = g
    ctx.fillRect(x, y - 1, ancho * p, 2)
  }

  /** Linea fina y uniforme que crece desde la izquierda: separa filas. */
  function separador(ctx, t, x, y, ancho, inicio) {
    const p = avance(t, inicio, 700, DENTRO_Y_FUERA)
    if (p <= 0) return
    ctx.fillStyle = "rgba(201, 162, 39, 0.28)"
    ctx.fillRect(x, y - 1, ancho * p, 2)
  }

  /** Escribe letra a letra con espaciado, sin kerning; devuelve el ancho. */
  function anchoEspaciado(ctx, texto, espacio) {
    const letras = Array.from(texto)
    return (
      letras.reduce((s, c) => s + ctx.measureText(c).width, 0) +
      espacio * Math.max(0, letras.length - 1)
    )
  }
  function escribirEspaciado(ctx, texto, x, y, espacio) {
    let cx = x
    Array.from(texto).forEach((c) => {
      ctx.fillText(c, cx, y)
      cx += ctx.measureText(c).width + espacio
    })
  }

  /** Etiqueta con fondo oscuro y borde de oro, para ir encima de una foto. */
  function pastilla(ctx, t, valor, x, y, alinear, inicio, tam = 28) {
    const a = avance(t, inicio, 700)
    if (a <= 0 || !valor) return
    ctx.save()
    ctx.globalAlpha *= a
    ctx.font = `700 ${tam}px ${M.FUENTE.cuerpo}`
    const mayus = valor.toUpperCase()
    const espacio = 0.24 * tam
    const ancho = anchoEspaciado(ctx, mayus, espacio)
    const h = tam * 2.3
    const w = ancho + h * 0.9
    const x0 = alinear === "der" ? x - w : x
    const dy = (1 - a) * 14
    ctx.fillStyle = "rgba(10, 10, 10, 0.72)"
    ctx.beginPath()
    ctx.roundRect(x0, y + dy, w, h, h / 2)
    ctx.fill()
    ctx.strokeStyle = "rgba(201, 162, 39, 0.6)"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = COLOR.oroSuave
    ctx.textBaseline = "middle"
    escribirEspaciado(ctx, mayus, x0 + h * 0.45, y + dy + h / 2 + 1, espacio)
    ctx.restore()
  }

  /** Mide una pildora (hora, dia...) para colocarlas antes de pintarlas. */
  function anchoPildora(ctx, valor, tam) {
    ctx.save()
    ctx.font = `700 ${tam}px ${M.FUENTE.cuerpo}`
    const w = ctx.measureText(valor).width + tam * 1.3
    ctx.restore()
    return w
  }

  /** Pildora con borde de oro. x es el borde izquierdo y y el centro. */
  function pildora(ctx, t, valor, x, y, tam, inicio, apagada = false) {
    const a = avance(t, inicio, 500)
    if (a <= 0) return
    ctx.save()
    const w = anchoPildora(ctx, valor, tam)
    const h = tam * 1.9
    const s = 0.85 + 0.15 * a
    ctx.globalAlpha *= a
    ctx.translate(x + w / 2, y)
    ctx.scale(s, s)
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2)
    ctx.fillStyle = apagada ? "rgba(255, 255, 255, 0.03)" : "rgba(201, 162, 39, 0.1)"
    ctx.fill()
    ctx.strokeStyle = apagada ? "rgba(138, 138, 133, 0.45)" : "rgba(224, 193, 88, 0.75)"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = `700 ${tam}px ${M.FUENTE.cuerpo}`
    ctx.fillStyle = apagada ? COLOR.tenue : COLOR.oroSuave
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(valor, 0, 2)
    if (apagada) {
      const tw = ctx.measureText(valor).width
      ctx.fillRect(-tw / 2, 0, tw, 2)
    }
    ctx.restore()
  }

  function estrella(ctx, x, y, r) {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const radio = i % 2 ? r * 0.45 : r
      const angulo = -Math.PI / 2 + (i * Math.PI) / 5
      ctx.lineTo(x + radio * Math.cos(angulo), y + radio * Math.sin(angulo))
    }
    ctx.closePath()
  }

  /** Luz calida redonda detras de algo que tiene que destacar. */
  function halo(ctx, t, x, y, radio, inicio, fuerza = 0.28) {
    const a = avance(t, inicio, 900)
    if (a <= 0) return
    const g = ctx.createRadialGradient(x, y, 0, x, y, radio)
    g.addColorStop(0, `rgba(224, 193, 88, ${fuerza * a})`)
    g.addColorStop(0.5, `rgba(201, 162, 39, ${fuerza * 0.35 * a})`)
    g.addColorStop(1, "rgba(201, 162, 39, 0)")
    ctx.fillStyle = g
    ctx.fillRect(x - radio, y - radio, radio * 2, radio * 2)
  }

  /** Foto en una tarjeta redondeada con borde de oro, o su hueco si no hay. */
  function tarjetaFoto(ctx, t, R, campo, caja, aviso, op = {}) {
    const a = avance(t, op.inicio ?? 0, 800)
    if (a <= 0) return
    const radio = op.radio ?? 24
    ctx.save()
    ctx.globalAlpha *= a
    ctx.beginPath()
    ctx.roundRect(caja.x, caja.y, caja.w, caja.h, radio)
    ctx.save()
    ctx.clip()
    if (op.barrido) {
      // Se descubre de izquierda a derecha.
      const p = avance(t, op.inicio, 900, DENTRO_Y_FUERA)
      ctx.beginPath()
      ctx.rect(caja.x, caja.y, caja.w * p, caja.h)
      ctx.clip()
    }
    const m = R.medios[campo]
    if (m) medio(ctx, m.el, caja, m.ajuste, avance(t, op.inicio ?? 0, R.duracion, LINEAL))
    else M.hueco(ctx, caja, aviso)
    ctx.restore()
    ctx.strokeStyle = "rgba(224, 193, 88, 0.65)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(caja.x, caja.y, caja.w, caja.h, radio)
    ctx.stroke()
    ctx.restore()
  }

  window.PIEZAS = {
    texto,
    columna,
    ajustar,
    totalDe,
    lineasDe,
    trozos,
    fondoConFoto,
    reservaFirma,
    ante,
    titular,
    parrafo,
    botonPieza,
    hueco,
    numeroEnAro,
    rayaIzquierda,
    separador,
    anchoEspaciado,
    escribirEspaciado,
    pastilla,
    anchoPildora,
    pildora,
    estrella,
    halo,
    tarjetaFoto,
  }
  window.PLANTILLAS = window.PLANTILLAS || []
})()
