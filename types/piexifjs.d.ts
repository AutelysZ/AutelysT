declare module "piexifjs" {
  const piexif: {
    load: (data: string) => any;
    dump: (data: any) => string;
    insert: (exifStr: string, data: string) => string;
    remove: (data: string) => string;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
  };
  export default piexif;
}
