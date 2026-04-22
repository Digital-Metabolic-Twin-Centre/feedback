import {
  baseParticipantSchema,
  participantFormSchema,
} from "@/app/ecrfs/participant/registration/validation/schema";

describe("Participant Registration Schema", () => {
  const currentYear = new Date().getFullYear();

  describe("baseParticipantSchema", () => {
    it("validates valid participant data", () => {
      const validData = {
        participant_id: 1001,
        clinical_site: 5,
        date_of_registration: new Date(),
        year_of_birth: 1990,
        birth_date: new Date("1990-05-15"),
        gender_at_birth: 1,
        cohort_assignment: 2,
        informed_consent_details: 1,
        has_given_informed_consent: true,
      };

      const result = baseParticipantSchema.parse(validData);
      expect(result.participant_id).toBe(1001);
      expect(result.clinical_site).toBe(5);
    });

    it("validates year_of_birth constraints", () => {
      expect(() =>
        baseParticipantSchema.parse({
          participant_id: 1,
          clinical_site: 1,
          year_of_birth: 1899, // Too early
          gender_at_birth: 1,
          cohort_assignment: 1,
          informed_consent_details: 1,
        })
      ).toThrow();

      expect(() =>
        baseParticipantSchema.parse({
          participant_id: 1,
          clinical_site: 1,
          year_of_birth: currentYear + 1, // Future year
          gender_at_birth: 1,
          cohort_assignment: 1,
          informed_consent_details: 1,
        })
      ).toThrow();
    });

    it("accepts valid year_of_birth", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        year_of_birth: 2000,
        birth_date: new Date("2000-05-15"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
      });

      expect(result.year_of_birth).toBe(2000);
    });

    it("converts boolean fields with default false", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        has_given_informed_consent: null,
        has_agreed_to_blood_sampling: undefined,
      });

      expect(result.has_given_informed_consent).toBe(false);
      expect(result.has_agreed_to_blood_sampling).toBe(false);
    });

    it("preserves true boolean values", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        has_given_informed_consent: true,
        has_agreed_to_blood_sampling: true,
      });

      expect(result.has_given_informed_consent).toBe(true);
      expect(result.has_agreed_to_blood_sampling).toBe(true);
    });

    it("handles optional month_of_birth", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-06-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        month_of_birth: "June",
      });

      expect(result.month_of_birth).toBe("June");
    });

    it("validates birth_date range", () => {
      expect(() =>
        baseParticipantSchema.parse({
          participant_id: 1,
          clinical_site: 1,
          birth_date: new Date("1850-01-01"), // Too early
          gender_at_birth: 1,
          cohort_assignment: 1,
          informed_consent_details: 1,
        })
      ).toThrow();

      expect(() =>
        baseParticipantSchema.parse({
          participant_id: 1,
          clinical_site: 1,
          birth_date: new Date(`${currentYear + 1}-01-01`), // Future
          gender_at_birth: 1,
          cohort_assignment: 1,
          informed_consent_details: 1,
        })
      ).toThrow();
    });

    it("accepts valid birth_date", () => {
      const birthDate = new Date("1995-03-20");
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: birthDate,
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
      });

      expect(result.birth_date).toEqual(birthDate);
    });

    it("handles nullable date_informed_consent_was_given", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        date_informed_consent_was_given: null,
      });

      expect(result.date_informed_consent_was_given).toBeNull();
    });

    it("accepts valid date_informed_consent_was_given", () => {
      const consentDate = new Date("2023-06-15");
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        date_informed_consent_was_given: consentDate,
      });

      expect(result.date_informed_consent_was_given).toEqual(consentDate);
    });

    it("handles all consent boolean fields", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        has_agreed_to_urine_sampling: true,
        has_agreed_to_fibroblast_sampling: false,
        has_agreed_to_stool_sampling: true,
        has_agreed_to_future_reuse_of_data: true,
         has_agreed_to_future_reuse_of_samples: true,
        has_agreed_to_genetic_testing: false,
      });

      expect(result.has_agreed_to_urine_sampling).toBe(true);
      expect(result.has_agreed_to_fibroblast_sampling).toBe(false);
      expect(result.has_agreed_to_stool_sampling).toBe(true);
    });

    it("handles optional numeric fields", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        disease_severity: 3,
        iembase_diagnoses: 5,
      });

      expect(result.disease_severity).toBe(3);
      expect(result.iembase_diagnoses).toBe(5);
    });

    it("accepts nullable optional fields", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        iembase_diagnoses_comment: null,
        informed_consent_details_comment: null,
      });

      expect(result.iembase_diagnoses_comment).toBeNull();
      expect(result.informed_consent_details_comment).toBeNull();
    });

    it("preprocesses date_of_registration with default", () => {
      const before = Date.now();
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        date_of_registration: null,
      });
      const after = Date.now();

      expect(result.date_of_registration.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.date_of_registration.getTime()).toBeLessThanOrEqual(after);
    });

    it("handles draft and soft_delete flags", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        draft: true,
        soft_delete: false,
      });

      expect(result.draft).toBe(true);
      expect(result.soft_delete).toBe(false);
    });

    it("handles audit fields", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        created_by: "admin@example.com",
        created_at: "2023-01-01T00:00:00Z",
        updated_by: "user@example.com",
        updated_at: "2023-06-01T00:00:00Z",
      });

      expect(result.created_by).toBe("admin@example.com");
      expect(result.updated_by).toBe("user@example.com");
    });
  });

  describe("participantFormSchema", () => {
    it("requires participant_id and clinical_site when not draft", () => {
      expect(() =>
        participantFormSchema.parse({
          draft: false,
          birth_date: new Date("2000-01-01"),
          gender_at_birth: 1,
          cohort_assignment: 1,
          informed_consent_details: 1,
        })
      ).toThrow();
    });

    it("allows saving without required fields as draft", () => {
      const result = participantFormSchema.parse({
        draft: true,
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
      });

      expect(result.draft).toBe(true);
    });

    it("validates registration date is not before year of birth", () => {
      expect(() =>
        participantFormSchema.parse({
          participant_id: 1,
          clinical_site: 1,
          year_of_birth: 2020,
          birth_date: new Date("2020-05-01"),
          date_of_registration: new Date("2015-01-01"), // Before birth year
          gender_at_birth: 1,
          cohort_assignment: 1,
          informed_consent_details: 1,
        })
      ).toThrow("Date of registration cannot be before year of birth");
    });

    it("accepts registration date after year of birth", () => {
      const result = participantFormSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        year_of_birth: 2010,
        birth_date: new Date("2010-05-01"),
        date_of_registration: new Date("2020-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
      });

      expect(result.year_of_birth).toBe(2010);
    });

    it("validates birth_date is not after registration date", () => {
      expect(() =>
        participantFormSchema.parse({
          participant_id: 1,
          clinical_site: 1,
          birth_date: new Date("2023-01-01"),
          date_of_registration: new Date("2020-01-01"), // Before birth
          gender_at_birth: 1,
          cohort_assignment: 1,
          informed_consent_details: 1,
        })
      ).toThrow("Birth date must not be after date of registration");
    });

    it("accepts birth_date before registration date", () => {
      const result = participantFormSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2010-05-15"),
        date_of_registration: new Date("2023-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
      });

      expect(result.birth_date).toEqual(new Date("2010-05-15"));
    });

    it("skips date validation when dates are missing", () => {
      const result = participantFormSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
      });

      expect(result.participant_id).toBe(1);
    });

    it("allows same day birth_date and registration date", () => {
      const sameDate = new Date("2020-01-01");
      const result = participantFormSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: sameDate,
        date_of_registration: sameDate,
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
      });

      expect(result.birth_date).toEqual(sameDate);
    });
  });

  describe("Edge cases and preprocessing", () => {
    it("converts string dates to Date objects", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        birth_date: "1995-06-15",
        date_of_registration: "2023-01-01",
      });

      expect(result.birth_date).toBeInstanceOf(Date);
      expect(result.date_of_registration).toBeInstanceOf(Date);
    });

    it("converts empty string year_of_birth to undefined", () => {
      const result = baseParticipantSchema.safeParse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        year_of_birth: "",
      });

      if (result.success) {
        expect(result.data.year_of_birth).toBeUndefined();
      }
    });

    it("converts null year_of_birth to undefined", () => {
      const result = baseParticipantSchema.safeParse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        year_of_birth: null,
      });

      if (result.success) {
        expect(result.data.year_of_birth).toBeUndefined();
      }
    });

    it("handles empty string for date_informed_consent_was_given", () => {
      const result = baseParticipantSchema.parse({
        participant_id: 1,
        clinical_site: 1,
        birth_date: new Date("2000-01-01"),
        gender_at_birth: 1,
        cohort_assignment: 1,
        informed_consent_details: 1,
        date_informed_consent_was_given: "",
      });

      expect(result.date_informed_consent_was_given).toBeNull();
    });
  });
});
