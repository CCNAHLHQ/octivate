/** Ensure rendered template HTML is a complete standalone document for transcoding. */
export function prepareExportDocument(html: string): string {
  if (/<html[\s>]/i.test(html)) return html;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>${html}</body>
</html>`;
}
