/* global window, document */
/**
 * Convierte las piezas de redes en los archivos que se suben: MP4 para las
 * animadas y PNG para las fijas.
 *
 * Abre cada pieza en Chromium, para todas sus animaciones y las pone en el
 * instante de cada fotograma antes de hacer la captura. Asi el video no depende
 * de lo rapido que vaya la maquina: sale fotograma a fotograma, a 30 por segundo.
 *
 * Necesita Playwright con su Chromium y ffmpeg con libx264:
 *
 *     npm install --global playwright
 *     node marca/redes/render.cjs              # todas las piezas
 *     node marca/redes/render.cjs intro-9x16   # solo las que se nombren
 *     node marca/redes/render.cjs intro-9x16 --muestra 0,1500,3000
 *                                              # PNG de esos instantes, para revisar
 *
 * Si ffmpeg no esta en el PATH, se le dice donde esta con FFMPEG=/ruta/ffmpeg.
 */

const { spawn, execSync } = require("node:child_process")
const fs = require("node:fs")
const http = require("node:http")
const path = require("node:path")

const RAIZ = __dirname
const EXPORTADOS = path.join(RAIZ, "exportados")
const FFMPEG = process.env.FFMPEG || "ffmpeg"
const FPS = 30

/**
 * Todas las piezas. `pagina` es relativa a esta carpeta; `video` y `imagen`, a
 * exportados/. `portada` es el instante, en ms, que se guarda como PNG: sirve de
 * portada del reel o de imagen fija de la misma pieza.
 */
const PIEZAS = require("./piezas.json")

function cargarPlaywright() {
  try {
    return require("playwright")
  } catch {
    const global = execSync("npm root --global").toString().trim()
    return require(path.join(global, "playwright"))
  }
}

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
}

/** Sirve esta carpeta por HTTP: las fuentes no cargan bien desde file://. */
function servir() {
  const servidor = http.createServer((peticion, respuesta) => {
    const ruta = decodeURIComponent(new globalThis.URL(peticion.url, "http://x").pathname)
    const archivo = path.join(RAIZ, path.normalize(ruta))
    if (
      !archivo.startsWith(RAIZ) ||
      !fs.existsSync(archivo) ||
      fs.statSync(archivo).isDirectory()
    ) {
      respuesta.writeHead(404)
      respuesta.end()
      return
    }
    respuesta.writeHead(200, {
      "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream",
    })
    fs.createReadStream(archivo).pipe(respuesta)
  })
  return new Promise((resolver) => {
    servidor.listen(0, "127.0.0.1", () => resolver(servidor))
  })
}

/**
 * Pone la pagina en el instante `ms`. Las piezas de lienzo.html se pintan con
 * window.IR_A; las HTML, parando y moviendo sus animaciones CSS.
 */
async function irA(pagina, ms) {
  await pagina.evaluate((instante) => {
    if (window.IR_A) {
      window.IR_A(instante)
      return
    }
    for (const animacion of document.getAnimations()) {
      animacion.pause()
      animacion.currentTime = instante
    }
  }, ms)
}

function codificar(destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  // Chromium captura en sRGB; se pasa a BT.709, que es lo que esperan los
  // moviles para video HD, y se marca como tal para que nadie lo reinterprete.
  const ffmpeg = spawn(
    FFMPEG,
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(FPS),
      "-i",
      "-",
      "-vf",
      "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "16",
      "-tune",
      "grain",
      "-profile:v",
      "high",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-movflags",
      "+faststart",
      destino,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  )
  const terminado = new Promise((resolver, rechazar) => {
    ffmpeg.on("close", (codigo) =>
      codigo === 0 ? resolver() : rechazar(new Error(`ffmpeg acabo con ${codigo}`)),
    )
  })
  return {
    escribir(png) {
      return new Promise((resolver) => {
        if (ffmpeg.stdin.write(png)) {
          resolver()
        } else {
          ffmpeg.stdin.once("drain", resolver)
        }
      })
    },
    cerrar() {
      ffmpeg.stdin.end()
      return terminado
    },
  }
}

async function renderizar(navegador, base, pieza, muestras) {
  const contexto = await navegador.newContext({
    viewport: { width: pieza.ancho, height: pieza.alto },
    deviceScaleFactor: 1,
  })
  const pagina = await contexto.newPage()
  const separador = pieza.pagina.includes("?") ? "&" : "?"
  await pagina.goto(`${base}/${pieza.pagina}${separador}render`)
  await pagina.evaluate(() => window.LISTO)
  const lienzo = pagina.locator(".lienzo")

  if (muestras) {
    const carpeta = path.join(EXPORTADOS, "_muestras")
    fs.mkdirSync(carpeta, { recursive: true })
    for (const ms of muestras) {
      await irA(pagina, ms)
      await lienzo.screenshot({ path: path.join(carpeta, `${pieza.id}-${ms}.png`) })
    }
    await contexto.close()
    console.log(`${pieza.id}: ${muestras.length} muestras`)
    return
  }

  const duracion = await pagina.evaluate(() => window.DURACION || 0)
  if (pieza.video) {
    const fotogramas = Math.round((duracion / 1000) * FPS)
    const salida = codificar(path.join(EXPORTADOS, pieza.video))
    for (let f = 0; f < fotogramas; f++) {
      await irA(pagina, (f * 1000) / FPS)
      await salida.escribir(await lienzo.screenshot({ type: "png" }))
    }
    await salida.cerrar()
  }
  if (pieza.imagen) {
    const destino = path.join(EXPORTADOS, pieza.imagen)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    await irA(pagina, pieza.portada ?? duracion)
    await lienzo.screenshot({ path: destino })
  }
  await contexto.close()
  console.log(`${pieza.id}: ${[pieza.video, pieza.imagen].filter(Boolean).join(" y ")}`)
}

async function principal() {
  const argumentos = process.argv.slice(2)
  const i = argumentos.indexOf("--muestra")
  const muestras = i >= 0 ? argumentos[i + 1].split(",").map(Number) : null
  const nombres = argumentos.filter((a, j) => !a.startsWith("--") && j !== i + 1)
  const piezas = nombres.length ? PIEZAS.filter((p) => nombres.includes(p.id)) : PIEZAS
  if (nombres.length && piezas.length !== nombres.length) {
    const conocidas = PIEZAS.map((p) => p.id).join(", ")
    throw new Error(`No conozco alguna de esas piezas. Hay: ${conocidas}`)
  }

  const servidor = await servir()
  const base = `http://127.0.0.1:${servidor.address().port}`
  const navegador = await cargarPlaywright().chromium.launch()
  try {
    // De cuatro en cuatro: cada pieza tiene su pestaña y su ffmpeg.
    const cola = [...piezas]
    const obreros = Array.from({ length: Math.min(4, cola.length) }, async () => {
      while (cola.length) {
        await renderizar(navegador, base, cola.shift(), muestras)
      }
    })
    await Promise.all(obreros)
  } finally {
    await navegador.close()
    servidor.close()
  }
}

principal().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
