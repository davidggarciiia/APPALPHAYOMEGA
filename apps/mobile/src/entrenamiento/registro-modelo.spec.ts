import {
  EdicionRegistroSchema,
  desdePrescripcion,
  edicionRecuperada,
  mejoraPersonal,
  registroParaEnviar,
  registroSinValidar,
  type PrescripcionConDistancia,
  type SerieConDistancia,
} from "./registro-modelo"
import {
  RegistroSchema,
  SerieRegistradaDistanciaSchema,
  mantieneUnidadYCarga,
  type Prescripcion,
  type SerieRegistrada,
  type ValoresEjecutados,
} from "@alpha-omega/shared"

const prescripcion: Prescripcion = {
  nombre: "Fuerza",
  ejercicios: [
    {
      id: "10000000-0000-4000-8000-000000000000",
      ejercicioId: "20000000-0000-4000-8000-000000000000",
      nombre: "Remo",
      indicaciones: null,
      series: [
        {
          id: "30000000-0000-4000-8000-000000000000",
          tipoMedicion: "repeticiones",
          pesoKg: 20,
          repeticiones: 10,
        },
        {
          id: "40000000-0000-4000-8000-000000000000",
          tipoMedicion: "tiempo",
          pesoKg: null,
          segundos: 30,
        },
      ],
    },
  ],
}

describe("D8 · mejora frente a la mejor serie anterior disponible", () => {
  const anterior: ValoresEjecutados = {
    tipoMedicion: "repeticiones",
    pesoKg: 40,
    repeticiones: 8,
  }
  const hecha: SerieRegistrada = {
    serieId: prescripcion.ejercicios[0]!.series[0]!.id,
    tipoMedicion: "repeticiones",
    hecha: true,
    pesoKg: 42.5,
    repeticiones: 8,
  }

  it.each([
    [42.5, 8, "+2,5 kg"],
    [42.5, 10, "+2,5 kg"],
    [40, 10, "+2 reps"],
    [42.5, 7, null],
    [40, 8, null],
    [40, 7, null],
    [37.5, 10, null],
    [null, 10, null],
  ])("con %s kg y %s reps devuelve %s", (pesoKg, repeticiones, mejora) => {
    expect(mejoraPersonal({ ...hecha, pesoKg, repeticiones }, anterior)).toBe(mejora)
  })

  it("conserva cero kilos y evita decimales binarios en la diferencia", () => {
    expect(
      mejoraPersonal({ ...hecha, pesoKg: 0, repeticiones: 10 }, { ...anterior, pesoKg: 0 }),
    ).toBe("+2 reps")
    expect(mejoraPersonal({ ...hecha, pesoKg: 0.3 }, { ...anterior, pesoKg: 0.1 })).toBe("+0,2 kg")
  })

  it("no inventa un récord sin anterior, con cantidad o carga desconocida ni sin completar", () => {
    expect(mejoraPersonal(hecha)).toBeNull()
    expect(mejoraPersonal(hecha, { ...anterior, pesoKg: null })).toBeNull()
    expect(mejoraPersonal({ ...hecha, repeticiones: null }, anterior)).toBeNull()
    expect(mejoraPersonal({ ...hecha, hecha: false }, anterior)).toBeNull()
    expect(mejoraPersonal({ ...hecha, omitida: true }, anterior)).toBeNull()
    expect(mejoraPersonal({ ...hecha, pesoKg: Number.NaN }, anterior)).toBeNull()
  })

  it.each([
    { tipoMedicion: "tiempo", pesoKg: 40, segundos: 8 },
    { tipoMedicion: "distancia", pesoKg: 40, metros: 8 },
  ] as const)("no compara $tipoMedicion con repeticiones ni con su propia unidad", (valores) => {
    expect(mejoraPersonal(hecha, valores)).toBeNull()
    expect(mejoraPersonal({ ...valores, serieId: hecha.serieId, hecha: true }, anterior)).toBeNull()
    expect(mejoraPersonal({ ...valores, serieId: hecha.serieId, hecha: true }, valores)).toBeNull()
  })
})
it("no convierte objetivos tenues ni campos vacíos en ejecución", () => {
  const edicion = desdePrescripcion(prescripcion)
  expect(edicion.series[0]).toMatchObject({ peso: "", valor: "", hecha: false })
  const registro = registroParaEnviar(prescripcion, edicion)
  expect(registro.series[0]).toMatchObject({ pesoKg: null, repeticiones: null, hecha: false })
  edicion.series[0]!.hecha = true
  expect(() => registroParaEnviar(prescripcion, edicion)).toThrow()
})
it("acepta coma decimal y tiempo sin peso, conservando lo escrito al desmarcar", () => {
  const edicion = desdePrescripcion(prescripcion)
  Object.assign(edicion.series[0]!, { peso: "22,5", valor: "8", hecha: true })
  Object.assign(edicion.series[1]!, { valor: "40", hecha: true })
  expect(registroParaEnviar(prescripcion, edicion).series).toEqual([
    {
      serieId: edicion.series[0]!.serieId,
      tipoMedicion: "repeticiones",
      pesoKg: 22.5,
      repeticiones: 8,
      hecha: true,
    },
    {
      serieId: edicion.series[1]!.serieId,
      tipoMedicion: "tiempo",
      pesoKg: null,
      segundos: 40,
      hecha: true,
    },
  ])
  edicion.series[0]!.hecha = false
  expect(registroParaEnviar(prescripcion, edicion).series[0]).toMatchObject({
    pesoKg: 22.5,
    repeticiones: 8,
    hecha: false,
  })
})
it("conserva la omisión y el tiempo activo sin convertir pendientes en omitidas", () => {
  const edicion = desdePrescripcion(prescripcion)
  edicion.series[0]!.omitida = true
  edicion.tiempoActivoSegundos = 95
  const registro = registroParaEnviar(prescripcion, edicion)
  expect(registro.tiempoActivoSegundos).toBe(95)
  expect(registro.series[0]).toMatchObject({ hecha: false, omitida: true })
  expect(registro.series[1]?.omitida).toBeUndefined()
  expect(desdePrescripcion(prescripcion, registro).series[0]?.omitida).toBe(true)
})

describe("Distancia en metros (D01)", () => {
  const u = (n: number): string => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`
  const transportes: PrescripcionConDistancia = {
    nombre: "Transportes",
    ejercicios: [
      {
        id: u(1),
        ejercicioId: u(101),
        nombre: "Paseo del granjero",
        indicaciones: null,
        tipoCarga: "conCargaExterna",
        series: [
          { id: u(11), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
          { id: u(12), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
        ],
      },
      {
        id: u(2),
        ejercicioId: u(102),
        nombre: "Zancadas caminando",
        indicaciones: null,
        tipoCarga: "sinCarga",
        series: [{ id: u(21), tipoMedicion: "distancia", pesoKg: null, metros: 30 }],
      },
    ],
  }
  const prescritas = new Map(
    transportes.ejercicios.flatMap((e) =>
      e.series.map((s) => [s.id, { serie: s, tipoCarga: e.tipoCarga }] as const),
    ),
  )

  it("prepara series vacías que no toman los metros pautados como ejecución", () => {
    const edicion = desdePrescripcion(transportes)
    expect(edicion.series).toEqual([
      { serieId: u(11), peso: "", valor: "", hecha: false },
      { serieId: u(12), peso: "", valor: "", hecha: false },
      { serieId: u(21), peso: "", valor: "", hecha: false },
    ])
    // La copia local no cambia de formato: la unidad la pone la prescripción.
    expect(EdicionRegistroSchema.parse(edicion)).toEqual(edicion)
    const [vacia] = registroSinValidar(transportes, edicion).series
    expect(vacia).toEqual({
      serieId: u(11),
      tipoMedicion: "distancia",
      pesoKg: null,
      metros: null,
      hecha: false,
    })
    expect(SerieRegistradaDistanciaSchema.safeParse(vacia).success).toBe(true)
  })

  it("guarda metros y kilos en su unidad y los recupera igual (ida y vuelta)", () => {
    const edicion = desdePrescripcion(transportes)
    Object.assign(edicion.series[0]!, { peso: "32,5", valor: "20", hecha: true, rir: 2 })
    Object.assign(edicion.series[2]!, { valor: "25", hecha: true })
    const registro = registroSinValidar(transportes, edicion)
    expect(registro.series).toEqual([
      {
        serieId: u(11),
        tipoMedicion: "distancia",
        pesoKg: 32.5,
        metros: 20,
        hecha: true,
        rir: 2,
      },
      { serieId: u(12), tipoMedicion: "distancia", pesoKg: null, metros: null, hecha: false },
      { serieId: u(21), tipoMedicion: "distancia", pesoKg: null, metros: 25, hecha: true },
    ])
    for (const serie of registro.series) {
      const prescrita = prescritas.get(serie.serieId)!
      expect(SerieRegistradaDistanciaSchema.parse(serie)).toEqual(serie)
      expect(mantieneUnidadYCarga(serie, prescrita.serie, prescrita.tipoCarga)).toBe(true)
    }
    expect(desdePrescripcion(transportes, registro)).toEqual(edicion)
  })

  it("no inventa kilos: sin peso escrito, el transporte con carga no se puede enviar", () => {
    const edicion = desdePrescripcion(transportes)
    Object.assign(edicion.series[0]!, { valor: "20", hecha: true })
    const [serie] = registroSinValidar(transportes, edicion).series
    expect(serie).toMatchObject({ pesoKg: null, metros: 20 })
    expect(mantieneUnidadYCarga(serie!, prescritas.get(u(11))!.serie, "conCargaExterna")).toBe(
      false,
    )
  })

  // D01.g invierte el cierre de D01.c: el contrato público ya acepta los metros.
  it("se guarda y se envía desde D01.g, con la carga que pide cada ejercicio", () => {
    const edicion = desdePrescripcion(transportes)
    Object.assign(edicion.series[0]!, { peso: "34", valor: "18", hecha: true })
    Object.assign(edicion.series[2]!, { valor: "25", hecha: true })
    const registro = registroParaEnviar(transportes, edicion)
    expect(RegistroSchema.parse(registro)).toEqual(registro)
    expect(registro.series).toEqual([
      { serieId: u(11), tipoMedicion: "distancia", pesoKg: 34, metros: 18, hecha: true },
      { serieId: u(12), tipoMedicion: "distancia", pesoKg: null, metros: null, hecha: false },
      { serieId: u(21), tipoMedicion: "distancia", pesoKg: null, metros: 25, hecha: true },
    ])
    // Sin peso escrito, el transporte con carga sigue sin poder enviarse.
    Object.assign(edicion.series[0]!, { peso: "" })
    expect(() => registroParaEnviar(transportes, edicion)).toThrow()
  })

  const UNIDADES = ["repeticiones", "tiempo", "distancia"] as const
  const serieEn = (tipo: (typeof UNIDADES)[number]): SerieConDistancia => {
    switch (tipo) {
      case "repeticiones":
        return { id: u(31), tipoMedicion: tipo, pesoKg: 20, repeticiones: 10 }
      case "tiempo":
        return { id: u(31), tipoMedicion: tipo, pesoKg: 20, segundos: 30 }
      case "distancia":
        return { id: u(31), tipoMedicion: tipo, pesoKg: 20, metros: 20 }
    }
  }
  const pautaEn = (tipo: (typeof UNIDADES)[number]): PrescripcionConDistancia => ({
    nombre: "Cambio de pauta",
    ejercicios: [
      {
        id: u(3),
        ejercicioId: u(103),
        nombre: "Transporte con saco",
        indicaciones: null,
        tipoCarga: "conCargaExterna",
        series: [serieEn(tipo)],
      },
    ],
  })

  it.each(UNIDADES.flatMap((antes) => UNIDADES.map((ahora) => [antes, ahora] as const)))(
    "de %s a %s: solo vuelve lo registrado en la misma unidad, sin convertirlo",
    (antes, ahora) => {
      const anterior = pautaEn(antes)
      const nueva = pautaEn(ahora)
      const hecha = { serieId: u(31), peso: "20", valor: "12", hecha: true, rir: 3 }
      const edicion = { ...desdePrescripcion(anterior), notas: "mi copia", series: [hecha] }
      const esperada =
        antes === ahora ? hecha : { serieId: u(31), peso: "", valor: "", hecha: false }

      // Un registro guardado en otra unidad no se reinterpreta al prepararlo.
      const registro = registroSinValidar(anterior, edicion)
      expect(registro.series[0]?.tipoMedicion).toBe(antes)
      expect(desdePrescripcion(nueva, registro).series).toEqual([esperada])

      // Recuperar la copia deja pendiente la serie incompatible y no toca el respaldo.
      const recuperada = edicionRecuperada({ edicion, prescripcion: anterior }, nueva)
      expect(recuperada.series).toEqual([esperada])
      expect(recuperada.notas).toBe("mi copia")
      expect(edicion.series).toEqual([hecha])

      const [enviada] = registroSinValidar(nueva, recuperada).series
      expect(enviada?.tipoMedicion).toBe(ahora)
      expect(enviada).toMatchObject({ hecha: antes === ahora })
      if (antes !== ahora) expect(Object.values(enviada!)).not.toContain(12)
    },
  )
})
