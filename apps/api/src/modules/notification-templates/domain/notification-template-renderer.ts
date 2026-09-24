/**
 * TR-07 - renderiza el `body` de una plantilla de ADM-05 sustituyendo
 * `{variable}` por el valor real disponible para ese evento. Una
 * variable que la plantilla usa pero que el evento no puede llenar con
 * un dato real (ej. `{nombre}` cuando no existe modulo de Clientes)
 * se deja tal cual, visible, en vez de mostrar un valor inventado o un
 * hueco en blanco silencioso.
 */
export function renderNotificationTemplate(body: string, variables: Readonly<Record<string, string>>): string {
  return body.replace(/\{([a-zA-Z_]+)\}/g, (match, variable: string) =>
    Object.prototype.hasOwnProperty.call(variables, variable) ? variables[variable] : match,
  );
}
