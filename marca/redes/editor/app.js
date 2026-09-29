/* global window, document, localStorage, requestAnimationFrame, performance, URL, Image, Blob, VideoFrame, VideoEncoder, MediaRecorder, setTimeout, matchMedia */
/**
 * El editor: elegir plantilla y formato, escribir los textos, subir fotos, ver
 * la animacion y bajarla como video (MP4) o imagen (PNG).
 *
 * Los textos se recuerdan en este navegador; las fotos no, porque no salen del
 * movil o del ordenador de quien las sube.
 */
;(function () {
  const M = window.MOTOR
  const PLANTILLAS = window.PLANTILLAS
  const FPS = 30

  /** Zona segura de cada formato: lo que no tapan los botones de Instagram. */
  const FORMATOS = {
    "9x16": { H: 1920, zona: { arriba: 250, abajo: 1440, lado: 100 } },
    historia: { H: 1920, zona: { arriba: 250, abajo: 1640, lado: 90 } },
    "4x5": { H: 1350, zona: { arriba: 110, abajo: 1240, lado: 90 } },
  }

  const $ = (selector) => document.querySelector(selector)
  const CLAVE = "alpha-omega-plantillas-v1"

  const estado = Object.assign(
    {
      plantilla: "frase",
      formato: "9x16",
      datos: {},
      ajustes: {},
      global: { firma: "Alpha & Omega Training", mostrarFirma: true },
      extra: 0,
    },
    leerGuardado(),
  )
  /** Fotos y videos subidos: medios[plantilla][campo] = { el, tipo, nombre, url }. */
  const medios = {}

  function leerGuardado() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE)) || {}
    } catch {
      return {}
    }
  }
  function guardarEstado() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado))
    } catch {
      // Sin almacenamiento el editor funciona igual; solo no recuerda los textos.
    }
  }

  const plantilla = () => PLANTILLAS.find((p) => p.id === estado.plantilla) || PLANTILLAS[0]

  function valor(p, campo) {
    const guardado = estado.datos[p.id] && estado.datos[p.id][campo.id]
    return guardado ?? campo.ejemplo ?? ""
  }

  function ajusteDe(p, campo) {
    return (estado.ajustes[p.id] && estado.ajustes[p.id][campo]) || { x: 0.5, y: 0.5, zoom: 1 }
  }

  /** Todo lo que una plantilla necesita para pintarse. */
  function construir(p) {
    const f = FORMATOS[estado.formato]
    const R = {
      W: 1080,
      H: f.H,
      zona: f.zona,
      vertical: f.H > 1500,
      datos: {},
      medios: {},
      global: estado.global,
    }
    p.campos.forEach((c) => {
      if (c.tipo === "medio") {
        const m = medios[p.id] && medios[p.id][c.id]
        if (m) R.medios[c.id] = { el: m.el, ajuste: ajusteDe(p, c.id) }
      } else {
        R.datos[c.id] = valor(p, c)
      }
    })
    R.duracion = p.duracion(R) + estado.extra * 1000
    return R
  }

  function pintar(ctx, t, R, escala) {
    ctx.setTransform(escala, 0, 0, escala, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = "source-over"
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, R.W, R.H)
    plantilla().dibujar(ctx, t, R)
    M.vineta(ctx, R)
    M.grano(ctx, R)
  }

  // ---------- Vista previa ----------

  const lienzo = $("#lienzo")
  const zonas = $("#zonas")
  const marco = $("#marco")
  const ctxVista = lienzo.getContext("2d")
  let escalaVista = 0.5
  let t = 0
  let reproduciendo = !matchMedia("(prefers-reduced-motion: reduce)").matches
  let ultimo = performance.now()
  let exportando = false

  function medirVista() {
    const f = FORMATOS[estado.formato]
    marco.dataset.formato = estado.formato
    const ancho = marco.clientWidth || 360
    const px = Math.min(1080, Math.round(ancho * Math.min(window.devicePixelRatio || 1, 2)))
    lienzo.width = px
    lienzo.height = Math.round((px * f.H) / 1080)
    zonas.width = lienzo.width
    zonas.height = lienzo.height
    escalaVista = px / 1080
    pintarZonas()
  }

  /** Lo que tapan los botones y el texto de cada red, para ver si algo cae debajo. */
  function pintarZonas() {
    const c = zonas.getContext("2d")
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, zonas.width, zonas.height)
    if (!$("#ver-zonas").checked) return
    const f = FORMATOS[estado.formato]
    c.setTransform(escalaVista, 0, 0, escalaVista, 0, 0)
    const tapar = (x, y, w, h, texto) => {
      c.fillStyle = "rgba(224, 122, 106, 0.28)"
      c.fillRect(x, y, w, h)
      c.strokeStyle = "rgba(224, 122, 106, 0.9)"
      c.lineWidth = 3
      c.setLineDash([14, 10])
      c.strokeRect(x, y, w, h)
      c.setLineDash([])
      c.fillStyle = "#fff"
      c.font = "600 30px Archivo, sans-serif"
      c.fillText(texto, x + 24, y + 48)
    }
    if (estado.formato === "9x16") {
      tapar(0, 0, 1080, f.zona.arriba, "Lo tapa la cabecera de Instagram")
      tapar(0, f.zona.abajo, 1080, f.H - f.zona.abajo, "Lo tapan el texto y los botones")
      tapar(950, 760, 130, f.zona.abajo - 760, "")
    } else if (estado.formato === "historia") {
      tapar(0, 0, 1080, f.zona.arriba, "Lo tapan la barra y el nombre")
      tapar(0, f.zona.abajo, 1080, f.H - f.zona.abajo, "Lo tapa el cuadro de responder")
    } else {
      tapar(0, 1350 - 110, 1080, 110, "Margen de seguridad")
      c.strokeStyle = "rgba(224, 122, 106, 0.9)"
      c.setLineDash([14, 10])
      c.lineWidth = 3
      c.strokeRect(34, 0, 1012, 1350)
      c.setLineDash([])
      c.fillStyle = "#fff"
      c.font = "600 28px Archivo, sans-serif"
      c.fillText("Recorte de la cuadrícula del perfil", 58, 52)
    }
  }

  function formatoTiempo(ms) {
    const s = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  }

  function videosDe(R) {
    return Object.values(R.medios)
      .map((m) => m.el)
      .filter((el) => el.tagName === "VIDEO")
  }

  function bucle(ahora) {
    if (!exportando) {
      const R = construir(plantilla())
      if (reproduciendo) {
        t += ahora - ultimo
        if (t > R.duracion + 900) {
          t = 0
          videosDe(R).forEach((v) => {
            v.currentTime = 0
          })
        }
      }
      pintar(ctxVista, Math.min(t, R.duracion), R, escalaVista)
      $("#linea-tiempo").value = String(Math.round((Math.min(t, R.duracion) / R.duracion) * 1000))
      $("#tiempo").textContent =
        `${formatoTiempo(Math.min(t, R.duracion))} / ${formatoTiempo(R.duracion)}`
    }
    ultimo = ahora
    requestAnimationFrame(bucle)
  }

  function ponerReproduccion(si) {
    reproduciendo = si
    const boton = $("#reproducir")
    boton.setAttribute("aria-label", si ? "Pausar" : "Reproducir")
    boton.querySelector(".icono-pausa").hidden = !si
    boton.querySelector(".icono-play").hidden = si
    const R = construir(plantilla())
    videosDe(R).forEach((v) => (si ? v.play().catch(() => {}) : v.pause()))
  }

  // ---------- Controles ----------

  function pintarPlantillas() {
    const caja = $("#plantillas")
    caja.innerHTML = ""
    PLANTILLAS.forEach((p) => {
      const opcion = document.createElement("label")
      opcion.className = "tarjeta"
      opcion.innerHTML = `<input type="radio" name="plantilla" value="${p.id}"><span class="tarjeta-nombre"></span><span class="tarjeta-resumen"></span>`
      opcion.querySelector(".tarjeta-nombre").textContent = p.nombre
      opcion.querySelector(".tarjeta-resumen").textContent = p.resumen
      const radio = opcion.querySelector("input")
      radio.id = `plantilla-${p.id}`
      radio.checked = p.id === estado.plantilla
      radio.addEventListener("change", () => {
        estado.plantilla = p.id
        guardarEstado()
        t = 0
        pintarCampos()
      })
      caja.appendChild(opcion)
    })
  }

  function cambiarDato(p, campo, v) {
    estado.datos[p.id] = estado.datos[p.id] || {}
    estado.datos[p.id][campo] = v
    guardarEstado()
  }

  function cambiarAjuste(p, campo, clave, v) {
    estado.ajustes[p.id] = estado.ajustes[p.id] || {}
    estado.ajustes[p.id][campo] = { ...ajusteDe(p, campo), [clave]: v }
    guardarEstado()
  }

  function campoDeMedio(p, c, caja) {
    const m = medios[p.id] && medios[p.id][c.id]
    const id = `campo-${p.id}-${c.id}`
    caja.innerHTML = `
      <span class="campo-etiqueta">${c.etiqueta}${c.opcional ? ' <span class="opcional">opcional</span>' : ""}</span>
      <div class="medio">
        <label class="elegir" for="${id}">
          <input type="file" id="${id}" accept="image/*,video/*">
          <span class="elegir-texto"></span>
        </label>
        <button type="button" class="quitar" ${m ? "" : "hidden"}>Quitar</button>
      </div>
      <div class="encuadre" ${m ? "" : "hidden"}>
        <label>Mover a los lados <input type="range" min="0" max="1" step="0.01" data-clave="x"></label>
        <label>Mover arriba y abajo <input type="range" min="0" max="1" step="0.01" data-clave="y"></label>
        <label>Acercar <input type="range" min="1" max="2.5" step="0.01" data-clave="zoom"></label>
      </div>`
    caja.querySelector(".elegir-texto").textContent = m ? m.nombre : "Elegir foto o vídeo"
    const ajuste = ajusteDe(p, c.id)
    caja.querySelectorAll(".encuadre input").forEach((r) => {
      r.id = `${id}-${r.dataset.clave}`
      r.value = String(ajuste[r.dataset.clave])
      r.addEventListener("input", () => cambiarAjuste(p, c.id, r.dataset.clave, Number(r.value)))
    })
    caja.querySelector("input[type=file]").addEventListener("change", async (e) => {
      const archivo = e.target.files && e.target.files[0]
      if (!archivo) return
      try {
        const nuevo = await cargarMedio(archivo)
        const viejo = medios[p.id] && medios[p.id][c.id]
        if (viejo) URL.revokeObjectURL(viejo.url)
        medios[p.id] = medios[p.id] || {}
        medios[p.id][c.id] = nuevo
        avisar("")
      } catch {
        avisar(
          "No se ha podido abrir ese archivo. Prueba con una foto JPG o PNG, o un vídeo MP4.",
          true,
        )
      }
      campoDeMedio(p, c, caja)
    })
    caja.querySelector(".quitar").addEventListener("click", () => {
      const viejo = medios[p.id] && medios[p.id][c.id]
      if (viejo) {
        if (viejo.el.tagName === "VIDEO") viejo.el.pause()
        URL.revokeObjectURL(viejo.url)
        delete medios[p.id][c.id]
      }
      campoDeMedio(p, c, caja)
    })
  }

  function cargarMedio(archivo) {
    const url = URL.createObjectURL(archivo)
    if (archivo.type.startsWith("video/")) {
      return new Promise((resolver, rechazar) => {
        const v = document.createElement("video")
        v.muted = true
        v.loop = true
        v.playsInline = true
        v.preload = "auto"
        v.onloadeddata = () => {
          if (reproduciendo) v.play().catch(() => {})
          resolver({ el: v, nombre: archivo.name, url })
        }
        v.onerror = rechazar
        v.src = url
      })
    }
    return new Promise((resolver, rechazar) => {
      const img = new Image()
      img.onload = () => resolver({ el: img, nombre: archivo.name, url })
      img.onerror = rechazar
      img.src = url
    })
  }

  function pintarCampos() {
    const p = plantilla()
    const caja = $("#campos")
    caja.innerHTML = ""
    p.campos.forEach((c) => {
      const campo = document.createElement("div")
      campo.className = "campo"
      const id = `campo-${p.id}-${c.id}`
      if (c.tipo === "medio") {
        campoDeMedio(p, c, campo)
      } else if (c.tipo === "estrellas") {
        campo.innerHTML = `<label class="campo-etiqueta" for="${id}">${c.etiqueta}</label>
          <select id="${id}">${[5, 4, 3, 2, 1, 0]
            .map((n) => `<option value="${n}">${n ? "★".repeat(n) : "Sin estrellas"}</option>`)
            .join("")}</select>`
        const select = campo.querySelector("select")
        select.value = String(valor(p, c))
        select.addEventListener("change", () => cambiarDato(p, c.id, select.value))
      } else {
        const multilinea = c.tipo === "area"
        campo.innerHTML = `<label class="campo-etiqueta" for="${id}">${c.etiqueta}</label>`
        const entrada = document.createElement(multilinea ? "textarea" : "input")
        entrada.id = id
        if (multilinea) entrada.rows = c.filas || 2
        else entrada.type = "text"
        entrada.value = valor(p, c)
        entrada.addEventListener("input", () => cambiarDato(p, c.id, entrada.value))
        campo.appendChild(entrada)
      }
      caja.appendChild(campo)
    })
  }

  function montarControles() {
    pintarPlantillas()
    pintarCampos()

    document.querySelectorAll("input[name=formato]").forEach((r) => {
      r.checked = r.value === estado.formato
      r.addEventListener("change", () => {
        estado.formato = r.value
        guardarEstado()
        medirVista()
      })
    })

    const firma = $("#firma")
    firma.value = estado.global.firma
    firma.addEventListener("input", () => {
      estado.global.firma = firma.value
      guardarEstado()
    })
    const mostrar = $("#mostrar-firma")
    mostrar.checked = estado.global.mostrarFirma
    mostrar.addEventListener("change", () => {
      estado.global.mostrarFirma = mostrar.checked
      guardarEstado()
    })
    const extra = $("#extra")
    const verExtra = () => {
      $("#extra-valor").textContent = estado.extra ? `+${estado.extra} s` : "Nada"
    }
    extra.value = String(estado.extra)
    verExtra()
    extra.addEventListener("input", () => {
      estado.extra = Number(extra.value)
      guardarEstado()
      verExtra()
    })

    $("#reproducir").addEventListener("click", () => ponerReproduccion(!reproduciendo))
    $("#linea-tiempo").addEventListener("input", (e) => {
      ponerReproduccion(false)
      const R = construir(plantilla())
      t = (Number(e.target.value) / 1000) * R.duracion
      videosDe(R).forEach((v) => {
        v.currentTime = (t / 1000) % (v.duration || 1)
      })
    })
    $("#ver-zonas").addEventListener("change", pintarZonas)
    $("#bajar-imagen").addEventListener("click", bajarImagen)
    $("#bajar-video").addEventListener("click", bajarVideo)
    window.addEventListener("resize", medirVista)
  }

  // ---------- Exportar ----------

  function avisar(texto, esError = false) {
    const p = $("#estado")
    p.textContent = texto
    p.classList.toggle("error", esError)
  }

  function progreso(fraccion) {
    const caja = $("#progreso")
    caja.hidden = fraccion == null
    if (fraccion != null)
      $("#barra").style.transform = `scaleX(${Math.max(0, Math.min(1, fraccion))})`
  }

  function ocupado(si) {
    exportando = si
    $("#bajar-video").disabled = si
    $("#bajar-imagen").disabled = si
    if (!si) progreso(null)
  }

  function nombreArchivo(extension) {
    return `alpha-omega-${estado.plantilla}-${estado.formato}.${extension}`
  }

  /**
   * Entrega el archivo. Dentro del visor de Claude la pagina no puede
   * descargar por su cuenta: se lo pide a la capacidad `downloads`, que
   * pregunta a quien lo usa. Abierta en un navegador normal, basta un enlace.
   */
  async function entregar(blob, nombre) {
    if (window.claude && typeof window.claude.use === "function") {
      const descargas = await window.claude.use("downloads")
      if (!descargas) {
        avisar(
          "Aquí no se pueden guardar archivos. Abre el editor en el navegador para descargarlo.",
          true,
        )
        return
      }
      try {
        await descargas.save({ filename: nombre, data: blob })
        avisar(`Listo: ${nombre}`)
      } catch (e) {
        const codigo = e && e.code
        if (codigo === "declined") avisar("Descarga cancelada.")
        else if (codigo === "rate_limited")
          avisar("Ya hay una descarga esperando. Acéptala o espera un momento.")
        else avisar("No se ha podido guardar el archivo. Vuelve a intentarlo.", true)
      }
      return
    }
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 60000)
    avisar(`Listo: ${nombre}`)
  }

  function buscar(video, segundos) {
    return new Promise((resolver) => {
      if (Math.abs(video.currentTime - segundos) < 0.0005) {
        resolver()
        return
      }
      const listo = () => {
        video.removeEventListener("seeked", listo)
        resolver()
      }
      video.addEventListener("seeked", listo)
      video.currentTime = segundos
    })
  }

  async function ponerVideosEn(R, ms) {
    for (const v of videosDe(R)) {
      v.pause()
      await buscar(v, (ms / 1000) % (v.duration || 1))
    }
  }

  async function bajarImagen() {
    if (exportando) return
    ocupado(true)
    avisar("Preparando la imagen…")
    try {
      const R = construir(plantilla())
      const c = document.createElement("canvas")
      c.width = 1080
      c.height = R.H
      await ponerVideosEn(R, R.duracion)
      pintar(c.getContext("2d"), R.duracion, R, 1)
      const blob = await new Promise((resolver) => c.toBlob(resolver, "image/png"))
      await entregar(blob, nombreArchivo("png"))
    } catch {
      avisar("No se ha podido crear la imagen.", true)
    } finally {
      ocupado(false)
      if (reproduciendo) ponerReproduccion(true)
    }
  }

  /**
   * El codificador que haya: H.264, que es lo que mejor tragan Instagram y los
   * moviles, y si no VP9. Chrome, Edge y Safari traen H.264; algunos Chromium
   * libres solo VP9.
   */
  async function configuracionVideo(W, H) {
    if (!("VideoEncoder" in window) || !window.Mp4Muxer) return null
    const candidatos = [
      ...["avc1.640028", "avc1.4d0028", "avc1.42e028", "avc1.640032"].map((codec) => ({
        config: { codec, avc: { format: "avc" } },
        muxer: "avc",
      })),
      { config: { codec: "vp09.00.40.08" }, muxer: "vp9" },
    ]
    for (const c of candidatos) {
      const config = { ...c.config, width: W, height: H, bitrate: 12000000, framerate: FPS }
      try {
        const r = await VideoEncoder.isConfigSupported(config)
        if (r.supported) return { config, muxer: c.muxer }
      } catch {
        // Se prueba el siguiente.
      }
    }
    return null
  }

  /**
   * Video fotograma a fotograma con WebCodecs: cada fotograma se pinta en su
   * instante exacto, asi que sale fluido aunque el movil vaya lento.
   */
  async function videoFotogramaAFotograma(R, { config, muxer: codecMuxer }) {
    const c = document.createElement("canvas")
    c.width = 1080
    c.height = R.H
    const ctx = c.getContext("2d")
    const muxer = new window.Mp4Muxer.Muxer({
      target: new window.Mp4Muxer.ArrayBufferTarget(),
      video: { codec: codecMuxer, width: 1080, height: R.H, frameRate: FPS },
      fastStart: "in-memory",
    })
    let fallo = null
    const codificador = new VideoEncoder({
      output: (trozo, meta) => muxer.addVideoChunk(trozo, meta),
      error: (e) => {
        fallo = e
      },
    })
    codificador.configure(config)
    const total = Math.ceil((R.duracion / 1000) * FPS)
    for (let i = 0; i < total; i++) {
      if (fallo) throw fallo
      const ms = (i * 1000) / FPS
      await ponerVideosEn(R, ms)
      pintar(ctx, ms, R, 1)
      const fotograma = new VideoFrame(c, {
        timestamp: Math.round((i * 1e6) / FPS),
        duration: Math.round(1e6 / FPS),
      })
      codificador.encode(fotograma, { keyFrame: i % 60 === 0 })
      fotograma.close()
      while (codificador.encodeQueueSize > 6) {
        await new Promise((r) => setTimeout(r, 4))
      }
      if (i % 3 === 0) {
        progreso(i / total)
        await new Promise((r) => setTimeout(r, 0))
      }
    }
    await codificador.flush()
    if (fallo) throw fallo
    codificador.close()
    muxer.finalize()
    return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), extension: "mp4" }
  }

  /** Respaldo: se graba el lienzo en tiempo real mientras se reproduce. */
  async function videoGrabado(R) {
    if (!("MediaRecorder" in window)) throw new Error("sin-grabadora")
    const tipos = [
      "video/mp4;codecs=avc1.640028",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm",
    ]
    const tipo = tipos.find((x) => MediaRecorder.isTypeSupported(x))
    if (!tipo) throw new Error("sin-grabadora")
    const c = document.createElement("canvas")
    c.width = 1080
    c.height = R.H
    const ctx = c.getContext("2d")
    pintar(ctx, 0, R, 1)
    const grabadora = new MediaRecorder(c.captureStream(FPS), {
      mimeType: tipo,
      videoBitsPerSecond: 12000000,
    })
    const trozos = []
    grabadora.ondataavailable = (e) => {
      if (e.data && e.data.size) trozos.push(e.data)
    }
    const parada = new Promise((r) => {
      grabadora.onstop = r
    })
    for (const v of videosDe(R)) {
      v.currentTime = 0
      v.play().catch(() => {})
    }
    grabadora.start()
    const inicio = performance.now()
    await new Promise((resolver) => {
      const paso = () => {
        const ms = performance.now() - inicio
        pintar(ctx, Math.min(ms, R.duracion), R, 1)
        progreso(ms / R.duracion)
        if (ms >= R.duracion) resolver()
        else requestAnimationFrame(paso)
      }
      requestAnimationFrame(paso)
    })
    grabadora.stop()
    await parada
    return {
      blob: new Blob(trozos, { type: tipo }),
      extension: tipo.includes("mp4") ? "mp4" : "webm",
    }
  }

  async function bajarVideo() {
    if (exportando) return
    ocupado(true)
    progreso(0)
    avisar("Creando el vídeo… No cierres esta pestaña.")
    try {
      const R = construir(plantilla())
      const codificador = await configuracionVideo(1080, R.H)
      const video = codificador
        ? await videoFotogramaAFotograma(R, codificador)
        : await videoGrabado(R)
      progreso(1)
      await entregar(video.blob, nombreArchivo(video.extension))
    } catch (e) {
      avisar(
        e && e.message === "sin-grabadora"
          ? "Este navegador no puede crear vídeos. Prueba con Chrome, Edge o Safari actualizados."
          : "No se ha podido crear el vídeo. Vuelve a intentarlo.",
        true,
      )
    } finally {
      ocupado(false)
      if (reproduciendo) ponerReproduccion(true)
    }
  }

  // ---------- Arranque ----------

  function pintarMarca() {
    const c = $("#marca")
    const ctx = c.getContext("2d")
    const px = c.width
    ctx.setTransform(px / 100, 0, 0, px / 100, 0, 0)
    M.logo(ctx, 0, { x: 50, y: 50, tam: 100, estatico: true, brillo: false })
  }

  async function arrancar() {
    const tipos = [
      "400 60px Anton",
      "500 60px Archivo",
      "600 60px Archivo",
      "700 60px Archivo",
      "600 60px Cinzel",
    ]
    try {
      await Promise.all(tipos.map((f) => document.fonts.load(f, "AÁÑ¿“ñ")))
    } catch {
      // Sin las letras de la marca se usan las del sistema.
    }
    pintarMarca()
    montarControles()
    medirVista()
    ponerReproduccion(reproduciendo)
    if (!reproduciendo) t = construir(plantilla()).duracion
    requestAnimationFrame((ahora) => {
      ultimo = ahora
      bucle(ahora)
    })
  }

  arrancar()
})()
