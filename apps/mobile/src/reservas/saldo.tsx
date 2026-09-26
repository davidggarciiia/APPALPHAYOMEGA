import { StyleSheet, View } from "react-native"
import { mesDeFecha, type Producto, type ResumenSaldo, type Servicio } from "@alpha-omega/shared"

import { NumeroGrande } from "./calendario"
import { euros, fechaLarga, nombreMes, sesiones, soloMes } from "./formato"
import { Aviso, Tarjeta, Texto } from "./piezas"

/** Bonos de EP con algo dentro. Los caducados y los gastados no suman. */
function bonosVivos(saldo: ResumenSaldo): ResumenSaldo["ep"]["bonos"] {
  return saldo.ep.bonos.filter((bono) => bono.clase === "ep" && bono.quedan > 0)
}

/**
 * De dónde saldrá la sesión de una fecha, en el orden de SPEC-planes.md: el plan
 * del mes de la sesión, el bono empezado que caduca antes, el bono sin empezar y
 * la suelta. Es una previsión para la hoja de confirmación: quien decide es el
 * servidor, y el justificante es la `fuenteSaldo` de la reserva.
 */
export function fuenteProbable(saldo: ResumenSaldo, fecha: string): string | null {
  const mes = mesDeFecha(fecha)
  const plan = [saldo.ep.mesActual, saldo.ep.mesSiguiente].find((cupo) => cupo?.mes === mes)
  if (plan && plan.quedan > 0) return `tu plan de ${soloMes(mes)}`
  const vigentes = bonosVivos(saldo).filter((b) => b.caducaEn === null || b.caducaEn >= fecha)
  const empezados = vigentes
    .filter((b) => b.primerUsoEn !== null)
    .sort((a, b) => (a.caducaEn ?? "9999").localeCompare(b.caducaEn ?? "9999"))
  const sinEmpezar = vigentes.filter((b) => b.primerUsoEn === null && b.sesiones > 1)
  const sueltas = vigentes.filter((b) => b.primerUsoEn === null && b.sesiones <= 1)
  const bono = empezados[0] ?? sinEmpezar[0] ?? sueltas[0]
  return bono ? `«${bono.nombre}»` : null
}

/** Precio por persona de un servicio que se paga allí, según cuántos vienen. */
export function precioPorPersona(servicio: Servicio, personas: number): number | null {
  const tarifa = servicio.tarifas.find((t) => t.personas === personas)
  return tarifa?.precioPorPersonaCentimos ?? servicio.precioCentimos
}

/** «2 × 25 € = 50 €, se paga en el centro», o null si no hay precio que decir. */
export function textoPago(servicio: Servicio, personas: number): string | null {
  const unidad = precioPorPersona(servicio, personas)
  if (unidad === null) return null
  if (servicio.maxPersonas <= 1) return `${euros(unidad)}, se paga en el centro`
  return `${String(personas)} × ${euros(unidad)} = ${euros(unidad * personas)}, se paga en el centro`
}

/** Lo que incluye un producto, en frases cortas. */
export function detalleProducto(producto: Producto): string[] {
  const lineas: string[] = []
  if (producto.tipo === "plan" && producto.sesionesPorMes !== null) {
    lineas.push(`${sesiones(producto.sesionesPorMes)} al mes`)
  }
  if (producto.tipo === "plan" && producto.meses !== null) {
    lineas.push(producto.meses === 1 ? "Un mes" : `${String(producto.meses)} meses`)
  }
  if (producto.tipo === "bono" && producto.sesiones !== null)
    lineas.push(sesiones(producto.sesiones))
  if (producto.validezDias !== null) {
    const validez = producto.validezDias === 365 ? "un año" : `${String(producto.validezDias)} días`
    lineas.push(`Vale ${validez} desde la primera sesión`)
  }
  if (producto.regalo !== null) lineas.push(`Regalo: ${producto.regalo}`)
  return lineas
}

/**
 * «Te quedan N sesiones» con su desglose: el plan de este mes y del siguiente, y
 * cada bono con su caducidad. Lo ve el cliente y, en su ficha, el entrenador.
 */
export function ResumenDeSaldo({
  saldo,
  propio = true,
}: {
  saldo: ResumenSaldo
  /** El cliente lee «Te quedan»; el entrenador, «Le quedan». */
  propio?: boolean
}): React.JSX.Element {
  const { mesActual, mesSiguiente, disponibles } = saldo.ep
  const bonos = bonosVivos(saldo)
  const lineas: string[] = []
  if (mesActual !== null && mesActual.cupo > 0) {
    lineas.push(
      `Plan de ${soloMes(mesActual.mes)}: ${
        mesActual.quedan === 0
          ? "gastado"
          : `quedan ${String(mesActual.quedan)} de ${String(mesActual.cupo)}`
      }`,
    )
  }
  if (mesSiguiente !== null && mesSiguiente.cupo > 0) {
    lineas.push(`En ${nombreMes(mesSiguiente.mes)}: ${sesiones(mesSiguiente.quedan)} del plan`)
  }
  for (const bono of bonos) {
    const caducidad =
      bono.caducaEn !== null
        ? `caduca el ${fechaLarga(bono.caducaEn)}`
        : "sin empezar: vale un año desde la primera sesión"
    const cuantas = bono.compensacion
      ? sesiones(bono.quedan)
      : `quedan ${String(bono.quedan)} de ${String(bono.sesiones)}`
    lineas.push(`${bono.nombre}: ${cuantas} · ${caducidad}`)
  }
  return (
    <Tarjeta destacada>
      <NumeroGrande valor={disponibles} texto={propio ? "Te quedan" : "Le quedan"} />
      <View style={estilos.lineas}>
        {lineas.map((linea) => (
          <Texto key={linea} tenue>
            {linea}
          </Texto>
        ))}
      </View>
      {disponibles === 0 && (
        <Aviso
          tipo="aviso"
          texto={
            propio
              ? "No te quedan sesiones para reservar. Pide un plan o un bono y tu entrenador lo activará cuando le pagues."
              : "No le quedan sesiones. Actívale un plan o un bono cuando te pague."
          }
        />
      )}
    </Tarjeta>
  )
}

const estilos = StyleSheet.create({
  lineas: { gap: 4 },
})
