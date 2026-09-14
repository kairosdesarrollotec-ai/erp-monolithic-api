# Convencion de hooks KAIROS

Todos los hooks de este directorio solo validan los archivos afectados (pasados como argumentos por Claude Code), nunca el repositorio completo. Ninguno ejecuta build, suite E2E completa, visual regression de todas las pantallas, migraciones, instalaciones, deployments ni git push. Deben terminar en segundos, no en minutos.
