import { Schema, model } from 'mongoose';
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, JOB_STATUSES, SKILL_LEVELS, WORK_ARRANGEMENTS } from '../types/job.types';

// Authoritative job documents, stored in the shape of the agreed job JSON.
// Only MongoJobRepository may use this model. Other services read jobs through
// the gRPC API, never by querying this collection.
// Validation lives in src/validation; the schema only guards the shape.

const requiredSkillSchema = new Schema(
  {
    name: { type: String, required: true },
    level: { type: String, enum: SKILL_LEVELS, required: true },
    minimumYears: { type: Number, default: 0 },
  },
  { _id: false },
);

const preferredSkillSchema = new Schema(
  {
    name: { type: String, required: true },
    level: { type: String, enum: SKILL_LEVELS, required: true },
  },
  { _id: false },
);

const requirementsSchema = new Schema(
  {
    requiredSkills: { type: [requiredSkillSchema], default: [] },
    preferredSkills: { type: [preferredSkillSchema], default: [] },
    minimumExperienceYears: { type: Number, default: 0 },
    educationLevel: { type: String, enum: EDUCATION_LEVELS, default: 'NONE' },
    acceptedFields: { type: [String], default: [] },
  },
  { _id: false },
);

const locationSchema = new Schema({ country: String, province: String, district: String }, { _id: false });

const salarySchema = new Schema(
  {
    minimum: Number,
    maximum: Number,
    currency: { type: String, default: 'THB' },
    visible: { type: Boolean, default: true },
  },
  { _id: false },
);

const applicationSettingsSchema = new Schema(
  {
    applicationDeadline: Date,
    positionsAvailable: { type: Number, default: 1 },
    resumeTemplateId: String,
    requireCoverLetter: { type: Boolean, default: false },
  },
  { _id: false },
);

const jobSchema = new Schema(
  {
    _id: { type: String, required: true }, // job_<ULID>
    recruiterId: { type: String, required: true },
    companyId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    requirements: { type: requirementsSchema, default: () => ({}) },
    responsibilities: { type: [String], default: [] },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES },
    workArrangement: { type: String, enum: WORK_ARRANGEMENTS },
    location: { type: locationSchema, default: () => ({}) },
    salary: { type: salarySchema, default: () => ({}) },
    applicationSettings: { type: applicationSettingsSchema, default: () => ({}) },
    status: { type: String, enum: JOB_STATUSES, required: true },
    publishedAt: Date,
    // Set by JobService (its clock), so Mongoose timestamps are off.
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: 'jobs', versionKey: false },
);

// A company's own list, newest change first.
jobSchema.index({ companyId: 1, updatedAt: -1 });
// Open jobs for discovery, newest first.
jobSchema.index({ status: 1, publishedAt: -1 });

export const JobModel = model('Job', jobSchema);
