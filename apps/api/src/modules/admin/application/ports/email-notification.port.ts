export abstract class EmailNotificationPort {
  /**
   * Envía el correo de bienvenida al usuario recién provisionado con sus
   * credenciales iniciales. El handler lo invoca fire-and-forget; los
   * errores deben loguearse pero no interrumpir la respuesta al cliente.
   *
   * La contraseña se incluye porque es el único momento en que está
   * disponible en texto plano. TR-02 fuerza el cambio en el primer login.
   */
  abstract sendWelcomeUser(toEmail: string, initialPassword: string): Promise<void>;
}
