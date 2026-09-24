import {
  CambiarDiaSchema,
  ConfiguracionSeguimientoSchema,
  DiaDeSeguimientoSchema,
  EstadoConsentimientoSchema,
  GuardarConfiguracionSeguimientoSchema,
  ListadoDiasSchema,
  MedidaSchema,
  PaginaMedidasSchema,
  PaginaPruebasSchema,
  ProgresionFuerzaSchema,
  PruebaFisicaSchema,
  RegistrarMedidaSchema,
  RegistrarPruebaSchema,
  type CambiarDia,
  type ConfiguracionSeguimiento,
  type DiaDeSeguimiento,
  type EstadoConsentimiento,
  type GuardarConfiguracionSeguimiento,
  type ListadoDias,
  type ListadoMedidas,
  type ListadoPruebas,
  type Medida,
  type ProgresionFuerza,
  type PruebaFisica,
  type RegistrarMedida,
  type RegistrarPrueba,
} from "@alpha-omega/shared"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { LIMITE_PAGINA, historicoCompleto, ordenMedidas, ordenPruebas } from "./paginas"

export type ApiSeguimiento = {
  configuracion: (clienteId: string) => Promise<ConfiguracionSeguimiento>
  guardarConfiguracion: (
    clienteId: string,
    datos: GuardarConfiguracionSeguimiento,
  ) => Promise<ConfiguracionSeguimiento>
  cambiarDia: (clienteId: string, fecha: string, cambio: CambiarDia) => Promise<DiaDeSeguimiento>
  dias: (clienteId: string, desde: string, hasta: string) => Promise<ListadoDias>
  /** Todas las medidas, de la más antigua a la más reciente; rechaza si falta alguna página. */
  medidas: (clienteId: string) => Promise<ListadoMedidas>
  registrarMedida: (clienteId: string, datos: RegistrarMedida) => Promise<Medida>
  /** Todas las pruebas, por nombre y fecha; rechaza si falta alguna página. */
  pruebas: (clienteId: string) => Promise<ListadoPruebas>
  registrarPrueba: (clienteId: string, datos: RegistrarPrueba) => Promise<PruebaFisica>
  fuerza: (clienteId: string) => Promise<ProgresionFuerza>
  /** Consentimiento de datos de salud del cliente; solo lectura para su equipo. */
  consentimiento: (clienteId: string) => Promise<EstadoConsentimiento>
}

export function crearApiSeguimiento(pedir: PeticionAutenticada): ApiSeguimiento {
  const base = (clienteId: string): string =>
    `/seguimiento/clientes/${encodeURIComponent(clienteId)}`
  // Histórico por páginas, de lo más reciente a lo más antiguo; el cursor viaja tal cual llegó.
  const pagina = (
    clienteId: string,
    historico: "medidas" | "pruebas",
    cursor: string | undefined,
  ): string =>
    `${base(clienteId)}/${historico}/pagina?limite=${LIMITE_PAGINA}` +
    (cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`)
  return {
    configuracion: (clienteId) =>
      pedir(`${base(clienteId)}/configuracion`, ConfiguracionSeguimientoSchema),
    guardarConfiguracion: (clienteId, datos) =>
      pedir(`${base(clienteId)}/configuracion`, ConfiguracionSeguimientoSchema, {
        method: "PUT",
        body: JSON.stringify(GuardarConfiguracionSeguimientoSchema.parse(datos)),
      }),
    cambiarDia: (clienteId, fecha, cambio) =>
      pedir(`${base(clienteId)}/dias/${encodeURIComponent(fecha)}`, DiaDeSeguimientoSchema, {
        method: "PUT",
        body: JSON.stringify(CambiarDiaSchema.parse(cambio)),
      }),
    dias: (clienteId, desde, hasta) =>
      pedir(
        `${base(clienteId)}/dias?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
        ListadoDiasSchema,
      ),
    medidas: async (clienteId) => {
      const { primera, filas } = await historicoCompleto(
        (cursor) => pedir(pagina(clienteId, "medidas", cursor), PaginaMedidasSchema),
        (leida) => leida.medidas,
        ordenMedidas,
      )
      return { medidas: filas, fechaNacimiento: primera.fechaNacimiento }
    },
    registrarMedida: (clienteId, datos) =>
      pedir(`${base(clienteId)}/medidas`, MedidaSchema, {
        method: "POST",
        body: JSON.stringify(RegistrarMedidaSchema.parse(datos)),
      }),
    pruebas: async (clienteId) => {
      const { filas } = await historicoCompleto(
        (cursor) => pedir(pagina(clienteId, "pruebas", cursor), PaginaPruebasSchema),
        (leida) => leida.pruebas,
        ordenPruebas,
      )
      return { pruebas: filas }
    },
    registrarPrueba: (clienteId, datos) =>
      pedir(`${base(clienteId)}/pruebas`, PruebaFisicaSchema, {
        method: "POST",
        body: JSON.stringify(RegistrarPruebaSchema.parse(datos)),
      }),
    fuerza: (clienteId) =>
      pedir(
        `/entrenamiento/clientes/${encodeURIComponent(clienteId)}/fuerza`,
        ProgresionFuerzaSchema,
      ),
    consentimiento: (clienteId) =>
      pedir(`${base(clienteId)}/consentimiento`, EstadoConsentimientoSchema),
  }
}
