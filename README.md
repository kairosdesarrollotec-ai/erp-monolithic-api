# erp-monolithic-api

## Contratos OpenAPI y `generate:api` (front)

Fuente de verdad de los contratos: `packages/contracts/openapi/<modulo>.yaml` (en este repo).
Los tipos TypeScript del front se generan desde el repo `erp-portal-web`
(`apps/web/package.json`, script `generate:api`, con `openapi-typescript@7`); este repo no contiene el generador.

El script del front referencia el repo hermano con una ruta relativa fija
(`../../../erp-monolithic-api/packages/contracts/openapi/<modulo>.yaml`). Esa ruta solo es valida si el clon
del backend se llama `erp-monolithic-api` y es hermano de `erp-portal-web`. Si el clon local tiene otro nombre
(p. ej. `erp-api-local`) o hay worktrees, el script falla o lee contratos obsoletos. Correccion recomendada en
`erp-portal-web/apps/web/package.json` (parametrizar la raiz de contratos con una variable de entorno, con
el valor actual como defecto):

```jsonc
// antes (repetido por cada modulo)
"openapi-typescript@7 ../../../erp-monolithic-api/packages/contracts/openapi/customers.yaml -o src/api/customers.generated.ts"
// despues: sustituir en TODAS las ocurrencias el prefijo
"../../../erp-monolithic-api/packages/contracts/openapi/"  ->  "${API_CONTRACTS_DIR:-../../../erp-monolithic-api/packages/contracts/openapi}/"
```

Uso: `API_CONTRACTS_DIR=../../../erp-api-local/packages/contracts/openapi npm run generate:api`.
(En shells sin expansion `${VAR:-}` —Windows cmd— usar un script `scripts/generate-api.mjs` que lea
`process.env.API_CONTRACTS_DIR` y recorra los `.yaml` de la carpeta.) Ademas, el script del front debe listar todos
los modulos vigentes: `payments`, `reporting`, `search`, `incidents`, `hr-administration`, `templates`, `recruitment`
estan en el contrato del back; verificar que cada uno tenga su linea (algunas copias del front solo listan 8 modulos).
