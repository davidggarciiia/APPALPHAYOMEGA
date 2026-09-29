/* global window, document, location, setTimeout, URLSearchParams */
/**
 * Piezas de redes de Alpha & Omega Training: el logo animado y lo que comparten
 * todas las piezas.
 *
 * Cada pieza es una pagina con animaciones CSS y retrasos fijos, sin nada que
 * dependa del reloj. Asi render.cjs puede parar todas las animaciones y ponerlas
 * en el instante de cada fotograma, y el video sale igual que la pagina.
 *
 * En el navegador la pieza se reproduce sola. Con ?bucle se repite, y un toque
 * la vuelve a empezar.
 */
;(function () {
  const TRAZOS = window.TRAZOS
  const NS = "http://www.w3.org/2000/svg"
  const SALIDA = "cubic-bezier(0.23, 1, 0.32, 1)"
  const DENTRO_Y_FUERA = "cubic-bezier(0.77, 0, 0.175, 1)"

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

  const parametros = new URLSearchParams(location.search)
  const renderizando = parametros.has("render")
  let contador = 0

  function redondo(ms) {
    return Math.round(ms)
  }

  /**
   * El logo, que se construye igual que en la pantalla de carga de la app:
   *
   * 1. Los aros se trazan desde arriba. 2. El contorno de omega, alfa y el rayo
   * se dibuja y 3. se llena de oro. 4. TRAINING aparece letra a letra. 5. Una
   * banda de luz cruza el logo. 6. Un destello recorre el aro grueso.
   *
   * - inicio: ms en que empieza.
   * - escala: alarga los tiempos de la app. En video 1,7 se lee mejor que 1.
   * - partes: { aros, emblema, letras } para dibujar solo una parte.
   * - brillo: si la banda de luz cruza el logo. Por defecto, si no es estatico.
   * - brilloEn: cuando cruza, en ms. Por defecto, al final de la construccion.
   * - destello: { aro, inicio, periodo, sentido }, o una lista de ellos. Por
   *   defecto el aro es el grueso y va en el sentido del reloj.
   * - estatico: el logo entero, sin construirse.
   */
  function logo(opciones) {
    const op = opciones || {}
    const id = `ao${++contador}`
    const k = op.escala ?? 1
    const t0 = op.inicio ?? 0
    const en = (ms) => redondo(t0 + ms * k)
    const dura = (ms) => redondo(ms * k)
    const estatico = Boolean(op.estatico)
    const partes = { aros: true, emblema: true, letras: true, ...op.partes }
    const brillo = op.brillo ?? !estatico
    // Un destello o varios: { aro, inicio, periodo, sentido }. Corren tambien
    // sobre el logo estatico, para los fondos en bucle.
    const destellos = [op.destello || []].flat()
    const oro = `url(#${id}-oro)`

    const animar = (valor) => (estatico ? "" : `animation:${valor}`)

    let defs = `<linearGradient id="${id}-oro" gradientUnits="userSpaceOnUse" x1="-600" y1="-600" x2="600" y2="600">${ORO.map(
      ([d, c]) => `<stop offset="${d}" stop-color="${c}"/>`,
    ).join("")}</linearGradient>`

    let cuerpo = ""

    if (partes.aros) {
      const sentidos = [1, -1, 1]
      const retrasos = [0, 60, 120]
      const duraciones = [600, 540, 540]
      TRAZOS.AROS.forEach((aro, i) => {
        cuerpo += `<path d="${aro.d}" fill="none" stroke="${oro}" stroke-width="${aro.grosor}" style="stroke-dasharray:${aro.largo} ${aro.largo};--desde:${aro.largo * sentidos[i]}px;${animar(
          `dibujar ${dura(duraciones[i])}ms ${DENTRO_Y_FUERA} ${en(retrasos[i])}ms both`,
        )}"/>`
      })
    }

    if (partes.emblema) {
      if (!estatico) {
        TRAZOS.CONTORNOS.forEach((c) => {
          cuerpo += `<path d="${c.d}" fill="none" stroke="${oro}" stroke-width="4" style="stroke-dasharray:${c.largo} ${c.largo};--desde:${c.largo}px;${animar(
            `dibujar ${dura(600)}ms ${DENTRO_Y_FUERA} ${en(120)}ms both, desaparecer ${dura(300)}ms ${SALIDA} ${en(620)}ms forwards`,
          )}"/>`
        })
      }
      const llenar = animar(`aparecer ${dura(300)}ms ${SALIDA} ${en(620)}ms both`)
      TRAZOS.RELLENOS.forEach((d) => {
        cuerpo += `<path d="${d}" fill="${oro}" fill-rule="evenodd" style="${llenar}"/>`
      })
      // Sin esto, en oro liso el rayo y el arco del omega se funden y deja de
      // verse que el rayo pasa por encima.
      TRAZOS.CANTOS.forEach((d) => {
        cuerpo += `<path d="${d}" fill="none" stroke="#5c430d" stroke-width="3" stroke-opacity="0.75" style="${llenar}"/>`
      })
    }

    if (partes.letras) {
      TRAZOS.LETRAS.forEach((d, i) => {
        cuerpo += `<path d="${d}" fill="${oro}" fill-rule="evenodd" style="${animar(
          `aparecer ${dura(280)}ms ${SALIDA} ${en(700 + i * 30)}ms both`,
        )}"/>`
      })
    }

    if (brillo) {
      // La luz solo cae donde hay oro: una banda que cruza por detras de una
      // mascara con la forma del logo.
      let mascara = ""
      if (partes.aros) {
        TRAZOS.AROS.forEach((aro) => {
          mascara += `<path d="${aro.d}" fill="none" stroke="#fff" stroke-width="${aro.grosor}"/>`
        })
      }
      const formas = [
        ...(partes.emblema ? TRAZOS.RELLENOS : []),
        ...(partes.letras ? TRAZOS.LETRAS : []),
      ]
      formas.forEach((d) => {
        mascara += `<path d="${d}" fill="#fff" fill-rule="evenodd"/>`
      })
      defs += `<linearGradient id="${id}-banda" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6d6" stop-opacity="0"/><stop offset="0.5" stop-color="#fff6d6" stop-opacity="0.85"/><stop offset="1" stop-color="#fff6d6" stop-opacity="0"/></linearGradient>`
      defs += `<mask id="${id}-mascara" maskUnits="userSpaceOnUse" x="-620" y="-620" width="1240" height="1240">${mascara}</mask>`
      const cuando = op.brilloEn ?? en(900)
      cuerpo += `<g mask="url(#${id}-mascara)"><g transform="rotate(45)"><rect x="-150" y="-1500" width="300" height="3000" fill="url(#${id}-banda)" style="transform:translateX(-1700px);animation:cruzar ${dura(600)}ms ${DENTRO_Y_FUERA} ${cuando}ms both"/></g></g>`
    }

    if (destellos.length && partes.aros) {
      // Dos tramos de luz: uno ancho y tenue y otro corto y vivo centrado en el,
      // para que no tenga bordes duros.
      destellos.forEach((de) => {
        const aro = TRAZOS.AROS[de.aro ?? 0]
        const largo = aro.largo
        const inicio = redondo(de.inicio ?? en(1500))
        const periodo = redondo(de.periodo ?? dura(2200))
        const sentido = de.sentido ?? 1
        const tramo = (parte, opacidad, desfase) =>
          `<path d="${aro.d}" fill="none" stroke="#fff4cf" stroke-opacity="${opacidad}" stroke-width="${aro.grosor}" style="stroke-dasharray:${largo * parte} ${largo * (1 - parte)};--desde:${-desfase}px;--hasta:${-desfase - largo * sentido}px;opacity:0;animation:aparecer 200ms ${SALIDA} ${inicio}ms both, recorrer ${periodo}ms linear ${inicio}ms infinite"/>`
        cuerpo += tramo(0.1, 0.28, 0) + tramo(0.04, 0.75, 0.03 * largo)
      })
    }

    const svg = document.createElementNS(NS, "svg")
    svg.setAttribute("viewBox", "-600 -600 1200 1200")
    svg.setAttribute("aria-label", "Alpha & Omega Training")
    svg.setAttribute("role", "img")
    svg.innerHTML = `<defs>${defs}</defs>${cuerpo}`
    return svg
  }

  /**
   * Parte el texto de un elemento en letras, cada una con su animacion y un
   * retraso escalonado. Respeta los <br> y los elementos de dentro.
   *
   * - animacion: nombre del @keyframes (subir, aparecer, asomar...).
   * - inicio, paso, duracion: en ms.
   * - curva: la de salida por defecto.
   */
  function letras(el, opciones) {
    const op = opciones || {}
    const animacion = op.animacion || "subir"
    const inicio = op.inicio ?? 0
    const paso = op.paso ?? 40
    const duracion = op.duracion ?? 600
    const curva = op.curva || SALIDA
    const extra = op.extra ? `, ${op.extra}` : ""
    let i = 0

    function partir(nodo) {
      Array.from(nodo.childNodes).forEach((hijo) => {
        if (hijo.nodeType === 3) {
          const trozos = hijo.textContent.split(/(\s+)/)
          const fragmento = document.createDocumentFragment()
          trozos.forEach((trozo) => {
            if (trozo === "") {
              return
            }
            if (/^\s+$/.test(trozo)) {
              fragmento.appendChild(document.createTextNode(" "))
              return
            }
            const palabra = document.createElement("span")
            palabra.className = "palabra"
            Array.from(trozo).forEach((caracter) => {
              const letra = document.createElement("span")
              letra.className = "letra"
              letra.textContent = caracter
              letra.style.animation = `${animacion} ${duracion}ms ${curva} ${redondo(inicio + i * paso)}ms both${extra}`
              i += 1
              palabra.appendChild(letra)
            })
            fragmento.appendChild(palabra)
          })
          hijo.replaceWith(fragmento)
        } else if (hijo.nodeType === 1 && hijo.tagName !== "BR") {
          partir(hijo)
        }
      })
    }

    partir(el)
    if (el.classList.contains("metal")) {
      el.classList.remove("metal")
      el.classList.add("metal-padre")
      el.querySelectorAll(".letra").forEach((letra) => {
        letra.classList.add("metal")
      })
    }
    return i
  }

  /**
   * Coloca el oro de cada texto metalico. Una letra suelta pinta solo su trozo
   * del degradado, asi que se le dice donde esta dentro de la palabra para que
   * el oro y la luz sigan de una letra a la siguiente.
   */
  function colocarMetal() {
    document.querySelectorAll(".metal").forEach((el) => {
      const padre = el.closest(".metal-padre")
      if (padre && padre !== el) {
        let x = 0
        let y = 0
        let nodo = el
        while (nodo && nodo !== padre) {
          x += nodo.offsetLeft
          y += nodo.offsetTop
          nodo = nodo.offsetParent
        }
        el.style.setProperty("--metal-x", `${-x}px`)
        el.style.setProperty("--metal-y", `${-y}px`)
      } else {
        el.style.setProperty("--metal-x", "0px")
        el.style.setProperty("--metal-y", "0px")
        el.style.setProperty("--caja-ancho", `${el.offsetWidth}px`)
        el.style.setProperty("--caja-alto", `${el.offsetHeight}px`)
      }
    })
    document.querySelectorAll(".metal-padre").forEach((el) => {
      el.style.setProperty("--caja-ancho", `${el.offsetWidth}px`)
      el.style.setProperty("--caja-alto", `${el.offsetHeight}px`)
    })
  }

  /**
   * Deja la pieza lista: espera a las letras, coloca el oro y, en el navegador,
   * arranca todas las animaciones a la vez.
   */
  function preparar(opciones) {
    const op = opciones || {}
    window.DURACION = op.duracion
    const formato = parametros.get("formato")
    if (formato) {
      document.documentElement.classList.add(`formato-${formato}`)
    }
    // Se piden las tres letras de la marca aunque la pagina no haya pintado
    // aun: sin esto `fonts.ready` puede resolverse antes de que empiecen a cargar.
    const tipos = ["400 50px Anton", "400 50px Archivo", "700 50px Archivo", "600 50px Cinzel"]
    window.LISTO = Promise.all(tipos.map((tipo) => document.fonts.load(tipo)))
      .then(() => document.fonts.ready)
      .then(() => {
        if (op.alPreparar) {
          op.alPreparar()
        }
        colocarMetal()
        if (renderizando) {
          return
        }
        document.documentElement.classList.add("en-marcha")
        document.addEventListener("click", () => location.reload())
        if (parametros.has("bucle")) {
          setTimeout(() => location.reload(), op.duracion + 600)
        }
      })
    return window.LISTO
  }

  window.AO = {
    logo,
    letras,
    preparar,
    parametros,
    SALIDA,
    DENTRO_Y_FUERA,
  }
})()
