declare module "html-to-docx" {
  type DocumentOptions = {
    table?: { row?: { cantSplit?: boolean } };
    footer?: boolean;
    pageNumber?: boolean;
    creator?: string;
    title?: string;
    margins?: Record<string, number>;
  };

  export default function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString: string | null,
    documentOptions?: DocumentOptions,
    footerHTMLString?: string | null
  ): Promise<Buffer | ArrayBuffer | Uint8Array>;
}
