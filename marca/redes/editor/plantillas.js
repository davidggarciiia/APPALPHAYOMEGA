/* global window */
/**
 * Las plantillas del editor. Cada una dice que campos pide, cuanto dura y como
 * se pinta en el instante `t`.
 *
 * R lleva el formato (W, H, zona segura), los textos (`datos`), las fotos o
 * videos subidos (`medios`) y la firma (`global`).
 *
 * La zona segura (R.zona) es lo que no tapan los botones ni el texto de
 * Instagram: en reels, entre y = 250 y y = 1440; en historias, entre 250 y
 * 1640; en publicaciones 4:5, entre 110 y 1240. Lo importante va dentro.
 */
;(function () {
  const M = window.MOTOR
  const { avance, bloque, logo, fondo, raya, tajo, firma, boton, medio, hueco, sombra, COLOR } = M
  const { DENTRO_Y_FUERA, LINEAL } = M

  const { texto, columna, ajustar, lineasDe, fondoConFoto, reservaFirma } = window.PIEZAS
  const { numeroEnAro, rayaIzquierda, pastilla, estrella } = window.PIEZAS

  // ---------------------------------------------------------------------------

  const frase = {
    id: "frase",
    nombre: "Frase",
    resumen: "Un titular grande en oro. Para frases, avisos y portadas.",
    campos: [
      { id: "antetitulo", tipo: "texto", etiqueta: "Encima del titular", ejemplo: "Recordatorio" },
      {
        id: "titular",
        tipo: "area",
        etiqueta: "Titular",
        ejemplo: "La constancia gana al talento.",
      },
      {
        id: "texto",
        tipo: "area",
        etiqueta: "Texto debajo",
        ejemplo: "Nos vemos en la próxima sesión.",
      },
      { id: "foto", tipo: "medio", etiqueta: "Foto o vídeo de fondo", opcional: true },
    ],
    duracion: () => 6500,
    dibujar(ctx, t, R) {
      const d = R.datos
      tajo(ctx, t, R, 0, () => {
        fondoConFoto(ctx, t, R, "foto")
        const ancho = R.W - 2 * R.zona.lado
        const abajo = R.zona.abajo - reservaFirma(R)
        const piezas = ajustar(
          (f) => [
            texto(ctx, t, {
              texto: d.antetitulo,
              tipo: "firma",
              peso: 600,
              tam: 34 * f,
              espaciado: 0.3,
              mayus: true,
              color: COLOR.oroSuave,
              x: R.W / 2,
              ancho,
              entrada: "subir",
              inicio: 650,
            }),
            texto(
              ctx,
              t,
              {
                texto: d.titular,
                tipo: "titular",
                tam: (R.vertical ? 200 : 170) * f,
                min: 80 * f,
                maxLineas: 5,
                interlinea: 1.04,
                mayus: true,
                color: "oro",
                x: R.W / 2,
                ancho,
                entrada: "asomar",
                inicio: 800,
                paso: 130,
                dura: 900,
                brilloEn: 2100,
              },
              36,
            ),
            {
              alto: 2,
              antes: 48,
              pintar: (y) => raya(ctx, t, { x: R.W / 2, y, ancho: 300, inicio: 1500 }),
            },
            texto(
              ctx,
              t,
              {
                texto: d.texto,
                tipo: "cuerpo",
                peso: 500,
                tam: 46 * f,
                min: 32,
                maxLineas: 5,
                interlinea: 1.3,
                color: COLOR.texto,
                x: R.W / 2,
                ancho: ancho - 40,
                entrada: "subir",
                inicio: 1750,
                paso: 90,
              },
              48,
            ),
          ],
          abajo - R.zona.arriba,
        )
        columna(piezas, { arriba: R.zona.arriba, abajo })
        firma(ctx, t, R, 2300)
      })
    },
  }

  // ---------------------------------------------------------------------------

  const foto = {
    id: "foto",
    nombre: "Foto con titular",
    resumen: "Tu foto a pantalla completa, con marco de oro y titular abajo.",
    campos: [
      { id: "foto", tipo: "medio", etiqueta: "Foto o vídeo" },
      { id: "antetitulo", tipo: "texto", etiqueta: "Encima del titular", ejemplo: "Sesión de hoy" },
      { id: "titular", tipo: "area", etiqueta: "Titular", ejemplo: "Sin prisa, pero sin pausa." },
      { id: "texto", tipo: "area", etiqueta: "Texto debajo", ejemplo: "" },
    ],
    duracion: () => 6500,
    dibujar(ctx, t, R) {
      const d = R.datos
      const f = R.medios.foto
      const todo = { x: 0, y: 0, w: R.W, h: R.H }
      if (f) medio(ctx, f.el, todo, f.ajuste, avance(t, 0, R.duracion, LINEAL))
      else hueco(ctx, todo, "Sube una foto o un vídeo", 0.36)

      // Sombra abajo para el texto y un poco arriba para el logo.
      sombra(ctx, R, R.H * 0.36, R.zona.abajo - 120, 0.9)
      sombra(ctx, R, R.zona.arriba + 260, 0, 0.55)
      const negro = 1 - avance(t, 0, 900)
      if (negro > 0) {
        ctx.fillStyle = `rgba(10, 10, 10, ${negro})`
        ctx.fillRect(0, 0, R.W, R.H)
      }

      // Marco fino de oro que se dibuja alrededor.
      const m = 40
      const perimetro = 2 * (R.W - 2 * m + R.H - 2 * m)
      const p = avance(t, 300, 1400, DENTRO_Y_FUERA)
      if (p > 0) {
        ctx.save()
        ctx.strokeStyle = M.oroLineal(ctx, 0, 0, R.W, R.H)
        ctx.lineWidth = 3
        ctx.setLineDash([perimetro, perimetro])
        ctx.lineDashOffset = perimetro * (1 - p)
        ctx.strokeRect(m, m, R.W - 2 * m, R.H - 2 * m)
        ctx.restore()
      }

      logo(ctx, t, {
        x: R.W / 2,
        y: R.zona.arriba + 70,
        tam: 140,
        inicio: 600,
        escala: 0.9,
        destellos: [{ inicio: 2400, periodo: 2600 }],
      })

      const x = R.zona.lado + 10
      const ancho = R.W - 2 * R.zona.lado - 20
      const abajo = R.zona.abajo - reservaFirma(R)
      const piezas = ajustar(
        (k) => [
          texto(ctx, t, {
            texto: d.antetitulo,
            tipo: "firma",
            peso: 600,
            tam: 32 * k,
            espaciado: 0.3,
            mayus: true,
            color: COLOR.oroSuave,
            x,
            ancho,
            alinear: "izq",
            entrada: "subir",
            inicio: 900,
          }),
          texto(
            ctx,
            t,
            {
              texto: d.titular,
              tipo: "titular",
              tam: (R.vertical ? 150 : 130) * k,
              min: 70,
              maxLineas: 4,
              interlinea: 1.04,
              mayus: true,
              color: "oro",
              x,
              ancho,
              alinear: "izq",
              entrada: "asomar",
              inicio: 1050,
              paso: 120,
              dura: 900,
              brilloEn: 2200,
            },
            20,
          ),
          texto(
            ctx,
            t,
            {
              texto: d.texto,
              tipo: "cuerpo",
              peso: 500,
              tam: 42 * k,
              min: 30,
              maxLineas: 4,
              interlinea: 1.3,
              color: COLOR.texto,
              x,
              ancho,
              alinear: "izq",
              entrada: "subir",
              inicio: 1700,
              paso: 90,
            },
            28,
          ),
        ],
        abajo - (R.zona.arriba + 200),
      )
      columna(piezas, { arriba: R.zona.arriba + 200, abajo, pegar: "abajo" })
      firma(ctx, t, R, 2600)
    },
  }

  // ---------------------------------------------------------------------------

  const consejo = {
    id: "consejo",
    nombre: "Consejo",
    resumen: "Un título y de uno a seis puntos que salen uno a uno.",
    campos: [
      { id: "etiqueta", tipo: "texto", etiqueta: "Etiqueta", ejemplo: "Consejo" },
      { id: "titulo", tipo: "area", etiqueta: "Título", ejemplo: "Tres claves para no lesionarte" },
      {
        id: "puntos",
        tipo: "area",
        etiqueta: "Puntos (uno por línea)",
        ejemplo:
          "Calienta diez minutos antes de empezar.\nTécnica antes que peso.\nDuerme siete horas o más.",
        filas: 5,
      },
    ],
    duracion: (R) => 1700 + lineasDe(R.datos.puntos, 6).length * 450 + 3600,
    dibujar(ctx, t, R) {
      const d = R.datos
      const puntos = lineasDe(d.puntos, 6)
      tajo(ctx, t, R, 0, () => {
        fondo(ctx, R, { x: R.W * 0.3, y: R.H * 0.35 })
        const x = R.zona.lado
        const ancho = R.W - 2 * R.zona.lado
        const abajo = R.zona.abajo - reservaFirma(R)
        const piezas = ajustar((f) => {
          const r = 40 * f
          const lista = puntos.map((punto, i) => {
            const inicio = 1700 + i * 450
            const op = {
              texto: punto,
              tipo: "cuerpo",
              peso: 500,
              tam: 44 * f,
              min: 30,
              interlinea: 1.25,
              color: COLOR.texto,
              x: x + r * 2 + 30,
              ancho: ancho - r * 2 - 30,
              alinear: "izq",
              entrada: "subir",
              inicio: inicio + 150,
            }
            const { alto, tam } = bloque(ctx, t, { ...op, y: 0, soloMedir: true })
            const desfase = r - (tam * 1.25) / 2
            return {
              alto: Math.max(r * 2, desfase + alto),
              antes: i ? 34 * f : 56 * f,
              pintar: (y) => {
                numeroEnAro(ctx, t, x + r, y + r, r, i + 1, inicio)
                bloque(ctx, t, { ...op, y: y + desfase })
              },
            }
          })
          return [
            texto(ctx, t, {
              texto: d.etiqueta,
              tipo: "firma",
              peso: 600,
              tam: 32 * f,
              espaciado: 0.3,
              mayus: true,
              color: COLOR.oroSuave,
              x,
              ancho,
              alinear: "izq",
              entrada: "subir",
              inicio: 650,
            }),
            texto(
              ctx,
              t,
              {
                texto: d.titulo,
                tipo: "titular",
                tam: 130 * f,
                min: 64,
                maxLineas: 3,
                interlinea: 1.04,
                mayus: true,
                color: "oro",
                x,
                ancho,
                alinear: "izq",
                entrada: "asomar",
                inicio: 800,
                paso: 120,
                dura: 900,
                brilloEn: 1900,
              },
              24,
            ),
            { alto: 2, antes: 44 * f, pintar: (y) => rayaIzquierda(ctx, t, x, y, 360, 1400) },
            ...lista,
          ]
        }, abajo - R.zona.arriba)
        columna(piezas, { arriba: R.zona.arriba, abajo })
        firma(ctx, t, R, 2000 + puntos.length * 450)
      })
    },
  }

  // ---------------------------------------------------------------------------

  const entreno = {
    id: "entreno",
    nombre: "Entreno del día",
    resumen: "Ejercicios con sus series y repeticiones, fila a fila.",
    campos: [
      { id: "antetitulo", tipo: "texto", etiqueta: "Etiqueta", ejemplo: "Entreno del día" },
      { id: "titulo", tipo: "texto", etiqueta: "Título", ejemplo: "Pierna y glúteo" },
      {
        id: "ejercicios",
        tipo: "area",
        etiqueta: "Ejercicios: nombre | series (uno por línea)",
        ejemplo:
          "Sentadilla | 4 × 8\nPeso muerto rumano | 3 × 10\nZancada búlgara | 3 × 10\nHip thrust | 4 × 12\nPlancha | 3 × 40 s",
        filas: 6,
      },
      {
        id: "nota",
        tipo: "texto",
        etiqueta: "Nota final",
        ejemplo: "Descansa 90 segundos entre series.",
      },
    ],
    duracion: (R) => 1600 + lineasDe(R.datos.ejercicios, 8).length * 320 + 3800,
    dibujar(ctx, t, R) {
      const d = R.datos
      const filas = lineasDe(d.ejercicios, 8).map((l) => {
        const [nombre, ...resto] = l.split("|")
        return { nombre: nombre.trim(), detalle: resto.join("|").trim() }
      })
      tajo(ctx, t, R, 0, () => {
        fondo(ctx, R, { x: R.W * 0.7, y: R.H * 0.3 })
        const x = R.zona.lado
        const ancho = R.W - 2 * R.zona.lado
        const abajo = R.zona.abajo - reservaFirma(R)
        const piezas = ajustar((f) => {
          const lista = filas.map((fila, i) => {
            const inicio = 1600 + i * 320
            const opNombre = {
              texto: fila.nombre,
              tipo: "cuerpo",
              peso: 600,
              tam: 42 * f,
              min: 28,
              maxLineas: 2,
              interlinea: 1.2,
              color: COLOR.texto,
              x,
              ancho: ancho * 0.62,
              alinear: "izq",
              entrada: "subir",
              inicio,
            }
            // En Archivo y no en Anton: en Anton el signo × sale diminuto.
            const opDetalle = {
              texto: fila.detalle,
              tipo: "cuerpo",
              peso: 700,
              tam: 44 * f,
              min: 28,
              maxLineas: 1,
              interlinea: 1.2,
              color: "oro",
              x: x + ancho,
              ancho: ancho * 0.36,
              alinear: "der",
              entrada: "subir",
              inicio: inicio + 100,
            }
            const a = bloque(ctx, t, { ...opNombre, y: 0, soloMedir: true })
            const b = bloque(ctx, t, { ...opDetalle, y: 0, soloMedir: true })
            const alto = Math.max(a.alto, b.alto)
            return {
              alto: alto + 22 * f,
              antes: i ? 22 * f : 54 * f,
              pintar: (y) => {
                bloque(ctx, t, { ...opNombre, y: y + (alto - a.alto) / 2 })
                bloque(ctx, t, { ...opDetalle, y: y + (alto - b.alto) / 2 })
                rayaIzquierda(
                  ctx,
                  t,
                  x,
                  y + alto + 22 * f,
                  ancho,
                  inicio + 150,
                  "rgba(201, 162, 39, 0.45)",
                )
              },
            }
          })
          return [
            texto(ctx, t, {
              texto: d.antetitulo,
              tipo: "firma",
              peso: 600,
              tam: 32 * f,
              espaciado: 0.3,
              mayus: true,
              color: COLOR.oroSuave,
              x,
              ancho,
              alinear: "izq",
              entrada: "subir",
              inicio: 650,
            }),
            texto(
              ctx,
              t,
              {
                texto: d.titulo,
                tipo: "titular",
                tam: 140 * f,
                min: 64,
                maxLineas: 2,
                interlinea: 1.04,
                mayus: true,
                color: "oro",
                x,
                ancho,
                alinear: "izq",
                entrada: "asomar",
                inicio: 800,
                paso: 120,
                dura: 900,
                brilloEn: 1800,
              },
              20,
            ),
            ...lista,
            texto(
              ctx,
              t,
              {
                texto: d.nota,
                tipo: "cuerpo",
                peso: 500,
                tam: 34 * f,
                min: 26,
                maxLineas: 2,
                interlinea: 1.3,
                color: COLOR.tenue,
                x,
                ancho,
                alinear: "izq",
                entrada: "subir",
                inicio: 1800 + filas.length * 320,
              },
              44 * f,
            ),
          ]
        }, abajo - R.zona.arriba)
        columna(piezas, { arriba: R.zona.arriba, abajo })
        firma(ctx, t, R, 2200 + filas.length * 320)
      })
    },
  }

  // ---------------------------------------------------------------------------

  const antesDespues = {
    id: "antesdespues",
    nombre: "Antes y después",
    resumen: "Dos fotos separadas por el rayo del logo, y el resultado en grande.",
    campos: [
      { id: "antes", tipo: "medio", etiqueta: "Foto de antes" },
      { id: "despues", tipo: "medio", etiqueta: "Foto de después" },
      { id: "resultado", tipo: "texto", etiqueta: "Resultado", ejemplo: "−8 kg" },
      {
        id: "texto",
        tipo: "area",
        etiqueta: "Texto",
        ejemplo: "12 semanas de trabajo y constancia.",
      },
    ],
    duracion: () => 7500,
    dibujar(ctx, t, R) {
      const d = R.datos
      fondo(ctx, R, { y: R.H * 0.8 })
      const H0 = R.vertical ? 1150 : 820
      const franja = { W: R.W, H: H0 }
      const inclinado = (H0 / 2) * Math.tan((19 * Math.PI) / 180)
      const centro = R.W / 2

      // Antes: aparece y se acerca un poco. Ocupa la mitad izquierda.
      const cajaAntes = { x: 0, y: 0, w: centro + inclinado, h: H0 }
      const a = avance(t, 0, 900)
      ctx.save()
      ctx.globalAlpha = a
      if (R.medios.antes)
        medio(
          ctx,
          R.medios.antes.el,
          cajaAntes,
          R.medios.antes.ajuste,
          avance(t, 0, R.duracion, LINEAL),
        )
      else hueco(ctx, cajaAntes, "Foto de antes")
      ctx.restore()

      // Despues: el rayo entra por la derecha y se para en el centro.
      const p = avance(t, 1200, 900, DENTRO_Y_FUERA)
      const xRayo = M.mezcla(R.W + inclinado + 80, centro, p)
      if (p > 0) {
        ctx.save()
        M.recorteRayo(ctx, franja, xRayo, 1)
        ctx.beginPath()
        ctx.rect(0, 0, R.W, H0)
        ctx.clip()
        const cajaDespues = { x: centro - inclinado, y: 0, w: R.W - centro + inclinado, h: H0 }
        if (R.medios.despues)
          medio(
            ctx,
            R.medios.despues.el,
            cajaDespues,
            R.medios.despues.ajuste,
            avance(t, 1200, R.duracion, LINEAL),
          )
        else hueco(ctx, cajaDespues, "Foto de después")
        ctx.restore()
      }

      // Las fotos se funden con el fondo por abajo.
      const g = ctx.createLinearGradient(0, H0 - 300, 0, H0)
      g.addColorStop(0, "rgba(10, 10, 10, 0)")
      g.addColorStop(1, "rgba(10, 10, 10, 1)")
      ctx.fillStyle = g
      ctx.fillRect(0, H0 - 300, R.W, 300)
      ctx.fillStyle = COLOR.fondo
      ctx.fillRect(0, H0, R.W, R.H - H0)
      fondo(ctx, R, { y: H0 + 120, alfa: 0.6, radio: 700, soloResplandor: true })

      if (p > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, R.W, H0 - 40)
        ctx.clip()
        M.pintarRayo(ctx, franja, xRayo)
        ctx.restore()
      }

      pastilla(ctx, t, "Antes", R.zona.lado - 30, R.zona.arriba, "izq", 700)
      pastilla(ctx, t, "Después", R.W - R.zona.lado + 30, R.zona.arriba, "der", 2000)

      const ancho = R.W - 2 * R.zona.lado
      const abajo = R.zona.abajo - reservaFirma(R)
      const arriba = H0 - 90
      const piezas = ajustar(
        (f) => [
          texto(ctx, t, {
            texto: d.resultado,
            tipo: "titular",
            tam: (R.vertical ? 170 : 190) * f,
            min: 70,
            maxLineas: 2,
            interlinea: 1.04,
            mayus: true,
            color: "oro",
            x: R.W / 2,
            ancho,
            entrada: "letras-asomar",
            inicio: 2300,
            paso: 50,
            dura: 800,
            brilloEn: 3300,
          }),
          texto(
            ctx,
            t,
            {
              texto: d.texto,
              tipo: "cuerpo",
              peso: 500,
              tam: 42 * f,
              min: 28,
              maxLineas: 3,
              interlinea: 1.3,
              color: COLOR.texto,
              x: R.W / 2,
              ancho,
              entrada: "subir",
              inicio: 2800,
              paso: 90,
            },
            18,
          ),
        ],
        abajo - arriba,
      )
      columna(piezas, { arriba, abajo })
      firma(ctx, t, R, 3300)
    },
  }

  // ---------------------------------------------------------------------------

  const opinion = {
    id: "opinion",
    nombre: "Opinión",
    resumen: "Lo que dice un cliente, con su nombre y estrellas.",
    campos: [
      {
        id: "cita",
        tipo: "area",
        etiqueta: "Lo que dice",
        ejemplo:
          "Llevo seis meses entrenando aquí y es la primera vez que no lo dejo. Se nota que te lo preparan a ti.",
        filas: 4,
      },
      { id: "nombre", tipo: "texto", etiqueta: "Nombre", ejemplo: "Laura" },
      { id: "detalle", tipo: "texto", etiqueta: "Detalle", ejemplo: "Clienta desde 2025" },
      { id: "estrellas", tipo: "estrellas", etiqueta: "Estrellas", ejemplo: "5" },
    ],
    duracion: () => 7500,
    dibujar(ctx, t, R) {
      const d = R.datos
      const n = Math.max(0, Math.min(5, Number(d.estrellas) || 0))
      tajo(ctx, t, R, 0, () => {
        fondo(ctx, R, { y: R.H * 0.36 })
        const ancho = R.W - 2 * R.zona.lado
        const abajo = R.zona.abajo - reservaFirma(R)
        const piezas = ajustar((f) => {
          const tamComillas = 300 * f
          const comillas = {
            alto: tamComillas * 0.42,
            antes: 0,
            pintar: (y) => {
              const a = avance(t, 500, 900)
              if (a <= 0) return
              ctx.save()
              ctx.globalAlpha = a
              ctx.font = `600 ${tamComillas}px ${M.FUENTE.firma}`
              ctx.textBaseline = "alphabetic"
              const medida = ctx.measureText("“")
              const w = medida.width
              const s = 0.85 + 0.15 * a
              ctx.translate(R.W / 2, y + tamComillas * 0.21)
              ctx.scale(s, s)
              ctx.fillStyle = M.oroLineal(ctx, -w / 2, -tamComillas * 0.2, w / 2, tamComillas * 0.2)
              ctx.fillText("“", -w / 2, medida.actualBoundingBoxAscent - tamComillas * 0.21)
              ctx.restore()
            },
          }
          const estrellas = {
            alto: n ? 56 * f : 0,
            antes: 48 * f,
            pintar: (y) => {
              const r = 28 * f
              const hueco = 16 * f
              const total = n * 2 * r + (n - 1) * hueco
              for (let i = 0; i < n; i++) {
                const x = R.W / 2 - total / 2 + r + i * (2 * r + hueco)
                const inicio = 2000 + i * 120
                const a = avance(t, inicio, 500)
                if (a <= 0) continue
                ctx.save()
                ctx.globalAlpha = a
                estrella(ctx, x, y + r + (1 - a) * 10, r)
                ctx.fillStyle = M.oroLineal(ctx, x - r, y, x + r, y + 2 * r)
                ctx.fill()
                ctx.restore()
              }
            },
          }
          return [
            comillas,
            texto(
              ctx,
              t,
              {
                texto: d.cita,
                tipo: "cuerpo",
                peso: 500,
                tam: 54 * f,
                min: 32,
                maxLineas: 8,
                interlinea: 1.32,
                color: COLOR.texto,
                x: R.W / 2,
                ancho: ancho - 20,
                entrada: "subir",
                inicio: 900,
                paso: 110,
              },
              40 * f,
            ),
            estrellas,
            texto(
              ctx,
              t,
              {
                texto: d.nombre,
                tipo: "firma",
                peso: 600,
                tam: 38 * f,
                espaciado: 0.26,
                mayus: true,
                color: COLOR.oroSuave,
                x: R.W / 2,
                ancho,
                entrada: "subir",
                inicio: 2600,
              },
              n ? 40 * f : 52 * f,
            ),
            texto(
              ctx,
              t,
              {
                texto: d.detalle,
                tipo: "cuerpo",
                peso: 500,
                tam: 30 * f,
                color: COLOR.tenue,
                x: R.W / 2,
                ancho,
                entrada: "subir",
                inicio: 2750,
              },
              12,
            ),
          ]
        }, abajo - R.zona.arriba)
        columna(piezas, { arriba: R.zona.arriba, abajo })
        firma(ctx, t, R, 3100)
      })
    },
  }

  // ---------------------------------------------------------------------------

  const anuncio = {
    id: "anuncio",
    nombre: "Anuncio",
    resumen: "Plazas, horarios, eventos u ofertas, enmarcado en los aros del logo.",
    campos: [
      { id: "antetitulo", tipo: "texto", etiqueta: "Encima del titular", ejemplo: "Octubre" },
      { id: "titular", tipo: "area", etiqueta: "Titular", ejemplo: "Plazas abiertas" },
      {
        id: "texto",
        tipo: "area",
        etiqueta: "Texto",
        ejemplo: "Entrenamiento personal uno a uno en Sant Martí, Barcelona.",
      },
      { id: "boton", tipo: "texto", etiqueta: "Botón", ejemplo: "Escríbeme por privado" },
      { id: "foto", tipo: "medio", etiqueta: "Foto o vídeo de fondo", opcional: true },
    ],
    duracion: () => 7500,
    dibujar(ctx, t, R) {
      const d = R.datos
      fondoConFoto(ctx, t, R, "foto", 0.7)
      const cy = (R.zona.arriba + R.zona.abajo) / 2
      logo(ctx, t, {
        x: R.W / 2,
        y: cy,
        tam: R.vertical ? 1500 : 1540,
        partes: { emblema: false, letras: false },
        inicio: 150,
        escala: 1.9,
        destellos: [
          { aro: 0, inicio: 2300, periodo: 3200 },
          { aro: 2, inicio: 2600, periodo: 3200, sentido: -1 },
        ],
      })
      const ancho = R.W - 2 * R.zona.lado - 40
      const piezas = ajustar(
        (f) => [
          texto(ctx, t, {
            texto: d.antetitulo,
            tipo: "firma",
            peso: 600,
            tam: 38 * f,
            espaciado: 0.3,
            mayus: true,
            color: COLOR.oroSuave,
            x: R.W / 2,
            ancho,
            entrada: "subir",
            inicio: 1300,
          }),
          texto(
            ctx,
            t,
            {
              texto: d.titular,
              tipo: "titular",
              tam: 190 * f,
              min: 80,
              maxLineas: 3,
              interlinea: 1.04,
              mayus: true,
              color: "oro",
              x: R.W / 2,
              ancho,
              entrada: "letras-asomar",
              inicio: 1450,
              paso: 45,
              dura: 800,
              brilloEn: 2700,
            },
            24,
          ),
          texto(
            ctx,
            t,
            {
              texto: d.texto,
              tipo: "cuerpo",
              peso: 500,
              tam: 44 * f,
              min: 30,
              maxLineas: 4,
              interlinea: 1.3,
              color: COLOR.texto,
              x: R.W / 2,
              ancho: ancho - 40,
              entrada: "subir",
              inicio: 2300,
              paso: 90,
            },
            34,
          ),
          d.boton
            ? {
                alto: 32 * 3.6 * f,
                antes: 60 * f,
                pintar: (y) =>
                  boton(ctx, t, {
                    texto: d.boton,
                    x: R.W / 2,
                    y,
                    tam: 32 * f,
                    inicio: 2700,
                    anchoMax: ancho,
                  }),
              }
            : null,
        ],
        R.zona.abajo - R.zona.arriba - 80,
      )
      columna(piezas, { arriba: R.zona.arriba + 40, abajo: R.zona.abajo - 40 })
    },
  }

  // ---------------------------------------------------------------------------

  const intro = {
    id: "logo",
    nombre: "Logo",
    resumen: "El logo se construye, como al abrir la app. Para empezar o cerrar vídeos.",
    campos: [
      { id: "linea1", tipo: "texto", etiqueta: "Primera línea", ejemplo: "Entrenamiento personal" },
      { id: "linea2", tipo: "texto", etiqueta: "Segunda línea", ejemplo: "Sant Martí · Barcelona" },
      { id: "boton", tipo: "texto", etiqueta: "Botón (opcional)", ejemplo: "" },
    ],
    duracion: () => 6000,
    dibujar(ctx, t, R) {
      const d = R.datos
      const tam = R.vertical ? 700 : 560
      const ancho = R.W - 2 * R.zona.lado
      let centroLogo = R.H * 0.4
      // Se acerca despacio durante toda la pieza.
      const s = M.mezcla(0.965, 1, avance(t, 0, R.duracion, LINEAL))
      ctx.fillStyle = COLOR.fondo
      ctx.fillRect(0, 0, R.W, R.H)
      ctx.save()
      ctx.translate(R.W / 2, R.H / 2)
      ctx.scale(s, s)
      ctx.translate(-R.W / 2, -R.H / 2)
      const piezas = [
        {
          alto: tam,
          antes: 0,
          pintar: (y) => {
            centroLogo = y + tam / 2
          },
        },
        texto(
          ctx,
          t,
          {
            texto: "Alpha & Omega",
            tipo: "firma",
            peso: 600,
            tam: R.vertical ? 64 : 58,
            espaciado: 0.3,
            mayus: true,
            color: "oro",
            x: R.W / 2,
            ancho: R.W - 60,
            entrada: "letras",
            inicio: 2150,
            paso: 45,
            dura: 700,
            brilloEn: 3050,
          },
          64,
        ),
        {
          alto: 2,
          antes: 34,
          pintar: (y) => raya(ctx, t, { x: R.W / 2, y, ancho: 300, inicio: 2700 }),
        },
        texto(
          ctx,
          t,
          {
            texto: d.linea1,
            tipo: "cuerpo",
            peso: 600,
            tam: 34,
            min: 24,
            maxLineas: 2,
            espaciado: 0.26,
            mayus: true,
            color: COLOR.texto,
            x: R.W / 2,
            ancho,
            entrada: "subir",
            inicio: 2950,
          },
          34,
        ),
        texto(
          ctx,
          t,
          {
            texto: d.linea2,
            tipo: "cuerpo",
            peso: 600,
            tam: 28,
            min: 22,
            maxLineas: 2,
            espaciado: 0.32,
            mayus: true,
            color: COLOR.tenue,
            x: R.W / 2,
            ancho,
            entrada: "subir",
            inicio: 3150,
          },
          12,
        ),
        d.boton
          ? {
              alto: 30 * 3.6,
              antes: 56,
              pintar: (y) =>
                boton(ctx, t, {
                  texto: d.boton,
                  x: R.W / 2,
                  y,
                  tam: 30,
                  inicio: 3300,
                  anchoMax: ancho,
                }),
            }
          : null,
      ]
      // Primero se colocan las piezas para saber donde cae el logo, y el
      // resplandor va detras de todo.
      const colocar = () => columna(piezas, { arriba: R.zona.arriba, abajo: R.zona.abajo })
      const pintores = piezas.map((p) => p && p.pintar)
      piezas.forEach((p) => {
        if (p) p.pintar = () => {}
      })
      piezas[0].pintar = (y) => {
        centroLogo = y + tam / 2
      }
      colocar()
      fondo(ctx, R, { y: centroLogo, alfa: avance(t, 0, 1400) })
      const halo = avance(t, 1300, 900)
      if (halo > 0) {
        const g = ctx.createRadialGradient(R.W / 2, centroLogo, 0, R.W / 2, centroLogo, tam * 0.68)
        g.addColorStop(0, `rgba(224, 193, 88, ${0.2 * halo})`)
        g.addColorStop(0.55, `rgba(201, 162, 39, ${0.08 * halo})`)
        g.addColorStop(1, "rgba(201, 162, 39, 0)")
        ctx.fillStyle = g
        ctx.fillRect(0, 0, R.W, R.H)
      }
      piezas.forEach((p, i) => {
        if (p) p.pintar = pintores[i]
      })
      piezas[0].pintar = (y) =>
        logo(ctx, t, {
          x: R.W / 2,
          y: y + tam / 2,
          tam,
          inicio: 250,
          escala: 1.7,
          destellos: [{ inicio: 3000, periodo: 2600 }],
        })
      colocar()
      ctx.restore()
    },
  }

  window.PLANTILLAS.push(frase, foto, consejo, entreno, antesDespues, opinion, anuncio, intro)
})()
