import { Schema, model } from 'mongoose';

// One resume template file per job (PDF or DOCX, up to 2 MB), kept out of the
// job document so listing jobs never loads file bytes.
const resumeTemplateSchema = new Schema(
  {
    _id: { type: String, required: true }, // template_<ULID>
    jobId: { type: String, required: true, unique: true },
    companyId: { type: String, required: true },
    fileName: { type: String, required: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    content: { type: Buffer, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'resume_templates', versionKey: false },
);

export const ResumeTemplateModel = model('ResumeTemplate', resumeTemplateSchema);
