declare module "spdx-license-list/full" {
  const licenseList: Record<
    string,
    {
      name?: string;
      licenseText?: string;
      osiApproved?: boolean;
    }
  >;
  export default licenseList;
}
