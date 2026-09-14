# Workflows Claude — Frontend

## WF-FE-01 Pantalla trazada

1. Recibir obligatoriamente UX-ID y tarea del usuario.
2. Consultar `prototype-manifest.yaml` y localizar la especificación UX/UI.
3. Verificar al menos un JPG/PNG `APPROVED`, versión, hash, estado y viewport.
4. Analizar visualmente layout, zonas, jerarquía, componentes, contenido y CTA.
5. Resolver BR/UC/TDD/OpenAPI, roles, permisos y eventos.
6. Detectar contradicciones; detenerse si afectan reglas, datos, roles, permisos, contrato o flujo.
7. Mapear componentes y tokens del Design System.
8. Auditar clics y herencia de contexto.
9. Implementar adapter OpenAPI, TanStack Query, React Hook Form/Zod, Radix/design system y estado React/Zustand solo donde corresponda.
10. Incorporar estados obligatorios no visibles en el JPG/PNG.
11. Construir variantes responsive faltantes sin contradecir la referencia.
12. Probar happy path, errores, permiso, sesión, navegación, teclado y accesibilidad.
13. Generar captura determinista en el viewport baseline.
14. Ejecutar visual regression y revisión semántica.
15. Clasificar diferencias y exigir aprobación para desviaciones intencionales.
16. Actualizar evidencia, cobertura y trazabilidad.

## WF-FE-02 Flujo Consulta→Reserva→Alquiler

- Mantener contexto y no repetir datos.
- Desde vehículo disponible: `Reservar este vehículo`.
- Reserva confirmada: `Continuar con alquiler` si aplica.
- Antes de comandos críticos revalidar servidor; no confiar en disponibilidad renderizada.
- Mostrar competencia por vehículo como error recuperable y alternativas.

## WF-FE-03 Entrega

- Stepper: cliente/documentos → validaciones → garantía/contrato → checklist/evidencia → confirmación.
- Guardado en servidor excepto checklist local autorizado.
- MTC/RENIEC y alcolímetro con estados y consecuencias exactas.
- Menos de 30 min técnico requiere excepción explícita.
- Confirmación bloqueada hasta respuesta del servidor.

## WF-FE-04 Devolución

- Identificar alquiler → alcolímetro → checklist/evidencia → resultado.
- Sin daño: no renderizar formularios de daño.
- Daño estético/técnico/paralización despliega rama correcta.
- Garantía se libera solo sin incidente abierto y con autorización.
- Comparador antes/después accesible.

## WF-FE-05 Offline/sincronización

- Descargar contexto permitido mientras online.
- Capturar local cifrado.
- Indicar cantidad/progreso y estado persistente.
- Reintentar idempotentemente.
- Conflicto muestra local/servidor, autor/hora y opciones autorizadas.
- Solo `SYNCED` confirmado por servidor habilita finalización aplicable.

## WF-FE-06 Design system

- Analizar los patrones presentes en los prototipos aprobados y mapearlos a componentes/variantes/tokens existentes.
- Si el patrón no existe o contradice tokens, detenerse para decisión UX/UI; no copiar hex, radios, sombras o tamaños arbitrarios desde la imagen.
- Crear variable/token primero.
- Implementar componente base y estados.
- Story/example por variante y breakpoint.
- Unit + accessibility + visual regression.
- Migrar consumidores sin duplicar estilos.
- Revisar contraste y reduced motion.

## WF-FE-06A Bootstrap técnico

1. Crear React/TypeScript con Vite.
2. Configurar React Router, layouts, lazy loading y guards UX.
3. Configurar provider de TanStack Query y catálogo de query keys.
4. Crear stores Zustand mínimos de shell/preferencias.
5. Integrar React Hook Form/Zod y cliente OpenAPI generado.
6. Configurar Radix, tokens CSS, Lucide, date-fns y TanStack Table.
7. Configurar PWA/Workbox y Dexie sin habilitar offline fuera de ALQ-09/DEV-04.
8. Configurar Vitest/Testing Library/MSW/Playwright/axe y Sentry.
9. Fijar versiones exactas en lockfile y ejecutar smoke tests.
10. Ejecutar gate de dependencias aprobadas.

## WF-FE-07 Aprobación UX/UI

- Prototipo continuo por rol y todos sus UX-ID registrados con baseline vigente.
- Cero callejón sin salida.
- Presupuesto de interacción cumplido ≥90%.
- Responsive móvil obligatorio completo.
- WCAG 2.2 AA sin hallazgo crítico.
- Visual regression y revisión semántica aprobadas, con cero diferencia crítica y desviaciones intencionales firmadas.
- Prueba de usabilidad: ≥90% éxito sin ayuda, 0% abandono por interfaz, satisfacción ≥4/5.

## WF-FE-08 Release de módulo

- Build, lint y typecheck.
- Unit/component/E2E.
- Contract compatibility con API desplegable.
- Performance budget y PWA checks.
- Accessibility/visual/security gates.
- UAT del Sponsor registrada.
- Cobertura `UX-ID → baseline → implementación → screenshot/diff → aprobación` al 100% para las pantallas incluidas.

## WF-FE-09 Ingesta y versionamiento de prototipos

1. Recibir JPG/PNG y metadatos mínimos.
2. Validar formato, resolución, viewport, estado visual y ausencia de PII real.
3. Asignar nombre canónico y PROTO-ID.
4. Calcular hash y registrar versión.
5. Vincular UX-ID, UX/UI, módulo, ruta esperada y variantes.
6. Registrar como `DRAFT`/`REVIEWED`.
7. Obtener aprobación UX/UI independiente.
8. Marcar `APPROVED`; si reemplaza otro, marcarlo `SUPERSEDED`.
9. Actualizar workspace index y matriz de cobertura.
10. Nunca borrar evidencia histórica ni actualizar un baseline desde el comando de validación.
