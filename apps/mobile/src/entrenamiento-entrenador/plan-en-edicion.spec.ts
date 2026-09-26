import type { PatronRutina } from "@alpha-omega/shared"

import {
  aAjuste,
  aPatron,
  anadirEjercicio,
  anadirSerie,
  cambiarMedicion,
  cambiarSerie,
  desdePatron,
  ejercicioNuevo,
  moverEjercicio,
  quitarSerie,
  sesionNueva,
  type NuevoId,
} from "./plan-en-edicion"

/** Ids válidos y predecibles. */
function contador(): NuevoId {
  let n = 0
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
}

const PRESS = { id: "10000000-0000-4000-8000-000000000001", nombre: "Press de banca" }
const REMO = { id: "10000000-0000-4000-8000-000000000002", nombre: "Remo con barra" }

describe("el editor de planes", () => {
  it("un ejercicio nuevo trae 3 series de 10 sin carga", () => {
    const ejercicio = ejercicioNuevo(contador(), PRESS)
    expect(ejercicio.series).toHaveLength(3)
    expect(ejercicio.series.every((s) => s.valor === "10" && s.peso === "")).toBe(true)
  })

  it("añadir serie copia la última con otro id; quitarla la quita", () => {
    const nuevoId = contador()
    let sesion = anadirEjercicio(sesionNueva(nuevoId, 1, "Torso"), ejercicioNuevo(nuevoId, PRESS))
    const ejercicioId = sesion.ejercicios[0]?.id ?? ""
    const ultima = sesion.ejercicios[0]?.series[2]?.id ?? ""
    sesion = cambiarSerie(sesion, ejercicioId, ultima, { peso: "42,5", valor: "8" })
    sesion = anadirSerie(sesion, ejercicioId, nuevoId)
    const series = sesion.ejercicios[0]?.series ?? []
    expect(series).toHaveLength(4)
    expect(series[3]).toMatchObject({ peso: "42,5", valor: "8" })
    expect(series[3]?.id).not.toBe(ultima)
    sesion = quitarSerie(sesion, ejercicioId, series[0]?.id ?? "")
    expect(sesion.ejercicios[0]?.series).toHaveLength(3)
  })

  it("mover no se sale de los extremos", () => {
    const nuevoId = contador()
    let sesion = sesionNueva(nuevoId, 1, "Torso")
    sesion = anadirEjercicio(sesion, ejercicioNuevo(nuevoId, PRESS))
    sesion = anadirEjercicio(sesion, ejercicioNuevo(nuevoId, REMO))
    const [press, remo] = sesion.ejercicios
    expect(moverEjercicio(sesion, press?.id ?? "", -1)).toBe(sesion)
    const bajado = moverEjercicio(sesion, press?.id ?? "", 1)
    expect(bajado.ejercicios.map((e) => e.nombre)).toEqual(["Remo con barra", "Press de banca"])
    expect(moverEjercicio(bajado, remo?.id ?? "", 1).ejercicios[1]?.nombre).toBe("Remo con barra")
  })

  it("pasar a tiempo cambia todas las series y pone un valor de partida", () => {
    const nuevoId = contador()
    const sesion = anadirEjercicio(sesionNueva(nuevoId, 1, "Core"), ejercicioNuevo(nuevoId, PRESS))
    const cambiada = cambiarMedicion(sesion, sesion.ejercicios[0]?.id ?? "", "tiempo")
    expect(cambiada.ejercicios[0]?.series.every((s) => s.tipoMedicion === "tiempo")).toBe(true)
    expect(cambiada.ejercicios[0]?.series[0]?.valor).toBe("30")
  })

  it("convierte a patrón con coma decimal y carga vacía como sin carga", () => {
    const nuevoId = contador()
    let sesion = anadirEjercicio(
      sesionNueva(nuevoId, 3, " Pierna "),
      ejercicioNuevo(nuevoId, PRESS),
    )
    const ejercicio = sesion.ejercicios[0]
    sesion = cambiarSerie(sesion, ejercicio?.id ?? "", ejercicio?.series[0]?.id ?? "", {
      peso: "42,5",
    })
    const leido = aPatron([sesion])
    expect(leido.ok).toBe(true)
    if (!leido.ok) return
    const sesionLeida = leido.valor.sesiones[0]
    expect(sesionLeida?.nombre).toBe("Pierna")
    expect(sesionLeida?.diaSemana).toBe(3)
    expect(sesionLeida?.ejercicios[0]?.series[0]).toMatchObject({ pesoKg: 42.5, repeticiones: 10 })
    expect(sesionLeida?.ejercicios[0]?.series[1]).toMatchObject({ pesoKg: null })
    expect(sesionLeida?.ejercicios[0]?.indicaciones).toBeNull()
  })

  it("dice todo lo que falta en vez de guardar a medias", () => {
    const nuevoId = contador()
    let conFallos = anadirEjercicio(sesionNueva(nuevoId, 1, ""), ejercicioNuevo(nuevoId, PRESS))
    const ejercicio = conFallos.ejercicios[0]
    conFallos = cambiarSerie(conFallos, ejercicio?.id ?? "", ejercicio?.series[1]?.id ?? "", {
      valor: "",
      peso: "abc",
    })
    const vacia = sesionNueva(nuevoId, 5, "Brazos")
    const leido = aPatron([conFallos, vacia])
    expect(leido.ok).toBe(false)
    if (leido.ok) return
    expect(leido.errores).toEqual([
      "La sesión del Lunes no tiene nombre.",
      "Press de banca, serie 2: Escribe el peso en kg, con hasta dos decimales.",
      "Press de banca, serie 2: faltan las repeticiones.",
      "«Brazos» no tiene ejercicios.",
    ])
    expect(aPatron([])).toEqual({ ok: false, errores: ["Añade al menos una sesión."] })
  })

  it("cargar una rutina en un plan hace copias con ids nuevos; editarla los conserva", () => {
    const patron: PatronRutina = {
      sesiones: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          nombre: "Torso",
          diaSemana: 1,
          ejercicios: [
            {
              id: "20000000-0000-4000-8000-000000000002",
              ejercicioId: PRESS.id,
              indicaciones: "Baja en 2 s",
              series: [
                {
                  id: "20000000-0000-4000-8000-000000000003",
                  tipoMedicion: "repeticiones",
                  pesoKg: 40,
                  repeticiones: 10,
                },
              ],
            },
          ],
        },
      ],
    }
    const nombres = new Map([[PRESS.id, PRESS.nombre]])
    const copia = desdePatron(patron, nombres, contador())
    expect(copia[0]?.id).not.toBe(patron.sesiones[0]?.id)
    expect(copia[0]?.ejercicios[0]).toMatchObject({
      nombre: "Press de banca",
      indicaciones: "Baja en 2 s",
      series: [{ peso: "40", valor: "10" }],
    })
    const misma = desdePatron(patron, nombres)
    expect(misma[0]?.ejercicios[0]?.series[0]?.id).toBe("20000000-0000-4000-8000-000000000003")
    const ida = aPatron(misma)
    expect(ida.ok && ida.valor).toEqual(patron)
  })

  it("un ajuste necesita nombre y ejercicios", () => {
    expect(aAjuste(sesionNueva(contador(), 1, ""))).toEqual({
      ok: false,
      errores: ["La sesión no tiene nombre.", "La sesión no tiene ejercicios."],
    })
  })
})
