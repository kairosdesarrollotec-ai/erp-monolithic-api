# Matriz de propagación — JPG/PNG como baseline obligatorio

| Tipo | Componente | Cambio exigido | Verificación |
|---|---|---|---|
| Gobernanza | Jerarquía documental | Separar UX/UI de imagen y limitar autoridad visual | Conflicto material produce STOP |
| Regla | `frontend-visual-baseline` | Baseline aprobado obligatorio y no invención | Rule cargada para cambios UI |
| Agente | `frontend-slice-planner` | Resolver y analizar baselines antes del plan | Mapa incluye PROTO-ID |
| Agente | `design-system-engineer` | Mapear imagen a componentes/tokens | Cero valor arbitrario silencioso |
| Agente | `react-feature-implementer` | Implementar desde JPG/PNG y fuentes | Screenshot/evidencia generados |
| Agente | `accessibility-reviewer` | Priorizar WCAG con desviación | Cero crítico abierto |
| Agente | `responsive-visual-reviewer` | Pixel diff + revisión semántica | Veredicto independiente |
| Agente | `frontend-test-engineer` | Cubrir baseline y estados faltantes | Tests trazados |
| Agente | `frontend-release-gatekeeper` | Bloquear falta de cobertura/evidencia | Gate independiente |
| Skill | `kairos-source-preflight` | Validar aprobación, hash y viewport | PASS/STOP reproducible |
| Skill | `kairos-prototype-intake` | Registrar/versionar sin autoaprobar | Historia preservada |
| Skill | `kairos-design-system` | Mapear imagen a tokens/variantes | Cero estilo arbitrario |
| Skill | `kairos-react-feature` | Ejecutar flujo completo | DoD por pantalla |
| Skill | `kairos-responsive-visual` | Capturar, comparar y reportar | Baseline/actual/diff |
| Skill | `kairos-frontend-testing` | Pruebas funcionales/visuales | Evidencia completa |
| Skill | `kairos-accessibility` | WCAG sobre defecto visual | Desviación justificada |
| Workflow | `WF-FE-01` | Flujo corregido de 16 pasos | Trazabilidad actualizada |
| Workflow | `WF-FE-06` | Design System antes de estilo nuevo | Reuso verificado |
| Workflow | `WF-FE-07` | Aprobación UX/UI y visual | Cero diferencia crítica |
| Workflow | `WF-FE-08` | Cobertura visual de release | 100% del alcance |
| Workflow | `WF-FE-09` | Ingesta/versionamiento | Baseline gobernado |
| Comando | `/frontend-prototype-register` | Registrar/versionar | PROTO-ID y hash |
| Comando | `/frontend-screen` | Implementar pantalla | Baseline obligatorio |
| Comando | `/frontend-visual-validate` | Validación independiente | No modifica baseline |
| Comando | `/frontend-flow` | Validar recorrido completo | Cero pantalla huérfana |
| Comando | `/frontend-release-check` | Gate consolidado | Veredicto final |
| Hook/CI | Pre-edit/post-edit/pre-finish | Hacer cumplir y repetir controles | Rama protegida bloquea |
| Artefacto | `prototype-manifest.yaml` | Catálogo normativo | Schema/hash validados |
| Artefacto | `visual-implementation-evidence.yaml` | Evidencia por baseline | Commit y diff trazables |
| Índice | Grafo visual | UX→PROTO→código→test→evidencia | Golden queries |

## Alcance backend

No cambia la arquitectura ni los agentes, reglas o skills backend. El backend participa únicamente como autoridad contractual mediante TDD/OpenAPI y en la resolución de conflictos cuando una imagen muestre datos, permisos o acciones no soportadas. Queda prohibido modificar la API solo para imitar un prototipo sin decisión de negocio/técnica aprobada.
