/**
 * Plantilla HTML del correo de bienvenida para nuevos usuarios de KAIROS.
 * Usa estilos inline (requisito de clientes de correo) con los tokens
 * del Design System: primary #1F2A33, accent #9E4C08, surface #F6F3ED.
 */
export function buildWelcomeUserEmail(params: {
  toEmail: string;
  initialPassword: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const { toEmail, initialPassword, loginUrl } = params;

  const subject = 'Bienvenido a KAIROS — Tus credenciales de acceso';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F6F3ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6F3ED;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1F2A33;border-radius:8px 8px 0 0;padding:28px 32px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#E5E2DC;text-transform:uppercase;">Grupo KAIROS</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#FFFFFF;line-height:1.3;">Bienvenido al sistema</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#FFFFFF;padding:32px;border-left:1px solid #E5E2DC;border-right:1px solid #E5E2DC;">
              <p style="margin:0 0 16px;font-size:15px;color:#1F2A33;line-height:1.6;">
                Tu cuenta ha sido creada en <strong>KAIROS</strong>. A continuación encontrás tus credenciales de acceso inicial.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6F3ED;border:1px solid #E5E2DC;border-radius:6px;margin:24px 0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#52606D;">Tus credenciales</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #E5E2DC;">
                          <p style="margin:0;font-size:12px;color:#52606D;">Correo</p>
                          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1F2A33;">${toEmail}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 0;">
                          <p style="margin:0;font-size:12px;color:#52606D;">Contraseña inicial</p>
                          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1F2A33;font-family:'Courier New',Courier,monospace;letter-spacing:0.04em;">${initialPassword}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF1DE;border:1px solid rgba(138,85,5,0.25);border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#8A5505;line-height:1.5;">
                      <strong>Importante:</strong> Al ingresar por primera vez, el sistema te pedirá cambiar esta contraseña y configurar la autenticación en dos pasos (MFA) antes de continuar.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}"
                       style="display:inline-block;background-color:#9E4C08;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;letter-spacing:0.02em;">
                      Ingresar a KAIROS
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#52606D;line-height:1.6;">
                Si no podés hacer clic en el botón, copiá y pegá este enlace en tu navegador:<br/>
                <a href="${loginUrl}" style="color:#9E4C08;word-break:break-all;">${loginUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F1EDE7;border:1px solid #E5E2DC;border-top:none;border-radius:0 0 8px 8px;padding:20px 32px;">
              <p style="margin:0;font-size:12px;color:#7B8794;line-height:1.6;text-align:center;">
                Este correo fue enviado automáticamente por el sistema KAIROS.<br/>
                Si recibiste este mensaje por error, podés ignorarlo de forma segura.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
