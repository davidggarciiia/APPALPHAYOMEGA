/* global window, document, Path2D */
/**
 * Motor de dibujo del editor de plantillas: el mismo lenguaje que el logo
 * animado de la app, pintado en un canvas para poder exportarlo a video.
 *
 * Todo se dibuja en funcion del instante `t` (ms), sin reloj: el mismo `t` da
 * siempre el mismo fotograma. Asi la vista previa, la imagen y el video salen
 * iguales.
 *
 * El lienzo mide siempre 1080 de ancho; el alto depende del formato.
 */
;(function () {
  const TRAZOS = window.TRAZOS

  const COLOR = {
    fondo: "#0a0a0a",
    superficie: "#141414",
    borde: "#2a2413",
    oro: "#c9a227",
    oroSuave: "#e0c158",
    texto: "#f5f5f0",
    tenue: "#8a8a85",
  }

  /** Oro metalico del logo: bandas de luz y sombra en diagonal. */
  const ORO = [
    [0, "#f6e4a0"],
    [0.2, "#cfa136"],
    [0.38, "#f1d57e"],
    [0.55, "#b98b26"],
    [0.72, "#e6c463"],
    [0.88, "#a47b1d"],
    [1, "#d4ae52"],
  ]

  const FUENTE = {
    titular: '"Anton", "Archivo", sans-serif',
    firma: '"Cinzel", Georgia, serif',
    cuerpo: '"Archivo", "Helvetica Neue", Arial, sans-serif',
  }

  /** Inclinacion del rayo del logo respecto a la vertical. */
  const RAYO = (19 * Math.PI) / 180

  // ---------- Tiempo ----------

  /** Curva cubic-bezier de CSS, resuelta con Newton y biseccion de respaldo. */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx
    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by
    const X = (s) => ((ax * s + bx) * s + cx) * s
    const Y = (s) => ((ay * s + by) * s + cy) * s
    const dX = (s) => (3 * ax * s + 2 * bx) * s + cx
    return (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let s = x
      for (let i = 0; i < 8; i++) {
        const error = X(s) - x
        if (Math.abs(error) < 1e-6) return Y(s)
        const d = dX(s)
        if (Math.abs(d) < 1e-6) break
        s -= error / d
      }
      let bajo = 0
      let alto = 1
      s = x
      for (let i = 0; i < 40; i++) {
        if (X(s) < x) bajo = s
        else alto = s
        s = (bajo + alto) / 2
      }
      return Y(s)
    }
  }
  /** Salida fuerte: para lo que aparece. */
  const SALIDA = bezier(0.23, 1, 0.32, 1)
  /** Entrada y salida fuertes: para lo que se dibuja y lo que cruza. */
  const DENTRO_Y_FUERA = bezier(0.77, 0, 0.175, 1)
  const LINEAL = (x) => x

  /** Cuanto ha avanzado, de 0 a 1, algo que empieza en `inicio` y dura `dura`. */
  function avance(t, inicio, dura, curva = SALIDA) {
    if (t <= inicio) return 0
    if (t >= inicio + dura) return 1
    return curva((t - inicio) / dura)
  }
  const mezcla = (a, b, p) => a + (b - a) * p

  // ---------- Color ----------

  function oroLineal(ctx, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    ORO.forEach(([d, c]) => g.addColorStop(d, c))
    return g
  }

  /** Banda de luz que cruza en diagonal, centrada en (cx, cy). */
  function banda(ctx, cx, cy, medio, dx = 0.906, dy = 0.423, opacidad = 0.95) {
    const g = ctx.createLinearGradient(
      cx - dx * medio,
      cy - dy * medio,
      cx + dx * medio,
      cy + dy * medio,
    )
    g.addColorStop(0, "rgba(255, 246, 214, 0)")
    g.addColorStop(0.5, `rgba(255, 246, 214, ${opacidad})`)
    g.addColorStop(1, "rgba(255, 246, 214, 0)")
    return g
  }

  // ---------- Logo ----------

  const LOGO = {
    aros: TRAZOS.AROS.map((a) => ({ ...a, p: new Path2D(a.d) })),
    contornos: TRAZOS.CONTORNOS.map((c) => ({ ...c, p: new Path2D(c.d) })),
    rellenos: TRAZOS.RELLENOS.map((d) => new Path2D(d)),
    letras: TRAZOS.LETRAS.map((d) => new Path2D(d)),
    cantos: TRAZOS.CANTOS.map((d) => new Path2D(d)),
  }

  /**
   * El logo, construido como en la pantalla de carga de la app: los aros se
   * trazan, el contorno del emblema se dibuja y se llena de oro, TRAINING
   * aparece letra a letra, una banda de luz lo cruza y un destello recorre el
   * aro.
   *
   * op: x, y (centro), tam (lado), inicio, escala (alarga los tiempos),
   * partes { aros, emblema, letras }, estatico, brillo, brilloEn,
   * destellos [{ aro, inicio, periodo, sentido }], alfa.
   */
  function logo(ctx, t, op) {
    const k = op.escala ?? 1
    const t0 = op.inicio ?? 0
    const en = (ms) => t0 + ms * k
    const dura = (ms) => ms * k
    const estatico = Boolean(op.estatico)
    const partes = { aros: true, emblema: true, letras: true, ...op.partes }

    ctx.save()
    const base = ctx.globalAlpha * (op.alfa ?? 1)
    ctx.globalAlpha = base
    ctx.translate(op.x, op.y)
    const s = op.tam / 1200
    ctx.scale(s, s)
    const oro = oroLineal(ctx, -600, -600, 600, 600)
    ctx.lineCap = "butt"

    const trazo = (camino, largo, grosor, p, sentido, estilo) => {
      if (p <= 0) return
      ctx.lineWidth = grosor
      ctx.strokeStyle = estilo
      if (p < 1) {
        ctx.setLineDash([largo, largo])
        ctx.lineDashOffset = largo * sentido * (1 - p)
      } else {
        ctx.setLineDash([])
      }
      ctx.stroke(camino)
      ctx.setLineDash([])
    }

    if (partes.aros) {
      const sentidos = [1, -1, 1]
      const retrasos = [0, 60, 120]
      const duraciones = [600, 540, 540]
      LOGO.aros.forEach((aro, i) => {
        const p = estatico ? 1 : avance(t, en(retrasos[i]), dura(duraciones[i]), DENTRO_Y_FUERA)
        trazo(aro.p, aro.largo, aro.grosor, p, sentidos[i], oro)
      })
    }

    let llenado = 1
    if (partes.emblema) {
      if (!estatico) {
        const p = avance(t, en(120), dura(600), DENTRO_Y_FUERA)
        const queda = 1 - avance(t, en(620), dura(300))
        if (queda > 0) {
          ctx.globalAlpha = base * queda
          LOGO.contornos.forEach((c) => trazo(c.p, c.largo, 4, p, 1, oro))
        }
        llenado = avance(t, en(620), dura(300))
      }
      if (llenado > 0) {
        ctx.globalAlpha = base * llenado
        ctx.fillStyle = oro
        LOGO.rellenos.forEach((p) => ctx.fill(p, "evenodd"))
        // Sin esto, en oro liso el rayo y el arco del omega se funden.
        ctx.globalAlpha = base * llenado * 0.75
        ctx.strokeStyle = "#5c430d"
        ctx.lineWidth = 3
        LOGO.cantos.forEach((p) => ctx.stroke(p))
      }
    }

    if (partes.letras) {
      ctx.fillStyle = oro
      LOGO.letras.forEach((p, i) => {
        const a = estatico ? 1 : avance(t, en(700 + i * 30), dura(280))
        if (a <= 0) return
        ctx.globalAlpha = base * a
        ctx.fill(p, "evenodd")
      })
    }
    ctx.globalAlpha = base

    // Banda de luz: se vuelve a pintar el logo con un degradado que solo es
    // luz en una franja.
    if (op.brillo ?? !estatico) {
      const p = avance(t, op.brilloEn ?? en(900), dura(600), DENTRO_Y_FUERA)
      if (p > 0 && p < 1) {
        const c = mezcla(-1194, 806, p)
        const luz = banda(ctx, c, c, 150, 0.7071, 0.7071, 0.85)
        if (partes.aros) {
          ctx.strokeStyle = luz
          LOGO.aros.forEach((aro) => {
            ctx.lineWidth = aro.grosor
            ctx.stroke(aro.p)
          })
        }
        ctx.fillStyle = luz
        if (partes.emblema) LOGO.rellenos.forEach((q) => ctx.fill(q, "evenodd"))
        if (partes.letras) LOGO.letras.forEach((q) => ctx.fill(q, "evenodd"))
      }
    }

    // Destellos: dos tramos de luz, uno ancho y tenue y otro corto y vivo.
    ;(op.destellos || []).forEach((d) => {
      if (!partes.aros || t < d.inicio) return
      const aro = LOGO.aros[d.aro ?? 0]
      const L = aro.largo
      const fase = ((t - d.inicio) % d.periodo) / d.periodo
      const sentido = d.sentido ?? 1
      ctx.globalAlpha = base * avance(t, d.inicio, 200)
      ctx.lineWidth = aro.grosor
      ctx.setLineDash([L * 0.1, L * 0.9])
      ctx.lineDashOffset = -fase * L * sentido
      ctx.strokeStyle = "rgba(255, 244, 207, 0.28)"
      ctx.stroke(aro.p)
      ctx.setLineDash([L * 0.04, L * 0.96])
      ctx.lineDashOffset = -(0.03 * L + fase * L * sentido)
      ctx.strokeStyle = "rgba(255, 244, 207, 0.75)"
      ctx.stroke(aro.p)
      ctx.setLineDash([])
    })

    ctx.restore()
  }

  // ---------- Texto ----------

  function fuente(e, tam) {
    return `${e.peso || 400} ${tam}px ${FUENTE[e.tipo || "cuerpo"]}`
  }
  function anchoDe(ctx, linea, espacio) {
    return ctx.measureText(linea).width + espacio * Math.max(0, Array.from(linea).length - 1)
  }

  function partirEnLineas(ctx, texto, espacio, ancho) {
    const lineas = []
    texto.split("\n").forEach((parrafo) => {
      const palabras = parrafo.split(/\s+/).filter(Boolean)
      if (!palabras.length) return
      let actual = palabras[0]
      for (const palabra of palabras.slice(1)) {
        const prueba = `${actual} ${palabra}`
        if (anchoDe(ctx, prueba, espacio) <= ancho) {
          actual = prueba
        } else {
          lineas.push(actual)
          actual = palabra
        }
      }
      lineas.push(actual)
    })
    return lineas
  }

  const maquetas = new Map()

  /**
   * Parte el texto en lineas y, si se le da `min`, baja el cuerpo hasta que
   * quepa en `ancho` y en `maxLineas`. Se guarda: medir en cada fotograma es
   * lo que mas cuesta.
   */
  function maquetar(ctx, op) {
    const texto = (op.mayus ? (op.texto || "").toUpperCase() : op.texto || "").trim()
    const clave = [
      texto,
      op.tipo,
      op.peso,
      op.tam,
      op.min,
      op.maxLineas,
      op.ancho,
      op.espaciado,
    ].join("|")
    const guardada = maquetas.get(clave)
    if (guardada) return guardada
    ctx.save()
    let tam = op.tam
    let lineas = []
    for (;;) {
      ctx.font = fuente(op, tam)
      const espacio = (op.espaciado || 0) * tam
      lineas = texto ? partirEnLineas(ctx, texto, espacio, op.ancho) : []
      const cabe =
        lineas.every((l) => anchoDe(ctx, l, espacio) <= op.ancho + 0.5) &&
        (!op.maxLineas || lineas.length <= op.maxLineas)
      if (cabe || !op.min || tam <= op.min) break
      tam = Math.max(op.min, Math.floor(tam * 0.94))
    }
    ctx.font = fuente(op, tam)
    const espacio = (op.espaciado || 0) * tam
    // Titulares equilibrados: se busca el ancho mas estrecho que da las mismas
    // lineas, para que no quede una palabra sola abajo.
    if (lineas.length > 1 && (op.equilibrar ?? op.tipo === "titular")) {
      let bajo = op.ancho * 0.4
      let alto = op.ancho
      for (let i = 0; i < 12; i++) {
        const medio = (bajo + alto) / 2
        if (partirEnLineas(ctx, texto, espacio, medio).length > lineas.length) bajo = medio
        else alto = medio
      }
      lineas = partirEnLineas(ctx, texto, espacio, alto)
    }
    const medidas = lineas.map((l) => {
      const letras = Array.from(l)
      const x = []
      let prefijo = ""
      letras.forEach((c, i) => {
        x.push(ctx.measureText(prefijo).width + i * espacio)
        prefijo += c
      })
      return { texto: l, ancho: anchoDe(ctx, l, espacio), letras, x }
    })
    const alturaMayus = ctx.measureText("H").actualBoundingBoxAscent || tam * 0.72
    ctx.restore()
    const maqueta = { tam, lineas: medidas, alturaMayus, espacio }
    if (maquetas.size > 400) maquetas.clear()
    maquetas.set(clave, maqueta)
    return maqueta
  }

  /**
   * Un bloque de texto. Devuelve { alto }. Con `soloMedir` no pinta.
   *
   * op: texto, tipo (titular | firma | cuerpo), tam, min, maxLineas, peso,
   * espaciado (em), mayus, interlinea, x, y (arriba), ancho, alinear
   * (centro | izq | der), color ("oro" o un color), entrada (asomar | subir
   * | aparecer | letras | letras-asomar), inicio, dura, paso, brilloEn.
   */
  function bloque(ctx, t, op) {
    const m = maquetar(ctx, op)
    const lh = m.tam * (op.interlinea ?? 1.12)
    const alto = m.lineas.length * lh
    if (op.soloMedir || !m.lineas.length) return { alto, tam: m.tam }

    ctx.save()
    const base = ctx.globalAlpha
    ctx.font = fuente(op, m.tam)
    ctx.textBaseline = "alphabetic"
    const alinear = op.alinear || "centro"
    const lineas = m.lineas.map((l, i) => {
      const x = alinear === "izq" ? op.x : alinear === "der" ? op.x - l.ancho : op.x - l.ancho / 2
      const arriba = op.y + i * lh
      return { ...l, x0: x, arriba, base: arriba + (lh + m.alturaMayus) / 2 }
    })
    const bx = Math.min(...lineas.map((l) => l.x0))
    const bw = Math.max(...lineas.map((l) => l.x0 + l.ancho)) - bx

    const inicio = op.inicio ?? 0
    const dura = op.dura ?? 800
    const paso = op.paso ?? 120
    const entrada = op.entrada
    const subida = Math.min(44, m.tam * 0.35)

    const escribir = (l, dx, dy) => {
      if (m.espacio === 0) {
        ctx.fillText(l.texto, l.x0 + dx, l.base + dy)
      } else {
        l.letras.forEach((c, j) => ctx.fillText(c, l.x0 + l.x[j] + dx, l.base + dy))
      }
    }
    const recortar = (l) => {
      ctx.beginPath()
      ctx.rect(l.x0 - m.tam, l.arriba - m.tam * 0.3, l.ancho + m.tam * 2, lh + m.tam * 0.36)
      ctx.clip()
    }

    const pintar = (relleno) => {
      ctx.fillStyle = relleno
      let n = 0
      lineas.forEach((l, i) => {
        if (entrada === "letras" || entrada === "letras-asomar") {
          ctx.save()
          if (entrada === "letras-asomar") recortar(l)
          l.letras.forEach((c, j) => {
            const a = avance(t, inicio + n * paso, dura)
            n += 1
            if (a <= 0) return
            const dy = entrada === "letras-asomar" ? (1 - a) * lh * 1.1 : (1 - a) * subida
            ctx.globalAlpha = base * (entrada === "letras-asomar" ? 1 : a)
            ctx.fillText(c, l.x0 + l.x[j], l.base + dy)
          })
          ctx.restore()
          return
        }
        const a = entrada ? avance(t, inicio + i * paso, dura) : 1
        if (a <= 0) return
        ctx.save()
        if (entrada === "asomar") {
          recortar(l)
          escribir(l, 0, (1 - a) * lh * 1.1)
        } else {
          ctx.globalAlpha = base * a
          escribir(l, 0, entrada === "subir" ? (1 - a) * subida : 0)
        }
        ctx.restore()
      })
    }

    pintar(
      op.color === "oro" ? oroLineal(ctx, bx, op.y, bx + bw, op.y + alto) : op.color || COLOR.texto,
    )

    if (op.brilloEn != null) {
      const p = avance(t, op.brilloEn, 1100, DENTRO_Y_FUERA)
      if (p > 0 && p < 1) {
        pintar(
          banda(
            ctx,
            mezcla(bx - 0.35 * bw, bx + 1.35 * bw, p),
            op.y + alto / 2,
            Math.max(70, 0.18 * bw),
          ),
        )
      }
    }
    ctx.restore()
    return { alto, tam: m.tam }
  }

  // ---------- Piezas ----------

  /**
   * Fondo negro con el resplandor calido de las pantallas de la app. Con
   * `soloResplandor` pinta solo la luz, encima de lo que ya haya.
   */
  function fondo(ctx, R, op = {}) {
    if (!op.soloResplandor) {
      ctx.fillStyle = COLOR.fondo
      ctx.fillRect(0, 0, R.W, R.H)
    }
    const cx = op.x ?? R.W / 2
    const cy = op.y ?? R.H * 0.42
    const radio = op.radio ?? 820
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radio)
    g.addColorStop(0, `rgba(58, 42, 12, ${0.95 * (op.alfa ?? 1)})`)
    g.addColorStop(0.45, `rgba(42, 36, 19, ${0.45 * (op.alfa ?? 1)})`)
    g.addColorStop(1, "rgba(10, 10, 10, 0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, R.W, R.H)
  }

  /** Viñeta: oscurece los bordes para llevar la vista al centro. */
  function vineta(ctx, R) {
    const r = Math.max(R.W, R.H)
    const g = ctx.createRadialGradient(R.W / 2, R.H * 0.45, r * 0.35, R.W / 2, R.H * 0.45, r * 0.75)
    g.addColorStop(0, "rgba(0, 0, 0, 0)")
    g.addColorStop(1, "rgba(0, 0, 0, 0.5)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, R.W, R.H)
  }

  let teselaGrano = null
  /**
   * Grano fino y fijo. Da textura y evita que los degradados oscuros salgan a
   * escalones cuando Instagram o TikTok recomprimen el video.
   */
  function grano(ctx, R) {
    if (!teselaGrano) {
      teselaGrano = document.createElement("canvas")
      teselaGrano.width = 256
      teselaGrano.height = 256
      const g = teselaGrano.getContext("2d")
      const datos = g.createImageData(256, 256)
      let semilla = 11
      for (let i = 0; i < datos.data.length; i += 4) {
        semilla = (semilla * 16807) % 2147483647
        const v = semilla % 256
        datos.data[i] = v
        datos.data[i + 1] = v
        datos.data[i + 2] = v
        datos.data[i + 3] = 255
      }
      g.putImageData(datos, 0, 0)
    }
    ctx.save()
    ctx.globalCompositeOperation = "overlay"
    ctx.globalAlpha = 0.07
    ctx.fillStyle = ctx.createPattern(teselaGrano, "repeat")
    ctx.fillRect(0, 0, R.W, R.H)
    ctx.restore()
  }

  /** Linea fina de oro que se abre desde el centro. */
  function raya(ctx, t, op) {
    const p = avance(t, op.inicio ?? 0, op.dura ?? 800, DENTRO_Y_FUERA)
    if (p <= 0) return
    const medio = (op.ancho / 2) * p
    const g = ctx.createLinearGradient(op.x - op.ancho / 2, 0, op.x + op.ancho / 2, 0)
    g.addColorStop(0, "rgba(201, 162, 39, 0)")
    g.addColorStop(0.5, COLOR.oroSuave)
    g.addColorStop(1, "rgba(201, 162, 39, 0)")
    ctx.fillStyle = g
    ctx.fillRect(op.x - medio, op.y - 1, medio * 2, 2)
  }

  /** Desplazamiento horizontal del rayo entre el centro y los bordes. */
  function inclinacion(R) {
    return (R.H / 2) * Math.tan(RAYO)
  }

  /** Recorta a la izquierda (lado = -1) o a la derecha (1) de la linea del rayo en x. */
  function recorteRayo(ctx, R, x, lado = -1) {
    const d = inclinacion(R)
    ctx.beginPath()
    if (lado < 0) {
      ctx.moveTo(-10, -10)
      ctx.lineTo(x + d, -10)
      ctx.lineTo(x - d, R.H + 10)
      ctx.lineTo(-10, R.H + 10)
    } else {
      ctx.moveTo(x + d, -10)
      ctx.lineTo(R.W + 10, -10)
      ctx.lineTo(R.W + 10, R.H + 10)
      ctx.lineTo(x - d, R.H + 10)
    }
    ctx.closePath()
    ctx.clip()
  }

  /** La linea de luz del rayo, con su resplandor, centrada en x. */
  function pintarRayo(ctx, R, x, alfa = 1) {
    ctx.save()
    ctx.globalAlpha *= alfa
    ctx.translate(x, R.H / 2)
    ctx.rotate(RAYO)
    const largo = R.H * 1.15
    const g = ctx.createLinearGradient(0, -largo / 2, 0, largo / 2)
    g.addColorStop(0, "rgba(255, 246, 214, 0)")
    g.addColorStop(0.28, "#fff6d6")
    g.addColorStop(0.5, "#f1d57e")
    g.addColorStop(0.72, "#fff6d6")
    g.addColorStop(1, "rgba(255, 246, 214, 0)")
    ctx.beginPath()
    ctx.moveTo(0, -largo / 2)
    ctx.lineTo(8, 0)
    ctx.lineTo(0, largo / 2)
    ctx.lineTo(-8, 0)
    ctx.closePath()
    ctx.fillStyle = g
    ctx.shadowColor = "rgba(201, 162, 39, 0.8)"
    ctx.shadowBlur = 44
    ctx.fill()
    ctx.shadowColor = "rgba(255, 214, 110, 0.95)"
    ctx.shadowBlur = 16
    ctx.fill()
    ctx.restore()
  }

  /**
   * El tajo: el rayo cruza la pantalla de izquierda a derecha y deja detras la
   * escena. `dibujarEscena` pinta la escena; queda recortada a la izquierda del
   * rayo mientras cruza.
   */
  function tajo(ctx, t, R, inicio, dibujarEscena) {
    const p = avance(t, inicio, 700, DENTRO_Y_FUERA)
    const d = inclinacion(R)
    const x = mezcla(-d - 80, R.W + d + 80, p)
    if (p >= 1) {
      dibujarEscena()
      return
    }
    if (p > 0) {
      ctx.save()
      recorteRayo(ctx, R, x, -1)
      dibujarEscena()
      ctx.restore()
      pintarRayo(ctx, R, x)
    }
  }

  /** Foto o video encajado en una caja, cubriendola. Con `kb` se acerca despacio. */
  function medio(ctx, fuenteMedio, caja, ajuste = {}, kb = 0) {
    const ancho = fuenteMedio.videoWidth || fuenteMedio.naturalWidth || fuenteMedio.width
    const alto = fuenteMedio.videoHeight || fuenteMedio.naturalHeight || fuenteMedio.height
    if (!ancho || !alto) return
    const zoom = (ajuste.zoom ?? 1) * (1 + 0.07 * kb)
    const escala = Math.max(caja.w / ancho, caja.h / alto) * zoom
    const w = ancho * escala
    const h = alto * escala
    const x = caja.x + (caja.w - w) * (ajuste.x ?? 0.5)
    const y = caja.y + (caja.h - h) * (ajuste.y ?? 0.5)
    ctx.save()
    ctx.beginPath()
    ctx.rect(caja.x, caja.y, caja.w, caja.h)
    ctx.clip()
    ctx.drawImage(fuenteMedio, x, y, w, h)
    ctx.restore()
  }

  /** Hueco para una foto que aun no se ha subido. `alto` coloca el aviso (0 arriba, 1 abajo). */
  function hueco(ctx, caja, texto, alto = 0.5) {
    ctx.save()
    ctx.fillStyle = "#121210"
    ctx.fillRect(caja.x, caja.y, caja.w, caja.h)
    const cx = caja.x + caja.w / 2
    const cy = caja.y + caja.h * alto
    const r = Math.min(caja.w, caja.h) * 0.16
    ctx.strokeStyle = "rgba(201, 162, 39, 0.45)"
    ctx.lineWidth = 3
    ctx.setLineDash([12, 12])
    ctx.beginPath()
    ctx.arc(cx, cy - 30, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.35, cy - 30)
    ctx.lineTo(cx + r * 0.35, cy - 30)
    ctx.moveTo(cx, cy - 30 - r * 0.35)
    ctx.lineTo(cx, cy - 30 + r * 0.35)
    ctx.stroke()
    ctx.fillStyle = COLOR.tenue
    ctx.font = fuente({ tipo: "cuerpo", peso: 500 }, 34)
    ctx.textAlign = "center"
    ctx.fillText(texto, cx, cy + r + 30)
    ctx.restore()
  }

  /** Sombra vertical para que el texto se lea sobre una foto. */
  function sombra(ctx, R, desde, hasta, alfa) {
    const g = ctx.createLinearGradient(0, desde, 0, hasta)
    g.addColorStop(0, "rgba(10, 10, 10, 0)")
    g.addColorStop(1, `rgba(10, 10, 10, ${alfa})`)
    ctx.fillStyle = g
    ctx.fillRect(0, Math.min(desde, hasta), R.W, Math.abs(hasta - desde))
    ctx.fillStyle = `rgba(10, 10, 10, ${alfa})`
    if (hasta > desde) ctx.fillRect(0, hasta, R.W, R.H - hasta)
    else ctx.fillRect(0, 0, R.W, hasta)
  }

  /**
   * Boton con borde de oro que se dibuja, y un destello que lo recorre. x es el
   * centro y y la parte de arriba. Devuelve su alto.
   */
  function boton(ctx, t, op) {
    const e = { tipo: "cuerpo", peso: 700, espaciado: 0.2, mayus: true }
    const tam = op.tam ?? 32
    ctx.save()
    ctx.font = fuente(e, tam)
    const texto = (op.texto || "").toUpperCase()
    const espacio = e.espaciado * tam
    const anchoTexto = anchoDe(ctx, texto, espacio)
    const h = tam * 3.6
    const w = Math.min(op.anchoMax ?? 900, anchoTexto + tam * 3.4)
    const x = op.x - w / 2
    const y = op.y
    const perimetro = 2 * (w - h) + Math.PI * h
    const camino = new Path2D()
    camino.roundRect(x, y, w, h, h / 2)

    const inicio = op.inicio ?? 0
    const lleno = avance(t, inicio + 500, 600)
    ctx.fillStyle = `rgba(201, 162, 39, ${0.1 * lleno})`
    ctx.fill(camino)

    const p = avance(t, inicio, 1000, DENTRO_Y_FUERA)
    if (p > 0) {
      ctx.strokeStyle = oroLineal(ctx, x, y, x + w, y + h)
      ctx.lineWidth = 4
      ctx.setLineDash([perimetro, perimetro])
      ctx.lineDashOffset = perimetro * (1 - p)
      ctx.stroke(camino)
      ctx.setLineDash([])
    }
    const brilla = inicio + 1100
    if (t > brilla) {
      const fase = ((t - brilla) % 2400) / 2400
      ctx.globalAlpha = avance(t, brilla, 200)
      ctx.strokeStyle = "rgba(255, 244, 207, 0.9)"
      ctx.lineWidth = 5
      ctx.setLineDash([perimetro * 0.06, perimetro * 0.94])
      ctx.lineDashOffset = -fase * perimetro
      ctx.shadowColor = "rgba(255, 230, 160, 0.9)"
      ctx.shadowBlur = 10
      ctx.stroke(camino)
      ctx.setLineDash([])
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }
    const a = avance(t, inicio + 450, 700)
    ctx.globalAlpha = a
    ctx.fillStyle = COLOR.oroSuave
    ctx.textBaseline = "middle"
    let cx = op.x - anchoTexto / 2
    const dy = (1 - a) * 12
    for (const c of Array.from(texto)) {
      ctx.fillText(c, cx, y + h / 2 + dy + 1)
      cx += ctx.measureText(c).width + espacio
    }
    ctx.restore()
    return h
  }

  /**
   * La firma de abajo: el logo pequeño y el nombre de la cuenta. Queda justo
   * encima de lo que tapan los botones de cada red. Devuelve el alto que ocupa.
   */
  const ALTO_FIRMA = 64
  function firma(ctx, t, R, inicio) {
    if (!R.global.mostrarFirma) return 0
    const texto = (R.global.firma || "Alpha & Omega Training").toUpperCase()
    const e = { tipo: "firma", peso: 600 }
    const tam = 25
    ctx.save()
    ctx.font = fuente(e, tam)
    const espacio = 0.24 * tam
    const anchoTexto = Math.min(
      anchoDe(ctx, texto, espacio),
      R.W - 2 * R.zona.lado - ALTO_FIRMA - 22,
    )
    const total = ALTO_FIRMA + 22 + anchoTexto
    const x0 = R.W / 2 - total / 2
    const cy = R.zona.abajo - ALTO_FIRMA / 2
    const a = avance(t, inicio, 900)
    ctx.globalAlpha = a
    logo(ctx, t, { x: x0 + ALTO_FIRMA / 2, y: cy, tam: ALTO_FIRMA, estatico: true, brillo: false })
    ctx.fillStyle = COLOR.oroSuave
    ctx.textBaseline = "middle"
    let x = x0 + ALTO_FIRMA + 22 + (1 - a) * 16
    for (const c of Array.from(texto)) {
      ctx.fillText(c, x, cy + 2)
      x += ctx.measureText(c).width + espacio
    }
    ctx.restore()
    return ALTO_FIRMA + 48
  }

  window.MOTOR = {
    COLOR,
    SALIDA,
    DENTRO_Y_FUERA,
    LINEAL,
    avance,
    mezcla,
    oroLineal,
    banda,
    logo,
    maquetar,
    bloque,
    fondo,
    vineta,
    grano,
    raya,
    inclinacion,
    recorteRayo,
    pintarRayo,
    tajo,
    medio,
    hueco,
    sombra,
    boton,
    firma,
    ALTO_FIRMA,
    FUENTE,
  }
})()
