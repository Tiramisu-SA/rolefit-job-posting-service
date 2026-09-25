// Types for the internal AI Model Adapter.
// TODO: Finalize the shape of extracted requirements with the team.

export interface ExtractJobRequirementsInput {
  title: string;
  description: string;
}

export interface ExtractedJobRequirements {
  skills: string[];
  // TODO: e.g. yearsOfExperience, education, languages, niceToHave, ...
}
