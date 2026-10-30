import { createRequire } from "node:module"
import { resolve } from "node:path"
import configuracion from "../app.json"
import { tema } from "./tema"

// El modo web `single` genera el documento con la CLI, fuera del bundle de React Native.
const { createTemplateHtmlFromExpoConfigAsync } = createRequire(
  require.resolve("expo/package.json"),
)("@expo/cli/build/src/start/server/webTemplate.js") as {
  createTemplateHtmlFromExpoConfigAsync: (
    proyecto: string,
    opciones: { scripts: string[]; exp: typeof configuracion.expo },
  ) => Promise<string>
}

it("sirve el fondo del tema en el HTML antes del bundle y conserva el reset de Expo", async () => {
  const html = await createTemplateHtmlFromExpoConfigAsync(resolve(__dirname, ".."), {
    scripts: ["/bundle-prueba.js"],
    exp: configuracion.expo,
  })
  const cabecera = html.slice(0, html.indexOf("</head>"))
  const reglas = cabecera.match(/<style[^>]*>([\s\S]*?)<\/style>/g)?.join("\n") ?? ""

  expect(reglas).toMatch(
    new RegExp(`html,\\s*body,\\s*#root\\s*\\{[^}]*background-color:\\s*${tema.fondo};`, "i"),
  )
  expect(reglas).toMatch(/color-scheme:\s*dark;/)
  expect(reglas).not.toContain("prefers-color-scheme")
  expect(html).toContain('<html lang="es">')
  expect(html).toContain(
    "<noscript>Necesitas activar JavaScript para usar esta aplicación.</noscript>",
  )
  expect(cabecera).toContain('content="width=device-width, initial-scale=1, shrink-to-fit=no"')
  expect(reglas).toMatch(/html,\s*body\s*\{[^}]*height:\s*100%;/)
  expect(reglas).toMatch(/body\s*\{[^}]*overflow:\s*hidden;/)
  expect(reglas).toMatch(/#root\s*\{[^}]*display:\s*flex;[^}]*height:\s*100%;[^}]*flex:\s*1;/)
  expect(html).toContain('<div id="root"></div>')
  expect(html).toContain('<script src="/bundle-prueba.js" defer></script>')
  expect(html.indexOf("</head>")).toBeLessThan(html.indexOf("<script"))
})
