export interface HrDocumentStorageScope {
  companyId: string;
  code: string;
}

export abstract class HrDocumentStoragePort {
  abstract generateUploadUrl(params: {
    companyId: string;
    code: string;
    fileName: string;
    contentType: string;
  }): Promise<{ uploadUrl: string; objectUrl: string }>;

  abstract saveDocumentLocally?(params: {
    companyId: string;
    code: string;
    fileName: string;
    content: Buffer;
  }): Promise<{ objectUrl: string }>;
}
