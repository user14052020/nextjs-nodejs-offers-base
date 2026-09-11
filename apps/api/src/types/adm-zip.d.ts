declare module 'adm-zip' {
  class AdmZip {
    constructor(input: Buffer);
    getEntry(entryName: string): { getData(): Buffer } | null;
  }

  export = AdmZip;
}
