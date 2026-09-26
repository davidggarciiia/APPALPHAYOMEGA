/* global window */
/**
 * Plantillas pensadas para terminar en Instagram: dejan un hueco marcado con
 * esquinas de oro donde se pone, con las herramientas de la propia app, el
 * texto (Aa), una foto (sticker de foto) o un sticker de preguntas, encuesta,
 * cuenta atras o enlace. Quien las usa no necesita nada mas que Instagram.
 *
 * Tambien estan aqui las que salen ya terminadas: plazas con su numero y las
 * portadas de reels y carruseles.
 */
;(function () {
  const M = window.MOTOR
  const P = window.PIEZAS
  const { avance, COLOR, DENTRO_Y_FUERA } = M

  /** Esquinas de visor: marcan un hueco sin encerrarlo. Crecen desde cada esquina. */
  function esquinas(ctx, t, caja, inicio, largo = 64) {
    const p = avance(t, inicio, 700, DENTRO_Y_FUERA)
    if (p <= 0) return
    const { x, y, w, h } = caja
    const l = Math.min(largo, w / 3, h / 3) * p
    ctx.save()
    ctx.strokeStyle = M.oroLineal(ctx, x, y, x + w, y + h)
    ctx.lineWidth = 5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(x, y + l)
    ctx.lineTo(x, y)
    ctx.lineTo(x + l, y)
    ctx.moveTo(x + w - l, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + l)
    ctx.moveTo(x + w, y + h - l)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x + w - l, y + h)
    ctx.moveTo(x + l, y + h)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + h - l)
    ctx.stroke()
    ctx.restore()
  }

  /** Icono de camara tenue: aqui va una foto. */
  function camara(ctx, cx, cy) {
    ctx.save()
    ctx.strokeStyle = "rgba(224, 193, 88, 0.4)"
    ctx.lineWidth = 4
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.roundRect(cx - 48, cy - 30, 96, 68, 12)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy + 4, 18, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 20, cy - 30)
    ctx.lineTo(cx - 12, cy - 43)
    ctx.lineTo(cx + 12, cy - 43)
    ctx.lineTo(cx + 20, cy - 30)
    ctx.stroke()
    ctx.restore()
  }

  /** El hueco: un velo muy suave y las esquinas. Con `foto`, el icono de camara. */
  function hueco(ctx, t, caja, inicio, op = {}) {
    const a = avance(t, inicio, 700)
    if (a <= 0) return
    ctx.save()
    ctx.globalAlpha *= a
    ctx.fillStyle = "rgba(255, 246, 214, 0.035)"
    ctx.beginPath()
    ctx.roundRect(caja.x, caja.y, caja.w, caja.h, 26)
    ctx.fill()
    if (op.foto) camara(ctx, caja.x + caja.w / 2, caja.y + caja.h / 2)
    ctx.restore()
    esquinas(ctx, t, caja, inicio + 120)
  }

  /** Tres flechas que laten hacia abajo: señalan donde va el sticker. */
  function flechas(ctx, t, x, y, inicio) {
    const a = avance(t, inicio, 600)
    if (a <= 0) return
    ctx.save()
    ctx.lineWidth = 7
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (let k = 0; k < 3; k++) {
      const fase = (t - inicio) / 1500 - k * 0.2
      const luz = 0.25 + 0.75 * Math.max(0, Math.sin(2 * Math.PI * fase))
      ctx.strokeStyle = `rgba(224, 193, 88, ${a * luz})`
      ctx.beginPath()
      ctx.moveTo(x - 44, y + k * 44)
      ctx.lineTo(x, y + k * 44 + 36)
      ctx.lineTo(x + 44, y + k * 44)
      ctx.stroke()
    }
    ctx.restore()
  }

  /** Fila de estrellas doradas centrada en x. Devuelve su alto. */
  function estrellas(ctx, t, x, y, n, r, inicio) {
    const separacion = r * 0.6
    const total = n * 2 * r + (n - 1) * separacion
    for (let i = 0; i < n; i++) {
      const cx = x - total / 2 + r + i * (2 * r + separacion)
      const a = avance(t, inicio + i * 110, 500)
      if (a <= 0) continue
      ctx.save()
      ctx.globalAlpha *= a
      P.estrella(ctx, cx, y + r + (1 - a) * 10, r)
      ctx.fillStyle = M.oroLineal(ctx, cx - r, y, cx + r, y + 2 * r)
      ctx.fill()
      ctx.restore()
    }
    return 2 * r
  }

  /** Rayos de celebracion que salen de un punto y se apagan. */
  function estallido(ctx, t, x, y, r0, inicio) {
    const p = avance(t, inicio, 900)
    const apaga = 1 - avance(t, inicio + 700, 1300)
    if (p <= 0 || apaga <= 0) return
    ctx.save()
    ctx.strokeStyle = M.oroLineal(ctx, x - r0 * 2, y - r0 * 2, x + r0 * 2, y + r0 * 2)
    ctx.lineCap = "round"
    ctx.globalAlpha *= apaga
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2
      const largo = r0 * (0.35 + (i % 3) * 0.18)
      const desde = r0 + p * r0 * 0.25
      const hasta = desde + largo * p
      ctx.lineWidth = i % 2 ? 3 : 5
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(ang) * desde, y + Math.sin(ang) * desde)
      ctx.lineTo(x + Math.cos(ang) * hasta, y + Math.sin(ang) * hasta)
      ctx.stroke()
    }
    ctx.restore()
  }

  /**
   * Cabecera de historia: etiqueta, titular y texto, pegados arriba de la zona
   * segura. Devuelve donde acaba.
   */
  function cabecera(ctx, t, R, d, o = {}) {
    const x = o.alinear === "izq" ? R.zona.lado : R.W / 2
    const ancho = R.W - 2 * R.zona.lado
    const piezas = [
      P.ante(ctx, t, d.antetitulo, { x, ancho, alinear: o.alinear, inicio: 600 }),
      P.titular(
        ctx,
        t,
        d.titular,
        {
          x,
          ancho,
          alinear: o.alinear,
          tam: o.tam ?? 150,
          maxLineas: o.maxLineas ?? 2,
          inicio: 750,
          brillo: 1900,
          color: o.color,
        },
        20,
      ),
      P.parrafo(
        ctx,
        t,
        d.texto,
        { x, ancho, alinear: o.alinear, tam: 40, inicio: 1300, maxLineas: 3 },
        22,
      ),
    ]
    const arriba = R.zona.arriba + (o.margen ?? 10)
    const alto = P.totalDe(piezas)
    P.columna(piezas, { arriba, abajo: arriba + alto })
    return arriba + alto
  }

  const abajoUtil = (R) => R.zona.abajo - P.reservaFirma(R)

  // ---------------------------------------------------------------------------

  /** Cabecera y un hueco grande debajo, para texto, una foto o un sticker. */
  const conHueco = {
    id: "hueco",
    grupo: "instagram",
    nombre: "Historia con hueco",
    resumen: "Titular arriba y un hueco para escribir o poner un sticker en Instagram.",
    campos: [
      { id: "antetitulo", tipo: "texto", etiqueta: "Encima", ejemplo: "Hoy" },
      { id: "titular", tipo: "area", etiqueta: "Titular", ejemplo: "Consejo del día" },
      { id: "texto", tipo: "area", etiqueta: "Texto", ejemplo: "" },
      {
        id: "hueco",
        tipo: "texto",
        etiqueta: "Hueco: texto, foto, sticker o record",
        ejemplo: "texto",
      },
      { id: "estrellas", tipo: "texto", etiqueta: "Estrellas (0 a 5)", ejemplo: "0" },
    ],
    duracion: () => 7000,
    dibujar(ctx, t, R) {
      const d = R.datos
      const tipo = d.hueco || "texto"
      M.tajo(ctx, t, R, 0, () => {
        M.fondo(ctx, R, { y: R.H * 0.28 })
        let y = cabecera(ctx, t, R, d, { tam: 130 })
        const n = Math.max(0, Math.min(5, Number(d.estrellas) || 0))
        if (n) {
          y += 40
          y += estrellas(ctx, t, R.W / 2, y, n, 30, 1500)
        }
        const caja = {
          x: R.zona.lado,
          y: y + 60,
          w: R.W - 2 * R.zona.lado,
          h: abajoUtil(R) - 40 - (y + 60),
        }
        if (tipo === "sticker") {
          flechas(ctx, t, R.W / 2, y + 70, 1800)
        } else if (tipo === "record") {
          const cx = R.W / 2
          const cy = caja.y + caja.h / 2
          P.halo(ctx, t, cx, cy, caja.w * 0.55, 1500, 0.22)
          estallido(ctx, t, cx, cy, Math.min(caja.w, caja.h) * 0.32, 1700)
          hueco(ctx, t, caja, 1700, { foto: true })
        } else {
          hueco(ctx, t, caja, 1700, { foto: tipo === "foto" })
        }
        M.firma(ctx, t, R, 2200)
      })
    },
  }

  // ---------------------------------------------------------------------------

  /** Cambio fisico: dos huecos para las fotos de antes y despues. */
  const fotos = {
    id: "fotos",
    grupo: "instagram",
    nombre: "Antes y después con huecos",
    resumen: "Dos huecos para poner las fotos con el sticker de foto de Instagram.",
    campos: [
      { id: "antetitulo", tipo: "texto", etiqueta: "Encima", ejemplo: "Resultados" },
      { id: "titular", tipo: "texto", etiqueta: "Titular", ejemplo: "Cambio físico" },
      { id: "izquierda", tipo: "texto", etiqueta: "Etiqueta izquierda", ejemplo: "Antes" },
      { id: "derecha", tipo: "texto", etiqueta: "Etiqueta derecha", ejemplo: "Después" },
    ],
    duracion: () => 7000,
    dibujar(ctx, t, R) {
      const d = R.datos
      M.tajo(ctx, t, R, 0, () => {
        M.fondo(ctx, R, { y: R.H * 0.3 })
        const y = cabecera(ctx, t, R, d, { tam: 140, maxLineas: 1 })
        const ancho = R.W - 2 * R.zona.lado
        const separacion = 24
        const w = (ancho - separacion) / 2
        const arribaEtiquetas = y + 50
        const arribaFotos = arribaEtiquetas + 104
        // Debajo de las fotos queda sitio para escribir el resultado.
        const libre = R.vertical ? 230 : 150
        const h = Math.min(w * 1.55, abajoUtil(R) - libre - arribaFotos)
        ;[
          [R.zona.lado, d.izquierda, 1500],
          [R.zona.lado + w + separacion, d.derecha, 1900],
        ].forEach(([x, etiqueta, inicio]) => {
          hueco(ctx, t, { x, y: arribaFotos, w, h }, inicio, { foto: true })
          if (etiqueta) {
            ctx.save()
            ctx.font = `700 28px ${M.FUENTE.cuerpo}`
            const ancho = P.anchoEspaciado(ctx, etiqueta.toUpperCase(), 0.24 * 28) + 28 * 2.3 * 0.9
            ctx.restore()
            P.pastilla(
              ctx,
              t,
              etiqueta,
              x + w / 2 - ancho / 2,
              arribaEtiquetas,
              "izq",
              inicio - 200,
            )
          }
        })
        M.firma(ctx, t, R, 2400)
      })
    },
  }

  // ---------------------------------------------------------------------------

  /** Dias de la semana con una linea al lado para escribir las horas. */
  const semana = {
    id: "semana",
    grupo: "instagram",
    nombre: "Huecos de la semana",
    resumen: "Los días con una línea al lado para escribir las horas en Instagram.",
    campos: [
      { id: "antetitulo", tipo: "texto", etiqueta: "Encima", ejemplo: "Reservas" },
      { id: "titular", tipo: "area", etiqueta: "Titular", ejemplo: "Huecos esta semana" },
      {
        id: "dias",
        tipo: "area",
        etiqueta: "Días (uno por línea)",
        ejemplo: "Lunes\nMartes\nMiércoles\nJueves\nViernes\nSábado",
      },
      {
        id: "pie",
        tipo: "texto",
        etiqueta: "Debajo",
        ejemplo: "Escríbeme por privado para reservar.",
      },
    ],
    duracion: () => 7000,
    dibujar(ctx, t, R) {
      const d = R.datos
      const dias = P.lineasDe(d.dias, 7)
      M.tajo(ctx, t, R, 0, () => {
        M.fondo(ctx, R, { x: R.W * 0.3, y: R.H * 0.28 })
        const y = cabecera(ctx, t, R, d, { tam: 130, alinear: "izq" })
        const x = R.zona.lado
        const ancho = R.W - 2 * R.zona.lado
        const pie = P.parrafo(ctx, t, d.pie, {
          x,
          ancho,
          alinear: "izq",
          tam: 36,
          color: COLOR.tenue,
          inicio: 2600,
        })
        const altoPie = pie ? pie.alto + 40 : 0
        const arriba = y + 60
        const abajo = abajoUtil(R) - altoPie
        const fila = Math.min(150, (abajo - arriba) / Math.max(1, dias.length))
        dias.forEach((dia, i) => {
          const centro = arriba + fila * (i + 0.5)
          const inicio = 1400 + i * 160
          M.bloque(ctx, t, {
            texto: dia,
            tipo: "titular",
            tam: Math.min(62, fila * 0.46),
            mayus: true,
            interlinea: 1.1,
            color: COLOR.texto,
            x,
            y: centro - Math.min(62, fila * 0.46) * 0.55,
            ancho: ancho * 0.4,
            alinear: "izq",
            entrada: "asomar",
            inicio,
            dura: 700,
          })
          P.separador(
            ctx,
            t,
            x + ancho * 0.36,
            centro + Math.min(62, fila * 0.46) * 0.4,
            ancho * 0.64,
            inicio + 150,
          )
        })
        if (pie) pie.pintar(abajo + 40)
        M.firma(ctx, t, R, 2600)
      })
    },
  }

  // ---------------------------------------------------------------------------

  /** Mito arriba, realidad abajo, cada uno con su hueco para escribir. */
  const mito = {
    id: "mito",
    grupo: "instagram",
    nombre: "Mito o realidad",
    resumen: "Dos huecos: arriba el mito y abajo la realidad.",
    campos: [
      { id: "arriba", tipo: "texto", etiqueta: "Arriba", ejemplo: "Mito" },
      { id: "abajo", tipo: "texto", etiqueta: "Abajo", ejemplo: "Realidad" },
    ],
    duracion: () => 7000,
    dibujar(ctx, t, R) {
      const d = R.datos
      M.tajo(ctx, t, R, 0, () => {
        M.fondo(ctx, R, { y: R.H * 0.62 })
        const x = R.zona.lado
        const ancho = R.W - 2 * R.zona.lado
        const arriba = R.zona.arriba + 10
        const abajo = abajoUtil(R)
        const mitad = (arriba + abajo) / 2
        const tam = R.vertical ? 130 : 110
        const etiqueta = (valor, y, color, inicio) =>
          M.bloque(ctx, t, {
            texto: valor,
            tipo: "titular",
            tam,
            mayus: true,
            interlinea: 1.05,
            color,
            x,
            y,
            ancho,
            alinear: "izq",
            entrada: "asomar",
            inicio,
            dura: 900,
            brilloEn: color === "oro" ? inicio + 1000 : undefined,
          }).alto
        const a1 = etiqueta(d.arriba, arriba, COLOR.tenue, 700)
        hueco(
          ctx,
          t,
          { x, y: arriba + a1 + 24, w: ancho, h: mitad - 50 - (arriba + a1 + 24) },
          1300,
        )
        M.raya(ctx, t, { x: R.W / 2, y: mitad, ancho: ancho * 0.7, inicio: 1700 })
        const a2 = etiqueta(d.abajo, mitad + 50, "oro", 2000)
        hueco(
          ctx,
          t,
          { x, y: mitad + 50 + a2 + 24, w: ancho, h: abajo - 30 - (mitad + 50 + a2 + 24) },
          2500,
        )
        M.firma(ctx, t, R, 2800)
      })
    },
  }

  // ---------------------------------------------------------------------------

  /** Plazas con su numero: "Quedan 3 plazas", con un punto que brilla por plaza. */
  const plazas = {
    id: "plazas",
    grupo: "captar",
    nombre: "Quedan plazas",
    resumen: "El número de plazas libres en grande, con un punto por plaza.",
    campos: [
      { id: "antetitulo", tipo: "texto", etiqueta: "Encima", ejemplo: "Entrenamiento personal" },
      { id: "antes", tipo: "texto", etiqueta: "Antes del número", ejemplo: "Quedan" },
      { id: "numero", tipo: "texto", etiqueta: "Número", ejemplo: "3" },
      { id: "despues", tipo: "texto", etiqueta: "Después del número", ejemplo: "Plazas" },
      { id: "boton", tipo: "texto", etiqueta: "Botón", ejemplo: "Escríbeme por privado" },
    ],
    duracion: () => 7000,
    dibujar(ctx, t, R) {
      const d = R.datos
      const n = parseInt(d.numero, 10)
      const puntos = Number.isFinite(n) && n > 0 && n <= 12 ? n : 0
      M.tajo(ctx, t, R, 0, () => {
        M.fondo(ctx, R, { y: R.H * 0.45 })
        const x = R.W / 2
        const ancho = R.W - 2 * R.zona.lado
        const abajo = abajoUtil(R)
        const piezas = P.ajustar((f) => {
          const numero = P.titular(
            ctx,
            t,
            d.numero,
            {
              x,
              ancho,
              f,
              tam: R.vertical ? 440 : 330,
              min: 160,
              maxLineas: 1,
              interlinea: 0.98,
              entrada: "letras-asomar",
              paso: 80,
              inicio: 1000,
              brillo: 2300,
            },
            6,
          )
          if (numero) {
            const pintar = numero.pintar
            numero.pintar = (y) => {
              P.halo(ctx, t, x, y + numero.alto / 2, numero.alto * 0.9, 1000, 0.3)
              pintar(y)
            }
          }
          const r = 22 * f
          const separacion = 20 * f
          return [
            P.ante(ctx, t, d.antetitulo, { x, ancho, f, inicio: 600 }),
            P.titular(
              ctx,
              t,
              d.antes,
              { x, ancho, f, tam: 120, maxLineas: 1, color: COLOR.texto, inicio: 800 },
              30,
            ),
            numero,
            P.titular(
              ctx,
              t,
              d.despues,
              { x, ancho, f, tam: 120, maxLineas: 1, color: COLOR.texto, inicio: 1300 },
              0,
            ),
            puntos
              ? P.hueco(r * 2, 44 * f, (y) => {
                  const total = puntos * 2 * r + (puntos - 1) * separacion
                  for (let i = 0; i < puntos; i++) {
                    const cx = x - total / 2 + r + i * (2 * r + separacion)
                    const a = avance(t, 1900 + i * 140, 500)
                    if (a <= 0) continue
                    const pulso =
                      0.75 + 0.25 * Math.sin(((t - 1900) / 1600) * 2 * Math.PI - i * 0.5)
                    ctx.save()
                    ctx.globalAlpha *= a
                    const g = ctx.createRadialGradient(cx, y + r, 0, cx, y + r, r * 2.2)
                    g.addColorStop(0, `rgba(255, 230, 160, ${0.45 * pulso})`)
                    g.addColorStop(1, "rgba(255, 230, 160, 0)")
                    ctx.fillStyle = g
                    ctx.fillRect(cx - r * 2.2, y + r - r * 2.2, r * 4.4, r * 4.4)
                    ctx.beginPath()
                    ctx.arc(cx, y + r, r * (0.6 + 0.4 * a), 0, Math.PI * 2)
                    ctx.fillStyle = M.oroLineal(ctx, cx - r, y, cx + r, y + 2 * r)
                    ctx.fill()
                    ctx.restore()
                  }
                })
              : null,
            P.botonPieza(ctx, t, d.boton, { x, ancho, f, inicio: 2500 }, 64),
          ]
        }, abajo - R.zona.arriba)
        P.columna(piezas, { arriba: R.zona.arriba, abajo })
        M.firma(ctx, t, R, 2800)
      })
    },
  }

  // ---------------------------------------------------------------------------

  /**
   * Portada de reel o de carrusel: la palabra del tema en grande y el rayo
   * cruzando detras. En la cuadricula del perfil Instagram enseña el centro,
   * asi que todo va en el medio.
   */
  const portada = {
    id: "portada",
    grupo: "instagram",
    nombre: "Portada",
    resumen: "Portada de reel o de carrusel con el tema en grande.",
    campos: [
      { id: "antetitulo", tipo: "texto", etiqueta: "Encima", ejemplo: "Alpha & Omega Training" },
      { id: "titular", tipo: "area", etiqueta: "Tema", ejemplo: "Consejo" },
      { id: "texto", tipo: "texto", etiqueta: "Debajo", ejemplo: "" },
    ],
    duracion: () => 5000,
    dibujar(ctx, t, R) {
      const d = R.datos
      M.fondo(ctx, R, { y: R.H / 2, radio: 900 })
      // Rayo grande detras, cruzando toda la portada.
      const p = avance(t, 200, 900, DENTRO_Y_FUERA)
      if (p > 0) {
        const ancho = M.inclinacion(R)
        M.pintarRayo(ctx, R, M.mezcla(-ancho - 80, R.W * 0.5, p), 0.55)
      }
      const x = R.W / 2
      const ancho = R.W - 2 * R.zona.lado
      const arriba = R.H / 2 - (R.vertical ? 560 : 480)
      const abajo = R.H / 2 + (R.vertical ? 560 : 480)
      const piezas = P.ajustar(
        (f) => [
          P.hueco(170 * f, 0, (y) =>
            M.logo(ctx, t, {
              x,
              y: y + 85 * f,
              tam: 170 * f,
              inicio: 300,
              escala: 0.9,
              destellos: [{ inicio: 2200, periodo: 2600 }],
            }),
          ),
          (() => {
            const pieza = P.ante(ctx, t, d.antetitulo, { x, ancho, f, tam: 30, inicio: 900 })
            if (pieza) pieza.antes = 28 * f
            return pieza
          })(),
          P.titular(
            ctx,
            t,
            d.titular,
            {
              x,
              ancho,
              f,
              tam: R.vertical ? 230 : 200,
              min: 90,
              maxLineas: 3,
              inicio: 1100,
              brillo: 2200,
              entrada: "asomar",
            },
            34,
          ),
          P.parrafo(
            ctx,
            t,
            d.texto,
            { x, ancho, f, tam: 36, color: COLOR.oroSuave, inicio: 1700, maxLineas: 2, peso: 600 },
            40,
          ),
        ],
        abajo - arriba,
      )
      P.columna(piezas, { arriba, abajo })
    },
  }

  window.PLANTILLAS.push(conHueco, fotos, semana, mito, plazas, portada)
  window.HISTORIAS = { esquinas, hueco, flechas, estrellas, estallido, cabecera }
})()
