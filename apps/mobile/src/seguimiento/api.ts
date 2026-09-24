import {
  CambiarDiaSchema,
  ConfiguracionSeguimientoSchema,
  DiaDeSeguimientoSchema,
  EstadoConsentimientoSchema,
  GuardarConfiguracionSeguimientoSchema,
  ListadoDiasSchema,
  ListadoMedidasSchema,
  ListadoPruebasSchema,
  MedidaSchema,
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

export type ApiSeguimiento = {
  configuracion: (clienteId: string) => Promise<ConfiguracionSeguimiento>
  guardarConfiguracion: (
    clienteId: string,
    datos: GuardarConfiguracionSeguimiento,
  ) => Promise<ConfiguracionSeguimiento>
  cambiarDia: (clienteId: string, fecha: string, cambio: CambiarDia) => Promise<DiaDeSeguimiento>
  dias: (clienteId: string, desde: string, hasta: string) => Promise<ListadoDias>
  medidas: (clienteId: string) => Promise<ListadoMedidas>
  registrarMedida: (clienteId: string, datos: RegistrarMedida) => Promise<Medida>
  pruebas: (clienteId: string) => Promise<ListadoPruebas>
  registrarPrueba: (clienteId: string, datos: RegistrarPrueba) => Promise<PruebaFisica>
  fuerza: (clienteId: string) => Promise<ProgresionFuerza>
  /** Consentimiento de datos de salud del cliente; solo lectura para su equipo. */
  consentimiento: (clienteId: string) => Promise<EstadoConsentimiento>
}

export function crearApiSeguimiento(pedir: PeticionAutenticada): ApiSeguimiento {
  const base = (clienteId: string): string =>
    `/seguimiento/clientes/${encodeURIComponent(clienteId)}`
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
    medidas: (clienteId) => pedir(`${base(clienteId)}/medidas`, ListadoMedidasSchema),
    registrarMedida: (clienteId, datos) =>
      pedir(`${base(clienteId)}/medidas`, MedidaSchema, {
        method: "POST",
        body: JSON.stringify(RegistrarMedidaSchema.parse(datos)),
      }),
    pruebas: (clienteId) => pedir(`${base(clienteId)}/pruebas`, ListadoPruebasSchema),
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
