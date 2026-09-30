export class OrganizationBranchResponse {
  branchId!: string;
  branchName!: string;
}

export class OrganizationCompanyResponse {
  companyId!: string;
  companyName!: string;
  branches!: OrganizationBranchResponse[];
}

export class OrganizationCompaniesResponse {
  companies!: OrganizationCompanyResponse[];
}
