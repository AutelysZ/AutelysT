declare module "mime-db" {
  type MimeDbEntry = {
    extensions?: string[];
    source?: string;
  };

  const mimeDb: Record<string, MimeDbEntry>;
  export default mimeDb;
}
