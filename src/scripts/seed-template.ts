import { readFileSync } from 'node:fs';
import path from 'node:path';

export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Real, editable DOCX (built by scripts/make-template-docx.py). Resolved next to
// this file so it works under tsx (src/) and the built image (dist/, where the
// Dockerfile copies the templates folder).
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'brightline-standard-resume.docx');

export function seedTemplateFile(resumeTemplateName: string) {
  const content = readFileSync(TEMPLATE_PATH);
  return {
    fileName: `${resumeTemplateName}.docx`,
    contentType: DOCX_CONTENT_TYPE,
    sizeBytes: content.length,
    content,
  };
}
