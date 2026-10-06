/** PROP-015b — tipos de plantilla de documento reconocidos por el sistema. */
export const DocumentTemplateType = {
  RETURN_RESPONSIBILITY: 'RETURN_RESPONSIBILITY',
} as const;

export type DocumentTemplateType = (typeof DocumentTemplateType)[keyof typeof DocumentTemplateType];
