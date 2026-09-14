---
description: Reutilizacion obligatoria antes de crear un componente nuevo.
paths: ['apps/web/**']
---

# Reutilizacion y Design System

Antes de crear un componente: 1) buscar componentes existentes, 2) consultar `DESIGN.md` y UX/UI seccion 9, 3) evaluar composicion de primitivas Radix existentes, 4) crear uno nuevo solo si hay una necesidad no cubierta.

No duplicar: botones, campos, tablas, modales, alerts, layouts, validadores, clientes HTTP, modelos de dominio. Los componentes compartidos no contienen reglas especificas de un modulo.
